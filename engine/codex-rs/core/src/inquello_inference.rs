//! Trusted, one-use CR-1 model-client boundary. Never populated from model-provider
//! config, prompts, a renderer verdict, or environment variables. App-server owns
//! current principal/policy/route eligibility checks before binding an attempt.
use crate::client_common::{Prompt, ResponseEvent, ResponseStream};
use codex_protocol::error::{CodexErr, Result};
use codex_protocol::models::ResponseItem;
use futures::StreamExt;
use inquello_adapters::anthropic::{AuthStore, MessagesClient};
use inquello_protocol::inference::{Binding, ContentBlock, Event, EventGuard, EventKind,
    InferenceRequest, Message, Origin, Role, StopReason, Tool};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, OnceLock};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

const RESPONSES_PREFIX: &str = "inquello:responses:v1:";
const OPAQUE_PREFIX: &str = "inquello:messages:v1:";
/// Runtime-created context. No Serialize/Deserialize implementation deliberately.
pub struct AttemptContext {
    pub binding: Binding,
    pub auth: Option<AuthStore>,
    pub max_output_tokens: u32,
    pub completed_tool_call_ids: Vec<String>,
    pub events: mpsc::Sender<Event>,
    pub cancellation: CancellationToken,
}
static PENDING: OnceLock<Mutex<HashMap<String, AttemptContext>>> = OnceLock::new();
fn pending() -> &'static Mutex<HashMap<String, AttemptContext>> { PENDING.get_or_init(|| Mutex::new(HashMap::new())) }
/// Binding must be created at the trusted permission/execution boundary after
/// current authority and evidence checks. Selection alone never calls this.
pub fn bind_attempt(thread_id: &str, context: AttemptContext) -> std::result::Result<(), &'static str> {
    context.binding.validate()?;
    if uuid::Uuid::parse_str(thread_id).is_err() || context.cancellation.is_cancelled() {
        return Err("invalid runtime inference binding");
    }
    let mut pending = pending().lock().map_err(|_| "inference binding unavailable")?;
    if pending.len() >= 64 || pending.contains_key(thread_id) { return Err("inference binding already pending"); }
    pending.insert(thread_id.to_string(), context);
    Ok(())
}
pub fn cancel_bound_attempt(thread_id: &str) {
    if let Ok(mut pending) = pending().lock() {
        if let Some(context) = pending.remove(thread_id) { context.cancellation.cancel(); }
    }
}
pub(crate) fn take_attempt(thread_id: &str) -> Result<Option<AttemptContext>> {
    pending().lock().map(|mut pending| pending.remove(thread_id)).map_err(|_| failure("binding unavailable"))
}
fn failure(reason: &'static str) -> CodexErr { CodexErr::Fatal(format!("Selected processing route refused: {reason}; no retry or provider fallback")) }

pub(crate) fn request(prompt: &Prompt, context: &AttemptContext) -> Result<InferenceRequest> {
    if context.cancellation.is_cancelled() { return Err(failure("attempt cancelled before dispatch")); }
    if prompt.output_schema.is_some() || prompt.cyber_access_program.is_some() {
        return Err(failure("unsupported output schema or optional extension"));
    }
    let definitions = codex_tools::create_tools_raw_json_for_responses_api(&prompt.tools)?;
    let definitions = serde_json::to_value(definitions).map_err(|_| failure("invalid tool definitions"))?;
    let mut tools = Vec::new();
    for definition in definitions.as_array().ok_or_else(|| failure("invalid tool definitions"))? {
        if definition["type"] != "function" { return Err(failure("unsupported provider-hosted or custom tool")); }
        tools.push(Tool { name: text(definition, "name")?,
            description: definition.get("description").and_then(Value::as_str).unwrap_or("").to_string(),
            input_schema: definition.get("parameters").cloned().ok_or_else(|| failure("tool schema missing"))? });
    }
    let mut messages = Vec::new();
    if !prompt.base_instructions.text.is_empty() {
        messages.push(Message { message_id: "base-instructions".into(), role: Role::System,
            origin: Origin::TrustedInstruction, blocks: vec![ContentBlock::Text { text: prompt.base_instructions.text.clone() }] });
    }
    for (index, item) in prompt.input.iter().enumerate() {
        let value = serde_json::to_value(item).map_err(|_| failure("invalid history item"))?;
        let (role, origin, blocks) = match value["type"].as_str() {
            Some("message") => {
                if value.get("encrypted_content").is_some_and(|v| !v.is_null()) {
                    if context.binding.route_id != "codex-responses" || value["role"] != "assistant" {
                        return Err(failure("incompatible encrypted message"));
                    }
                    messages.push(Message { message_id: format!("history-{index}"), role: Role::Assistant,
                        origin: Origin::AssistantOutput, blocks: vec![responses_continuation(&context.binding, value)] });
                    continue;
                }
                let (role, origin) = match value["role"].as_str() {
                    Some("system" | "developer") => (Role::System, Origin::TrustedInstruction),
                    Some("user") => (Role::User, Origin::UserInput),
                    Some("assistant") => (Role::Assistant, Origin::AssistantOutput),
                    _ => return Err(failure("unsupported history role")),
                };
                let mut blocks = Vec::new();
                for block in value["content"].as_array().ok_or_else(|| failure("invalid text history"))? {
                    if !matches!(block["type"].as_str(), Some("input_text" | "output_text")) {
                        return Err(failure("images and other input blocks unsupported"));
                    }
                    blocks.push(ContentBlock::Text { text: text(block, "text")? });
                }
                (role, origin, blocks)
            }
            Some("function_call") => {
                if value.get("namespace").is_some_and(|v| !v.is_null())
                    || value.get("encrypted_content").is_some_and(|v| !v.is_null())
                    || value.get("encrypted_function_args").is_some_and(|v| !v.is_null()) {
                    return Err(failure("incompatible provider tool history"));
                }
                (Role::Assistant, Origin::AssistantOutput, vec![ContentBlock::ToolRequest {
                    tool_call_id: text(&value, "call_id")?, tool_name: text(&value, "name")?,
                    arguments: serde_json::from_str(&text(&value, "arguments")?).map_err(|_| failure("invalid tool argument history"))? }])
            }
            Some("function_call_output") => {
                let content = if let Some(text) = value["output"].as_str() { vec![text.to_string()] } else {
                    let mut text_blocks = Vec::new();
                    for block in value["output"].as_array().ok_or_else(|| failure("invalid tool output history"))? {
                        if block["type"] != "input_text" { return Err(failure("non-text tool output unsupported")); }
                        text_blocks.push(text(block, "text")?);
                    }
                    text_blocks
                };
                // Get success from the typed payload: the legacy serializer omits it.
                let success = match item { ResponseItem::FunctionCallOutput { output, .. } => output.success, _ => None };
                (Role::User, Origin::ToolOutput, vec![ContentBlock::ToolResult { tool_call_id: text(&value, "call_id")?, success, content }])
            }
            Some("reasoning") => {
                if context.binding.route_id == "codex-responses" {
                    // Native encrypted reasoning is opaque to Inquello. Do not parse
                    // it using the Messages envelope or rewrite the retained item.
                    if value.get("encrypted_content").and_then(Value::as_str).is_some_and(|v| v.starts_with(OPAQUE_PREFIX)) {
                        return Err(failure("Messages continuation cannot cross providers"));
                    }
                    let block = match value.get("encrypted_content").and_then(Value::as_str).and_then(|v| v.strip_prefix(RESPONSES_PREFIX)) {
                        Some(encoded) => serde_json::from_str::<ContentBlock>(encoded).map_err(|_| failure("invalid Responses continuation"))?,
                        None => responses_continuation(&context.binding, value),
                    };
                    if !matches!(block, ContentBlock::ResponsesContinuation { .. }) { return Err(failure("invalid Responses continuation kind")); }
                    messages.push(Message { message_id: format!("history-{index}"), role: Role::Assistant,
                        origin: Origin::AssistantOutput, blocks: vec![block] });
                    continue;
                }
                let opaque = text(&value, "encrypted_content")?;
                let encoded = opaque.strip_prefix(OPAQUE_PREFIX).ok_or_else(|| failure("incompatible provider continuation"))?;
                let block: ContentBlock = serde_json::from_str(encoded).map_err(|_| failure("invalid provider continuation"))?;
                if !matches!(block, ContentBlock::Opaque { .. }) { return Err(failure("invalid provider continuation")); }
                (Role::Assistant, Origin::AssistantOutput, vec![block])
            }
            _ => return Err(failure("unsupported history item")),
        };
        messages.push(Message { message_id: format!("history-{index}"), role, origin, blocks });
    }
    let request = InferenceRequest { binding: context.binding.clone(), messages, tools,
        max_output_tokens: context.max_output_tokens, completed_tool_call_ids: context.completed_tool_call_ids.clone(),
        effects_reconciled: true, settings: json!({"parallel_tool_calls":prompt.parallel_tool_calls}) };
    request.validate().map_err(failure)?;
    Ok(request)
}
/// Restore native items only after the normalized, exact-bound history validates.
pub(crate) fn responses_prompt(prompt: &Prompt, context: &AttemptContext) -> Result<Prompt> {
    request(prompt, context)?;
    let mut native = prompt.clone();
    for item in &mut native.input {
        let value = serde_json::to_value(&*item).map_err(|_| failure("invalid Responses history"))?;
        if let Some(encoded) = value.get("encrypted_content").and_then(Value::as_str).and_then(|v| v.strip_prefix(RESPONSES_PREFIX)) {
            let block: ContentBlock = serde_json::from_str(encoded).map_err(|_| failure("invalid Responses continuation"))?;
            if let ContentBlock::ResponsesContinuation { item: original, .. } = block {
                *item = serde_json::from_value(original).map_err(|_| failure("invalid native Responses continuation"))?;
            } else { return Err(failure("invalid Responses continuation kind")); }
        }
    }
    Ok(native)
}
fn retained_continuation(prefix: &str, block: &ContentBlock) -> Result<ResponseItem> {
    let encoded = serde_json::to_string(block).map_err(|_| failure("invalid continuation"))?;
    serde_json::from_value(json!({"type":"reasoning", "summary":[],
        "encrypted_content":format!("{prefix}{encoded}")})).map_err(|_| failure("invalid retained continuation"))
}
fn responses_continuation(binding: &Binding, item: Value) -> ContentBlock {
    ContentBlock::ResponsesContinuation { route_id: binding.route_id.clone(), model: binding.model.clone(),
        api_version: binding.api_version.clone(), item }
}

/// Every bounded delivery, including errors and terminal records, uses this
/// primitive. Reserving first lets cancellation win before committing a value.
async fn deliver<T>(sender: &mpsc::Sender<T>, value: T, cancellation: &CancellationToken,
    consumer: &CancellationToken, revoked: &CancellationToken) -> bool {
    let permit = tokio::select! {
        biased;
        _ = cancellation.cancelled() => { consumer.cancel(); return false; }
        _ = consumer.cancelled() => return false,
        _ = revoked.cancelled() => { consumer.cancel(); return false; }
        permit = sender.reserve() => match permit { Ok(permit) => permit, Err(_) => return false },
    };
    if cancellation.is_cancelled() || consumer.is_cancelled() || revoked.is_cancelled() {
        consumer.cancel(); return false;
    }
    permit.send(value);
    true
}
fn text(value: &Value, key: &str) -> Result<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string).ok_or_else(|| failure("required history field missing"))
}

pub(crate) async fn await_dispatch<T>(future: impl std::future::Future<Output = Result<T>>,
    context: Option<&AttemptContext>) -> Result<T> {
    if let Some(context) = context {
        tokio::select! {
            biased;
            _ = context.cancellation.cancelled() => Err(failure("attempt cancelled during dispatch")),
            result = future => result.map_err(|_| failure("bound inference dispatch failed")),
        }
    } else { future.await }
}

pub(crate) async fn messages(prompt: &Prompt, context: AttemptContext) -> Result<ResponseStream> {
    let request = request(prompt, &context)?;
    let auth = context.auth.as_ref().ok_or_else(|| failure("private provider credential unavailable"))?;
    let lease = auth.lease(&request.binding).map_err(failure)?;
    let revoked = lease.cancellation();
    let client = messages_client(&request.binding)?;
    let mut incoming = client.stream_with_cancellation(request.clone(), lease, context.cancellation.clone()).await.map_err(failure)?;
    let (sender, receiver) = mpsc::channel(32);
    let dropped = context.cancellation.child_token();
    let consumer = dropped.clone();
    tokio::spawn(async move {
        let mut guard = EventGuard::new(request.binding.clone());
        let mut blocks: BTreeMap<u32, Value> = BTreeMap::new();
        let mut terminal = false;
        loop {
            let event = tokio::select! {
                biased;
                _ = context.cancellation.cancelled() => { revoked.cancel(); break; }
                _ = consumer.cancelled() => { revoked.cancel(); break; }
                _ = revoked.cancelled() => { consumer.cancel(); break; },
                event = incoming.recv() => match event { Some(event) => event, None => break },
            };
            if guard.accept(&event).is_err() { let _ = deliver(&sender, Err(failure("invalid event attribution")), &context.cancellation, &consumer, &revoked).await; return; }
            let attributed = deliver(&context.events, event.clone(), &context.cancellation, &consumer, &revoked).await;
            if !attributed {
                revoked.cancel();  return;
            }
            let output = match event.event {
                EventKind::Started => Some(ResponseEvent::Created { response_id: event.provider_message_id.clone() }),
                EventKind::TextDelta { block_index, text } => {
                    let block = blocks.entry(block_index).or_insert_with(|| json!({"type":"message","role":"assistant", "content":[{"type":"output_text","text":""}]}));
                    let previous = block["content"][0]["text"].as_str().unwrap_or("");
                    block["content"][0]["text"] = json!(format!("{previous}{text}"));
                    Some(ResponseEvent::OutputTextDelta(text))
                }
                EventKind::ToolRequestReady { block_index, tool_call_id, tool_name, arguments } => {
                    blocks.insert(block_index, json!({"type":"function_call", "call_id":tool_call_id,
                        "name":tool_name,"arguments":arguments.to_string()})); None
                }
                EventKind::OpaqueBlock { block_index, block } => {
                    let retained = retained_continuation(OPAQUE_PREFIX, &block).and_then(|item|
                        serde_json::to_value(item).map_err(|_| failure("invalid retained continuation")));
                    match retained {
                        Ok(value) => { blocks.insert(block_index, value); }
                        Err(error) => { let _ = deliver(&sender, Err(error), &context.cancellation, &consumer, &revoked).await; return; }
                    }
                    None
                }
                EventKind::Completed { reason, .. } => {
                    for (_, block) in std::mem::take(&mut blocks) {
                        let item: ResponseItem = match serde_json::from_value(block) {
                            Ok(item) => item, Err(_) => { let _ = deliver(&sender, Err(failure("invalid normalized output")), &context.cancellation, &consumer, &revoked).await; return; }
                        };
                        if context.cancellation.is_cancelled() || revoked.is_cancelled() { return; }
                        if !deliver(&sender, Ok(ResponseEvent::OutputItemDone(item)), &context.cancellation, &consumer, &revoked).await { return; }
                    }
                    terminal = true;
                    match reason {
                        StopReason::EndTurn | StopReason::ToolRequests => Some(ResponseEvent::Completed {
                            response_id: event.provider_message_id.unwrap_or_default(), token_usage: None,
                            usage_metadata: None, end_turn: Some(reason == StopReason::EndTurn),
                        }),
                        _ => { let _ = deliver(&sender, Err(failure("model output incomplete or refused")), &context.cancellation, &consumer, &revoked).await; None }
                    }
                }
                EventKind::Failed { .. } => {
                    terminal = true;
                    let _ = deliver(&sender, Err(failure("Messages attempt failed; partial output and usage retained")), &context.cancellation, &consumer, &revoked).await;
                    None
                }
                EventKind::ToolArgumentsDelta { .. } | EventKind::UsageUpdate { .. } => None,
            };
            if let Some(output) = output {
                if context.cancellation.is_cancelled() || revoked.is_cancelled() { return; }
                if !deliver(&sender, Ok(output), &context.cancellation, &consumer, &revoked).await { return; }
            }
            if terminal { return; }
        }
        let _ = deliver(&sender, Err(failure("attempt cancelled or disconnected")), &context.cancellation, &consumer, &revoked).await;
    });
    Ok(ResponseStream { rx_event: receiver, interrupt: None, consumer_dropped: dropped })
}

fn responses_opaque(item: &ResponseItem) -> bool {
    matches!(item, ResponseItem::Reasoning { .. }
        | ResponseItem::Message { encrypted_content: Some(_), .. })
}
fn supported_response_item(item: &ResponseItem, request: &InferenceRequest) -> bool {
    match item {
        ResponseItem::Message { role, .. } => role == "assistant",
        ResponseItem::Reasoning { .. } => true,
        ResponseItem::FunctionCall { call_id, name, namespace, encrypted_content, encrypted_function_args, .. } => {
            inquello_protocol::inference::valid_id(call_id)
                && request.tools.iter().any(|tool| &tool.name == name)
                && namespace.is_none() && encrypted_content.is_none() && encrypted_function_args.is_none()
        }
        // Hosted, custom, search and local-shell calls have no declared mapping
        // or normalized validation. Never forward them to the runtime executor.
        _ => false,
    }
}
fn checked_lifecycle(guard: &mut EventGuard, mut event: Event) -> Event {
    if guard.accept(&event).is_err() {
        event.event = EventKind::Failed { error: inquello_protocol::inference::ErrorKind::MalformedStream,
            retryable: false, completion_uncertain: true };
        let _ = guard.accept(&event);
    }
    event
}

/// Wraps the inherited Responses transport only for an explicitly bound Inquello
/// attempt. Same-route WebSocket→HTTP recovery remains in the original client.
pub(crate) fn responses(mut stream: ResponseStream, context: AttemptContext, request: InferenceRequest) -> ResponseStream {
    let interrupt = stream.interrupt.take();
    let (sender, receiver) = mpsc::channel(32);
    let dropped = context.cancellation.child_token();
    let consumer = dropped.clone();
    tokio::spawn(async move {
        let revoked = context.cancellation.clone();
        let mut guard = EventGuard::new(request.binding.clone());
        let mut sequence = 0;
        let mut response_id = None;
        let mut calls: std::collections::HashSet<String> = request.completed_tool_call_ids.iter().cloned().collect();
        let mut has_tools = false;
        let mut block_index = 0u32;
        let mut next_block = 0u32;
        let mut terminal = false;
        while let Some(result) = tokio::select! {
            biased;
            _ = consumer.cancelled() => None,
            _ = context.cancellation.cancelled() => None,
            result = stream.next() => result,
        } {
            if let Ok(ResponseEvent::Completed { token_usage: Some(usage), .. }) = &result {
                let usage = inquello_protocol::inference::Usage {
                    input_tokens: u64::try_from(usage.input_tokens).ok(),
                    output_tokens: u64::try_from(usage.output_tokens).ok(),
                    // Inherited cache counters have default zeros and cannot prove
                    // the provider supplied them. Keep those categories unknown.
                    origin: Some("provider".into()), ..Default::default()
                };
                let event = Event { binding: context.binding.clone(), sequence,
                    provider_request_id: None, provider_message_id: response_id.clone(),
                    event: EventKind::UsageUpdate { usage } };
                let event = checked_lifecycle(&mut guard, event);
                let invalid = event.event.terminal();
                sequence += 1;
                let attributed = deliver(&context.events, event, &context.cancellation, &consumer, &revoked).await;
                if !attributed { return; }
                if invalid {
                    let _ = deliver(&sender, Err(failure("invalid Responses lifecycle")), &context.cancellation, &consumer, &revoked).await;
                    return;
                }
            }
            let normalized = match &result {
                Ok(ResponseEvent::OutputItemAdded(item) | ResponseEvent::OutputItemDone(item))
                    if !supported_response_item(item, &request) => Some(EventKind::Failed {
                        error: inquello_protocol::inference::ErrorKind::UnsupportedCapability,
                        retryable: false, completion_uncertain: true }),
                Ok(ResponseEvent::ServerModel(model)) if model != &request.binding.model =>
                    Some(EventKind::Failed { error: inquello_protocol::inference::ErrorKind::UnsupportedCapability,
                        retryable: false, completion_uncertain: true }),
                Ok(ResponseEvent::Created { response_id: id }) => { response_id = id.clone(); Some(EventKind::Started) }
                Ok(ResponseEvent::OutputItemAdded(_)) => { block_index = next_block; next_block += 1; None }
                Ok(ResponseEvent::OutputTextDelta(text)) => Some(EventKind::TextDelta { block_index, text: text.clone() }),
                Ok(ResponseEvent::ToolCallInputDelta { call_id, delta, .. }) => call_id.as_ref().map(|id|
                    EventKind::ToolArgumentsDelta { block_index, tool_call_id: id.clone(), delta: delta.clone() }),
                Ok(ResponseEvent::OutputItemDone(ResponseItem::FunctionCall { call_id, name, arguments, .. })) => {
                    let parsed = serde_json::from_str::<Value>(arguments).ok();
                    let valid = parsed.as_ref().zip(request.tools.iter().find(|tool| tool.name == *name))
                        .is_some_and(|(args, tool)| inquello_protocol::inference::validate_arguments(&tool.input_schema, args, 0).is_ok());
                    if !valid || !calls.insert(call_id.clone()) {
                        Some(EventKind::Failed { error: inquello_protocol::inference::ErrorKind::MalformedStream,
                            retryable: false, completion_uncertain: true })
                    } else {
                        has_tools = true;
                        Some(EventKind::ToolRequestReady { block_index, tool_call_id: call_id.clone(),
                            tool_name: name.clone(), arguments: parsed.unwrap_or(Value::Null) })
                    }
                }
                Ok(ResponseEvent::OutputItemDone(item)) if responses_opaque(item) => {
                    match serde_json::to_value(item) {
                        Ok(item) => Some(EventKind::OpaqueBlock { block_index,
                            block: responses_continuation(&context.binding, item) }),
                        Err(_) => Some(EventKind::Failed { error: inquello_protocol::inference::ErrorKind::MalformedStream,
                            retryable: false, completion_uncertain: true }),
                    }
                }
                Ok(ResponseEvent::Completed { response_id: id, end_turn, .. }) => {
                    response_id = Some(id.clone());
                    if *end_turn == Some(true) || has_tools {
                        Some(EventKind::Completed { reason: if has_tools { StopReason::ToolRequests } else { StopReason::EndTurn },
                            provider_reason: None })
                    } else { Some(EventKind::Failed { error: inquello_protocol::inference::ErrorKind::UnsupportedCapability,
                        retryable: false, completion_uncertain: false }) }
                }
                Err(error) => {
                    use codex_protocol::error::CodexErrorDetails as E;
                    use inquello_protocol::inference::ErrorKind as K;
                    let kind = match error.details() {
                        E::RefreshTokenFailed(_) | E::GatewayLoginRequired(_) => K::Auth,
                        E::RateLimitExceeded(_) | E::UsageLimitReached(_) => K::RateLimit,
                        E::QuotaExceeded | E::UsageNotIncluded => K::CreditLimit,
                        E::InvalidRequest(_) | E::InvalidPrompt { .. } | E::ModelNotFound { .. } => K::InvalidRequest,
                        E::UnsupportedOperation(_) => K::UnsupportedCapability,
                        E::ServerOverloaded | E::FlexUnavailable | E::InternalServerError => K::ProviderUnavailable,
                        E::TurnAborted | E::Interrupted => K::Cancelled,
                        _ => K::Transport,
                    };
                    Some(EventKind::Failed { error: kind, retryable: false, completion_uncertain: true })
                },
                _ => None,
            };
            let mut invalid = false;
            if let Some(event) = normalized {
                let event = Event { binding: context.binding.clone(), sequence,
                    provider_request_id: None, provider_message_id: response_id.clone(), event };
                let event = checked_lifecycle(&mut guard, event);
                terminal = event.event.terminal();
                invalid = matches!(&event.event, EventKind::Failed { .. });
                sequence += 1;
                let attributed = deliver(&context.events, event, &context.cancellation, &consumer, &revoked).await;
                if !attributed { return; }
            }
            if context.cancellation.is_cancelled() { break; }
            if invalid { let _ = deliver(&sender, Err(failure("Responses normalized attempt failed")), &context.cancellation, &consumer, &revoked).await; return; }
            let result = match result {
                Ok(ResponseEvent::OutputItemDone(item)) if responses_opaque(&item) => {
                    let retained = serde_json::to_value(&item).map_err(|_| failure("invalid Responses continuation"))
                        .and_then(|item| retained_continuation(RESPONSES_PREFIX, &responses_continuation(&context.binding, item)));
                    retained.map(ResponseEvent::OutputItemDone)
                }
                result => result,
            };
            if !deliver(&sender, result, &context.cancellation, &consumer, &revoked).await { return; }
            if terminal { return; }
        }
        if !terminal {
            let event = Event { binding: context.binding.clone(), sequence, provider_request_id: None,
                provider_message_id: response_id, event: EventKind::Failed {
                    error: inquello_protocol::inference::ErrorKind::Cancelled, retryable: false, completion_uncertain: true } };
            let _ = deliver(&context.events, event, &context.cancellation, &consumer, &revoked).await;
            let _ = deliver(&sender, Err(failure("Responses attempt cancelled or disconnected")), &context.cancellation, &consumer, &revoked).await;
        }
    });
    ResponseStream { rx_event: receiver, interrupt, consumer_dropped: dropped }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn context() -> AttemptContext {
        let request: InferenceRequest = serde_json::from_str(include_str!("../../inquello-protocol/fixtures/inference/messages-request.json")).expect("fixture");
        let (events, _receiver) = mpsc::channel(32);
        AttemptContext { binding: request.binding, auth: None, max_output_tokens:128,
            completed_tool_call_ids:vec![], events, cancellation:CancellationToken::new() }
    }
    #[test]
    fn core_binding_is_explicit_one_use_and_cancellable() {
        let thread = uuid::Uuid::new_v4().to_string();
        assert!(take_attempt(&thread).expect("lookup").is_none());
        bind_attempt(&thread, context()).expect("trusted bind");
        assert!(bind_attempt(&thread, context()).is_err());
        assert!(take_attempt(&thread).expect("take").is_some());
        assert!(take_attempt(&thread).expect("second take").is_none());
        let context = context(); let cancellation = context.cancellation.clone();
        bind_attempt(&thread, context).expect("bind"); cancel_bound_attempt(&thread);
        assert!(cancellation.is_cancelled());
    }
    #[test]
    fn retained_prompt_translation_preserves_text_and_rejects_optional_settings() {
        let mut prompt = Prompt::default();
        prompt.base_instructions.text = "Trusted instruction".into();
        prompt.input.push(serde_json::from_value(json!({"type":"message","role":"user",
            "content":[{"type":"input_text","text":"Synthetic request"}]})).expect("history"));
        let request = request(&prompt, &context()).expect("normalized request");
        assert_eq!(request.messages[0].origin, Origin::TrustedInstruction);
        assert_eq!(request.messages[1].origin, Origin::UserInput);
        prompt.output_schema = Some(json!({"type":"object"}));
        assert!(super::request(&prompt, &context()).is_err());
    }
    #[tokio::test]
    async fn selected_responses_model_change_is_a_terminal_refusal() {
        let mut context = context();
        context.binding.route_id = "codex-responses".into();
        context.binding.model = "gpt-6.1-sol".into();
        context.binding.api_version = "responses-v1".into();
        let (events, mut normalized) = mpsc::channel(4); context.events = events;
        let mut request: InferenceRequest = serde_json::from_str(include_str!("../../inquello-protocol/fixtures/inference/messages-request.json")).expect("fixture");
        request.binding = context.binding.clone();
        let (sender, receiver) = mpsc::channel(4);
        sender.send(Ok(ResponseEvent::ServerModel("different-model".into()))).await.expect("fixture event"); drop(sender);
        let inner = ResponseStream { rx_event:receiver, interrupt:None, consumer_dropped:CancellationToken::new() };
        let mut stream = responses(inner, context, request);
        assert!(stream.next().await.expect("terminal result").is_err());
        assert!(matches!(normalized.recv().await.expect("attributed refusal").event, EventKind::Failed { .. }));
    }

    #[test]
    fn exact_messages_signed_and_redacted_decoder_retained_history_roundtrip() {
        let context = context();
        let seed: InferenceRequest = serde_json::from_str(include_str!("../../inquello-protocol/fixtures/inference/messages-request.json")).expect("seed");
        let mut decoder = inquello_adapters::anthropic::MessagesDecoder::new(seed, None);
        let mut prompt = Prompt::default();
        let mut original = Vec::new();
        for entry in include_str!("../../inquello-protocol/fixtures/inference/messages-opaque.sse").trim().split("\n\n") {
            let mut lines = entry.lines();
            let name = lines.next().expect("name").strip_prefix("event: ").expect("prefix");
            let data = lines.next().expect("data").strip_prefix("data: ").expect("prefix");
            for event in decoder.push(name, data).expect("decode signed history") {
                if let EventKind::OpaqueBlock { block, .. } = event.event {
                    if let ContentBlock::Opaque { block: native, .. } = &block { original.push(native.clone()); }
                    prompt.input.push(retained_continuation(OPAQUE_PREFIX, &block).expect("retained history"));
                }
            }
        }
        assert_eq!(original, vec![json!({"type":"thinking","thinking":"opaque synthetic thought","signature":"synthetic-signed-value=="}),
            json!({"type":"redacted_thinking","data":"synthetic-redacted-value=="})]);
        prompt.input.push(serde_json::from_value(json!({"type":"message","role":"user","content":[{"type":"input_text","text":"Continue"}]})).expect("user"));
        let normalized = request(&prompt, &context).expect("normalize retained signed history");
        let native = inquello_adapters::anthropic::encode_request(&normalized).expect("next request");
        assert_eq!(native["messages"][0]["content"], json!(original));
        for field in ["route", "model", "api"] {
            let mut changed = normalized.clone();
            match field { "route" => changed.binding.route_id = "codex-responses".into(),
                "model" => changed.binding.model = "other-model".into(), _ => changed.binding.api_version = "other-api".into() }
            assert!(changed.validate().is_err());
        }
    }

    #[test]
    fn responses_native_opaque_is_not_messages_and_roundtrips_exactly() {
        let mut context = context();
        context.binding.route_id = "codex-responses".into();
        context.binding.model = "gpt-6.1-sol".into();
        context.binding.api_version = "responses-v1".into();
        let original: ResponseItem = serde_json::from_value(json!({"type":"reasoning","summary":[],
            "encrypted_content":"native-opaque-not-a-messages-envelope=="})).expect("native reasoning");
        let mut prompt = Prompt::default();
        prompt.input.push(original.clone());
        let normalized = request(&prompt, &context).expect("inherited native opaque accepted");
        assert!(matches!(&normalized.messages[0].blocks[0], ContentBlock::ResponsesContinuation { .. }));
        prompt.input[0] = retained_continuation(RESPONSES_PREFIX, &normalized.messages[0].blocks[0]).expect("retain binding");
        let native = responses_prompt(&prompt, &context).expect("restore native item");
        assert_eq!(serde_json::to_value(&native.input[0]).expect("actual"), serde_json::to_value(original).expect("expected"));
        for field in ["route", "model", "api"] {
            let mut changed = super::tests::context();
            changed.binding = context.binding.clone();
            match field { "route" => changed.binding.route_id = "claude-api-key".into(),
                "model" => changed.binding.model = "other-model".into(), _ => changed.binding.api_version = "other-api".into() }
            assert!(request(&prompt, &changed).is_err());
        }
    }

    #[tokio::test]
    async fn all_bounded_deliveries_cancel_without_sending_a_late_value() {
        for revoke in [false, true] {
            let (sender, mut receiver) = mpsc::channel(1);
            sender.send("already queued").await.expect("fill queue");
            let authority = CancellationToken::new(); let consumer = authority.child_token();
            let revoked = CancellationToken::new();
            let task = tokio::spawn({ let authority = authority.clone(); let consumer = consumer.clone(); let revoked = revoked.clone();
                async move { deliver(&sender, "late", &authority, &consumer, &revoked).await } });
            tokio::task::yield_now().await;
            if revoke { revoked.cancel(); } else { authority.cancel(); }
            assert!(!tokio::time::timeout(std::time::Duration::from_secs(1), task).await.expect("cancel bounded wait").expect("join"));
            assert!(consumer.is_cancelled());
            assert_eq!(receiver.recv().await, Some("already queued"));
            assert_eq!(receiver.recv().await, None);
        }
    }

    #[tokio::test]
    async fn cancelled_response_stream_discards_buffered_output() {
        let (sender, receiver) = mpsc::channel(1);
        sender.send(Ok(ResponseEvent::OutputTextDelta("late".into()))).await.expect("queued");
        let token = CancellationToken::new();
        let mut stream = ResponseStream { rx_event: receiver, interrupt: None, consumer_dropped: token.clone() };
        token.cancel();
        assert!(stream.next().await.is_none());
    }

    #[tokio::test]
    async fn cancelled_before_dispatch_never_polls_transport() {
        let context = context(); context.cancellation.cancel();
        let result: Result<()> = await_dispatch(async { panic!("cancelled transport was polled") }, Some(&context)).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn actual_responses_mapper_cancels_saturated_output_and_attribution_queues() {
        for saturate_attribution in [false, true] {
            let mut context = context();
            context.binding.route_id = "codex-responses".into();
            context.binding.model = "gpt-6.1-sol".into();
            context.binding.api_version = "responses-v1".into();
            let cancellation = context.cancellation.clone();
            let (events, mut normalized) = mpsc::channel(if saturate_attribution { 1 } else { 128 });
            context.events = events;
            let request = request(&Prompt { input: vec![serde_json::from_value(json!({"type":"message","role":"user",
                "content":[{"type":"input_text","text":"Synthetic"}]})).expect("input")], ..Default::default() }, &context).expect("request");
            let (sender, receiver) = mpsc::channel(64);
            sender.send(Ok(ResponseEvent::Created { response_id: Some("fixture".into()) })).await.expect("start");
            for _ in 0..40 { sender.send(Ok(ResponseEvent::OutputTextDelta("partial".into()))).await.expect("delta"); }
            let inner = ResponseStream { rx_event: receiver, interrupt: None, consumer_dropped: CancellationToken::new() };
            let mut stream = responses(inner, context, request);
            tokio::time::timeout(std::time::Duration::from_secs(1), async {
                loop {
                    if saturate_attribution && normalized.len() == 1 || !saturate_attribution && stream.rx_event.len() == 32 { break; }
                    tokio::task::yield_now().await;
                }
            }).await.expect("queue saturated");
            cancellation.cancel();
            tokio::time::timeout(std::time::Duration::from_secs(1), sender.closed()).await.expect("mapper releases upstream");
            assert!(stream.next().await.is_none(), "buffered late output is unusable");
            while normalized.recv().await.is_some() {}
        }
    }

    fn response_context() -> AttemptContext {
        let mut context = context();
        context.binding.route_id = "codex-responses".into();
        context.binding.model = "gpt-6.1-sol".into();
        context.binding.api_version = "responses-v1".into();
        context
    }
    fn completed_response() -> ResponseEvent {
        ResponseEvent::Completed { response_id: "fixture".into(), token_usage: None,
            usage_metadata: None, end_turn: Some(true) }
    }
    async fn mapped_responses(events: Vec<ResponseEvent>) -> (Vec<Result<ResponseEvent>>, Vec<Event>) {
        let mut context = response_context();
        let (attribution, mut normalized) = mpsc::channel(64); context.events = attribution;
        let mut request: InferenceRequest = serde_json::from_str(include_str!("../../inquello-protocol/fixtures/inference/messages-request.json")).expect("fixture");
        request.binding = context.binding.clone();
        let (sender, receiver) = mpsc::channel(64);
        for event in events { sender.send(Ok(event)).await.expect("fixture event"); }
        drop(sender);
        let stream = responses(ResponseStream { rx_event: receiver, interrupt: None,
            consumer_dropped: CancellationToken::new() }, context, request);
        let output = stream.collect::<Vec<_>>().await;
        let mut attributed = Vec::new();
        while let Some(event) = normalized.recv().await { attributed.push(event); }
        (output, attributed)
    }
    #[tokio::test]
    async fn bound_dispatch_errors_are_fatal_but_unbound_and_same_call_success_are_preserved() {
        let context = response_context();
        let bound: Result<()> = await_dispatch(async { Err(CodexErr::Stream("synthetic disconnect".into())) }, Some(&context)).await;
        assert!(bound.expect_err("bound dispatch fails closed").retry_delay(1).is_none());
        let unbound: Result<()> = await_dispatch(async { Err(CodexErr::Stream("synthetic disconnect".into())) }, None).await;
        assert!(matches!(unbound.expect_err("unbound unchanged").details(), codex_protocol::error::CodexErrorDetails::Stream(_)));
        // A successful dispatch outcome (including the caller's same-call
        // WebSocket->HTTP recovery signal) is passed through unchanged.
        assert_eq!(await_dispatch(async { Ok("same-route HTTP recovery") }, Some(&context)).await.expect("success"), "same-route HTTP recovery");
    }
    #[tokio::test]
    async fn encrypted_assistant_output_retains_exact_route_model_and_api_binding() {
        let original: ResponseItem = serde_json::from_value(json!({"type":"message","role":"assistant",
            "content":[{"type":"output_text","text":"visible"}],"encrypted_content":"native-message-opaque=="})).expect("message");
        let (output, attributed) = mapped_responses(vec![ResponseEvent::Created { response_id: Some("fixture".into()) },
            ResponseEvent::OutputItemDone(original.clone()), completed_response()]).await;
        assert!(attributed.iter().any(|event| matches!(&event.event, EventKind::OpaqueBlock {
            block: ContentBlock::ResponsesContinuation { item, .. }, .. } if item["type"] == "message")));
        let retained = output.into_iter().find_map(|event| match event {
            Ok(ResponseEvent::OutputItemDone(item)) => Some(item), _ => None }).expect("retained message");
        let prompt = Prompt { input: vec![retained], ..Default::default() };
        let context = response_context();
        let native = responses_prompt(&prompt, &context).expect("native continuation");
        assert_eq!(serde_json::to_value(&native.input[0]).expect("actual"), serde_json::to_value(original).expect("expected"));
        for field in ["route", "model", "api"] {
            let mut changed = response_context();
            match field { "route" => changed.binding.route_id = "claude-api-key".into(),
                "model" => changed.binding.model = "different".into(), _ => changed.binding.api_version = "different".into() }
            assert!(request(&prompt, &changed).is_err());
        }
    }
    #[tokio::test]
    async fn unsupported_tool_items_are_never_forwarded_added_or_done() {
        for value in [
            json!({"type":"custom_tool_call","call_id":"custom-1","name":"read_fixture","input":"unvalidated"}),
            json!({"type":"tool_search_call","call_id":"search-1","execution":"server","arguments":{}}),
            json!({"type":"function_call","call_id":"function-1","name":"read_fixture","namespace":"hosted","arguments":"{}"}),
        ] {
            for added in [false, true] {
                let item: ResponseItem = serde_json::from_value(value.clone()).expect("unsupported fixture item");
                let event = if added { ResponseEvent::OutputItemAdded(item) } else { ResponseEvent::OutputItemDone(item) };
                let (output, attributed) = mapped_responses(vec![ResponseEvent::Created { response_id: Some("fixture".into()) }, event]).await;
                assert!(!output.iter().any(|event| matches!(event, Ok(ResponseEvent::OutputItemAdded(_) | ResponseEvent::OutputItemDone(_)))));
                assert!(output.last().expect("terminal refusal").is_err());
                assert!(matches!(&attributed.last().expect("attribution").event, EventKind::Failed { .. }));
            }
        }
    }
    #[tokio::test]
    async fn responses_lifecycle_rejects_duplicate_starts_and_startless_output_but_allows_metadata() {
        for events in [vec![ResponseEvent::OutputTextDelta("startless".into())], vec![completed_response()],
            vec![ResponseEvent::Created { response_id: Some("first".into()) }, ResponseEvent::Created { response_id: Some("second".into()) }]] {
            let (output, attributed) = mapped_responses(events).await;
            assert!(output.last().expect("terminal refusal").is_err());
            assert!(matches!(&attributed.last().expect("attribution").event, EventKind::Failed { error: inquello_protocol::inference::ErrorKind::MalformedStream, .. }));
            let mut guard = EventGuard::new(attributed[0].binding.clone());
            for event in attributed { guard.accept(&event).expect("valid failure sequence"); }
        }
        let (output, attributed) = mapped_responses(vec![ResponseEvent::ServerModel("gpt-6.1-sol".into()),
            ResponseEvent::Created { response_id: Some("fixture".into()) }, ResponseEvent::OutputTextDelta("valid".into()), completed_response()]).await;
        assert!(output.iter().all(Result::is_ok));
        assert!(matches!(&attributed.last().expect("completion").event, EventKind::Completed { .. }));
    }

    #[test]
    fn fatal_messages_errors_are_never_automatically_retryable() {
        assert!(failure("synthetic transport failure").retry_delay(1).is_none());
        let provider = codex_model_provider_info::ModelProviderInfo {
            wire_api:codex_model_provider_info::WireApi::Messages,
            request_max_retries:Some(100), stream_max_retries:Some(100), ..Default::default()
        };
        assert_eq!(provider.request_max_retries(),0);
        assert_eq!(provider.stream_max_retries(),0);
    }
}

fn messages_client(binding: &Binding) -> Result<MessagesClient> {
    #[cfg(feature = "inference-fixtures")]
    if let Some(client) = fixtures::take_transport(&binding.attempt_id)? { return Ok(client); }
    let _ = binding;
    MessagesClient::production().map_err(failure)
}
#[cfg(feature = "inference-fixtures")]
pub mod fixtures;
