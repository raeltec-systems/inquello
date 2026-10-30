use inquello_protocol::inference::{ContentBlock, InferenceRequest, Role, CLAUDE_API_VERSION, CLAUDE_MODEL};
use serde_json::{Value, json};

pub fn encode_request(request: &InferenceRequest) -> Result<Value, &'static str> {
    request.validate()?;
    if request.binding.route_id != "claude-api-key" || request.binding.model != CLAUDE_MODEL
        || request.binding.api_version != CLAUDE_API_VERSION { return Err("unsupported Messages model or API version"); }
    if request.settings.as_object().is_none_or(|settings| settings.iter().any(|(key,value)|
        key != "parallel_tool_calls" || !value.is_boolean())) {
        return Err("Messages sampling, reasoning and optional settings are unsupported");
    }
    let mut system = Vec::new();
    let mut messages: Vec<Value> = Vec::new();
    let mut non_system_seen = false;
    for message in &request.messages {
        let mut content = Vec::new();
        for block in &message.blocks {
            let native = match block {
                ContentBlock::Text { text } => json!({"type":"text", "text":text}),
                ContentBlock::ToolRequest { tool_call_id, tool_name, arguments } =>
                    json!({"type":"tool_use","id":tool_call_id,"name":tool_name,"input":arguments}),
                ContentBlock::ToolResult { tool_call_id, success, content } => {
                    let mut result = json!({"type":"tool_result","tool_use_id":tool_call_id,
                        "content":content.iter().map(|text| json!({"type":"text","text":text})).collect::<Vec<_>>()});
                    if let Some(success) = success { result["is_error"] = json!(!success); }
                    result
                }
                ContentBlock::ResponsesContinuation { .. } => return Err("Responses continuation is not Messages history"),
                ContentBlock::Opaque { block, .. } => {
                    validate_opaque(block)?;
                    block.clone()
                }
            };
            content.push(native);
        }
        if message.role == Role::System {
            if non_system_seen { return Err("late system instructions cannot be reordered"); }
            system.extend(content);
        } else {
            non_system_seen = true;
            let role = if message.role == Role::Assistant { "assistant" } else { "user" };
            // Merge only adjacent same-role messages, preserving every block's order.
            if let Some(previous) = messages.last_mut().filter(|previous| previous["role"] == role) {
                previous["content"].as_array_mut().ok_or("invalid history")?.extend(content);
            } else { messages.push(json!({"role":role,"content":content})); }
        }
    }
    if messages.is_empty() || messages.last().is_some_and(|m| m["role"] != "user") {
        return Err("Messages requires a final user or tool-result message");
    }
    let mut body = json!({"model":CLAUDE_MODEL,"max_tokens":request.max_output_tokens,"stream":true,
        "system":system,"messages":messages,
        "tools":request.tools.iter().map(|t|json!({"name":t.name,"description":t.description,
            "input_schema":t.input_schema})).collect::<Vec<_>>()});
    if !request.tools.is_empty() {
        body["tool_choice"] = json!({"type":"auto", "disable_parallel_tool_use":
            !request.settings.get("parallel_tool_calls").and_then(Value::as_bool).unwrap_or(false)});
    }
    Ok(body)
}

pub(crate) fn validate_opaque(block: &Value) -> Result<(), &'static str> {
    let object = block.as_object().ok_or("invalid provider continuation")?;
    match block.get("type").and_then(Value::as_str) {
        Some("thinking") if object.len() == 3 && block.get("thinking").is_some_and(Value::is_string)
            && block.get("signature").and_then(Value::as_str).is_some_and(|s| !s.is_empty()) => Ok(()),
        Some("redacted_thinking") if object.len() == 2
            && block.get("data").and_then(Value::as_str).is_some_and(|s| !s.is_empty()) => Ok(()),
        _ => Err("unsupported provider continuation block"),
    }
}
