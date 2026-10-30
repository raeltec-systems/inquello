use super::request::validate_opaque;
use inquello_protocol::inference::{Binding, ContentBlock, ErrorKind, Event, EventKind, InferenceRequest,
    StopReason, Usage, MAX_CONTENT_BYTES, valid_id, validate_arguments};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashSet};

struct Block { kind: BlockKind, closed: bool }
enum BlockKind {
    Text,
    Tool { id: String, name: String, initial: Value, partial: String, arguments: Option<Value> },
    Thinking { text: String, signature: String },
    Redacted(Value),
}
/// Strict bounded state machine. Tool-ready events are withheld until message_stop:
/// a truncated or malformed stream cannot dispatch an otherwise complete tool.
pub struct MessagesDecoder {
    request: InferenceRequest,
    request_id: Option<String>,
    message_id: Option<String>,
    next: u64,
    started: bool,
    terminal: bool,
    bytes: usize,
    blocks: BTreeMap<u32, Block>,
    ids: HashSet<String>,
    stop: Option<(StopReason, String)>,
    usage: Usage,
}
impl MessagesDecoder {
    pub fn new(request: InferenceRequest, request_id: Option<String>) -> Self {
        let ids = request.completed_tool_call_ids.iter().cloned().collect();
        Self { request, request_id: request_id.filter(|id| valid_id(id)), message_id: None,
            next: 0, started: false, terminal: false, bytes: 0, blocks: BTreeMap::new(), ids,
            stop: None, usage: Usage::default() }
    }
    pub fn binding(&self) -> &Binding { &self.request.binding }
    pub fn terminal(&self) -> bool { self.terminal }
    fn event(&mut self, event: EventKind) -> Event {
        let sequence = self.next;
        self.next += 1;
        self.terminal |= event.terminal();
        Event { binding: self.request.binding.clone(), sequence, provider_request_id: self.request_id.clone(),
            provider_message_id: self.message_id.clone(), event }
    }
    pub fn fail(&mut self, error: ErrorKind, completion_uncertain: bool) -> Option<Event> {
        if self.terminal { return None; }
        Some(self.event(EventKind::Failed { error, retryable: false, completion_uncertain }))
    }
    pub fn finish(&mut self) -> Option<Event> { self.fail(ErrorKind::MalformedStream, self.started) }
    pub fn push(&mut self, name: &str, data: &str) -> Result<Vec<Event>, ErrorKind> {
        if self.terminal { return Err(ErrorKind::MalformedStream); }
        self.bytes = self.bytes.checked_add(data.len()).ok_or(ErrorKind::MalformedStream)?;
        if self.bytes > MAX_CONTENT_BYTES { return Err(ErrorKind::MalformedStream); }
        let value: Value = serde_json::from_str(data).map_err(|_| ErrorKind::MalformedStream)?;
        if value.get("type").and_then(Value::as_str) != Some(name) { return Err(ErrorKind::MalformedStream); }
        let mut events = Vec::new();
        match name {
            "ping" => {},
            "error" => {
                let error = match value.pointer("/error/type").and_then(Value::as_str) {
                    Some("authentication_error" | "permission_error") => ErrorKind::Auth,
                    Some("rate_limit_error") => ErrorKind::RateLimit,
                    Some("credit_balance_too_low" | "billing_error") => ErrorKind::CreditLimit,
                    Some("invalid_request_error" | "not_found_error" | "request_too_large") => ErrorKind::InvalidRequest,
                    Some("overloaded_error" | "api_error") => ErrorKind::ProviderUnavailable,
                    _ => ErrorKind::MalformedStream,
                };
                if let Some(event) = self.fail(error, self.started) { events.push(event); }
            }
            "message_start" => {
                if self.started || !self.blocks.is_empty() { return Err(ErrorKind::MalformedStream); }
                let message = value.get("message").ok_or(ErrorKind::MalformedStream)?;
                let id = message.get("id").and_then(Value::as_str).filter(|id| valid_id(id))
                    .ok_or(ErrorKind::MalformedStream)?;
                if message.get("model").and_then(Value::as_str) != Some(self.request.binding.model.as_str())
                    || message.get("role").and_then(Value::as_str) != Some("assistant")
                    || message.get("content").and_then(Value::as_array).is_none_or(|v| !v.is_empty()) {
                    return Err(ErrorKind::MalformedStream);
                }
                self.message_id = Some(id.into());
                self.started = true;
                events.push(self.event(EventKind::Started));
                if let Some(usage) = message.get("usage") { self.update_usage(usage)?;
                    events.push(self.event(EventKind::UsageUpdate { usage: self.usage.clone() })); }
            }
            "content_block_start" => {
                self.require_content()?;
                let index = index(&value)?;
                if self.blocks.contains_key(&index) || index as usize != self.blocks.len() || index > 1023 {
                    return Err(ErrorKind::MalformedStream);
                }
                let block = value.get("content_block").ok_or(ErrorKind::MalformedStream)?;
                let kind = match block.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        let text = string(block, "text")?;
                        if !text.is_empty() { events.push(self.event(EventKind::TextDelta { block_index: index, text })); }
                        BlockKind::Text
                    }
                    Some("tool_use") => {
                        let parallel = self.request.settings.get("parallel_tool_calls").and_then(Value::as_bool).unwrap_or(false);
                        if !parallel && self.blocks.values().any(|block| matches!(block.kind, BlockKind::Tool { .. })) {
                            return Err(ErrorKind::UnsupportedCapability);
                        }
                        let id = string(block, "id")?;
                        let name = string(block, "name")?;
                        if !valid_id(&id) || !self.ids.insert(id.clone())
                            || !self.request.tools.iter().any(|tool| tool.name == name) {
                            return Err(ErrorKind::MalformedStream);
                        }
                        let initial = block.get("input").filter(|v| v.is_object()).ok_or(ErrorKind::MalformedStream)?.clone();
                        BlockKind::Tool { id, name, initial, partial: String::new(), arguments: None }
                    }
                    Some("thinking") => BlockKind::Thinking { text: string(block, "thinking")?,
                        signature: block.get("signature").and_then(Value::as_str).unwrap_or("").into() },
                    Some("redacted_thinking") => { validate_opaque(block).map_err(|_| ErrorKind::MalformedStream)?;
                        BlockKind::Redacted(block.clone()) },
                    _ => return Err(ErrorKind::UnsupportedCapability),
                };
                self.blocks.insert(index, Block { kind, closed: false });
            }
            "content_block_delta" => {
                self.require_content()?;
                let index = index(&value)?;
                let delta = value.get("delta").ok_or(ErrorKind::MalformedStream)?;
                let block = self.blocks.get_mut(&index).filter(|b| !b.closed).ok_or(ErrorKind::MalformedStream)?;
                let event = match (&mut block.kind, delta.get("type").and_then(Value::as_str)) {
                    (BlockKind::Text, Some("text_delta")) => Some(EventKind::TextDelta { block_index: index, text: string(delta, "text")? }),
                    (BlockKind::Tool { id, initial, partial, .. }, Some("input_json_delta")) => {
                        if initial.as_object().is_none_or(|v| !v.is_empty()) { return Err(ErrorKind::MalformedStream); }
                        let fragment = string(delta, "partial_json")?;
                        partial.push_str(&fragment);
                        Some(EventKind::ToolArgumentsDelta { block_index: index, tool_call_id: id.clone(), delta: fragment })
                    }
                    (BlockKind::Thinking { text, .. }, Some("thinking_delta")) => { text.push_str(&string(delta, "thinking")?); None },
                    (BlockKind::Thinking { signature, .. }, Some("signature_delta")) => { signature.push_str(&string(delta, "signature")?); None },
                    _ => return Err(ErrorKind::MalformedStream),
                };
                if let Some(event) = event { events.push(self.event(event)); }
            }
            "content_block_stop" => {
                self.require_content()?;
                let index = index(&value)?;
                let block = self.blocks.get_mut(&index).filter(|b| !b.closed).ok_or(ErrorKind::MalformedStream)?;
                if let BlockKind::Tool { name, initial, partial, arguments, .. } = &mut block.kind {
                    let parsed = if partial.is_empty() { initial.clone() } else {
                        serde_json::from_str(partial).map_err(|_| ErrorKind::MalformedStream)? };
                    let tool = self.request.tools.iter().find(|tool| tool.name == *name).ok_or(ErrorKind::MalformedStream)?;
                    validate_arguments(&tool.input_schema, &parsed, 0).map_err(|_| ErrorKind::MalformedStream)?;
                    *arguments = Some(parsed);
                }
                if let BlockKind::Thinking { signature, .. } = &block.kind {
                    if signature.is_empty() { return Err(ErrorKind::MalformedStream); }
                }
                block.closed = true;
            }
            "message_delta" => {
                if !self.started || self.stop.is_some() || self.blocks.values().any(|b| !b.closed) {
                    return Err(ErrorKind::MalformedStream);
                }
                let reason = value.pointer("/delta/stop_reason").and_then(Value::as_str).ok_or(ErrorKind::MalformedStream)?;
                let normalized = match reason {
                    "end_turn" => StopReason::EndTurn,
                    "tool_use" => StopReason::ToolRequests,
                    "max_tokens" | "model_context_window_exceeded" => StopReason::OutputLimit,
                    "refusal" => StopReason::Refused,
                    _ => return Err(ErrorKind::UnsupportedCapability),
                };
                let tools = self.blocks.values().any(|b| matches!(b.kind, BlockKind::Tool { .. }));
                if tools != (normalized == StopReason::ToolRequests) { return Err(ErrorKind::MalformedStream); }
                self.stop = Some((normalized, reason.into()));
                if let Some(usage) = value.get("usage") { self.update_usage(usage)?;
                    events.push(self.event(EventKind::UsageUpdate { usage: self.usage.clone() })); }
            }
            "message_stop" => {
                if !self.started || self.blocks.values().any(|b| !b.closed) { return Err(ErrorKind::MalformedStream); }
                let (reason, provider_reason) = self.stop.take().ok_or(ErrorKind::MalformedStream)?;
                let blocks = std::mem::take(&mut self.blocks);
                for (index, block) in blocks {
                    match block.kind {
                        BlockKind::Tool { id, name, arguments, .. } => events.push(self.event(EventKind::ToolRequestReady {
                            block_index: index, tool_call_id: id, tool_name: name,
                            arguments: arguments.ok_or(ErrorKind::MalformedStream)?,
                        })),
                        BlockKind::Thinking { text, signature } => events.push(self.opaque(index, json!({"type":"thinking","thinking":text,"signature":signature}))),
                        BlockKind::Redacted(block) => events.push(self.opaque(index, block)),
                        BlockKind::Text => {},
                    }
                }
                events.push(self.event(EventKind::Completed { reason, provider_reason: Some(provider_reason) }));
            }
            _ => return Err(ErrorKind::UnsupportedCapability),
        }
        Ok(events)
    }
    fn opaque(&mut self, block_index: u32, block: Value) -> Event {
        self.event(EventKind::OpaqueBlock { block_index, block: ContentBlock::Opaque {
            route_id: self.request.binding.route_id.clone(), model: self.request.binding.model.clone(),
            api_version: self.request.binding.api_version.clone(), block } })
    }
    fn require_content(&self) -> Result<(), ErrorKind> {
        if !self.started || self.stop.is_some() { Err(ErrorKind::MalformedStream) } else { Ok(()) }
    }
    fn update_usage(&mut self, value: &Value) -> Result<(), ErrorKind> {
        if !value.is_object() { return Err(ErrorKind::MalformedStream); }
        for (key, field) in [("input_tokens", &mut self.usage.input_tokens), ("output_tokens", &mut self.usage.output_tokens),
            ("cache_read_input_tokens", &mut self.usage.cache_read_tokens), ("cache_creation_input_tokens", &mut self.usage.cache_write_tokens)] {
            if let Some(value) = value.get(key) { *field = Some(value.as_u64().ok_or(ErrorKind::MalformedStream)?); }
        }
        self.usage.origin = Some("provider".into());
        Ok(())
    }
}
fn index(value: &Value) -> Result<u32, ErrorKind> {
    value.get("index").and_then(Value::as_u64).and_then(|v| u32::try_from(v).ok()).ok_or(ErrorKind::MalformedStream)
}
fn string(value: &Value, key: &str) -> Result<String, ErrorKind> {
    value.get(key).and_then(Value::as_str).map(str::to_string).ok_or(ErrorKind::MalformedStream)
}
