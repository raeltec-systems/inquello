use inquello_protocol::inference::{Event, EventGuard, InferenceRequest};

#[test]
fn both_routes_obey_the_same_versioned_event_contract() {
    for fixture in [include_str!("../fixtures/inference/claude-api-key-events.json"),
        include_str!("../fixtures/inference/codex-responses-events.json")] {
        let events: Vec<Event> = serde_json::from_str(fixture).expect("fixture");
        let mut guard = EventGuard::new(events[0].binding.clone());
        for event in &events { guard.accept(event).expect("ordered event"); }
        assert!(guard.accept(&events[0]).is_err());
        let mut guard = EventGuard::new(events[0].binding.clone());
        assert!(guard.accept(&events[1]).is_err());
        let mut altered = events[0].clone();
        altered.binding.authority_epoch += 1;
        assert!(guard.accept(&altered).is_err());
    }
}
#[test]
fn request_fixture_has_no_authentication_or_implicit_effects() {
    let text = include_str!("../fixtures/inference/messages-request.json");
    let request: InferenceRequest = serde_json::from_str(text).expect("request");
    request.validate().expect("valid request");
    let mut value = serde_json::from_str::<serde_json::Value>(text).expect("value");
    value["api_key"] = serde_json::json!("sentinel");
    assert!(serde_json::from_value::<InferenceRequest>(value).is_err());
    let mut changed = request;
    changed.effects_reconciled = false;
    assert!(changed.validate().is_err());
}

#[test]
fn tool_schema_root_is_object_while_nested_types_remain_supported() {
    let mut request: InferenceRequest = serde_json::from_str(include_str!("../fixtures/inference/messages-request.json")).expect("fixture");
    for schema in [serde_json::json!({"type":"string"}), serde_json::json!({"type":"array","items":{"type":"string"}}),
        serde_json::json!({"type":"integer"})] {
        request.tools[0].input_schema = schema;
        assert!(request.validate().is_err());
    }
    request.tools[0].input_schema = serde_json::json!({"type":"object","properties":{
        "labels":{"type":"array","items":{"type":"string"}},"count":{"type":"integer"},"enabled":{"type":"boolean"}}});
    request.validate().expect("nested types remain valid");
}
