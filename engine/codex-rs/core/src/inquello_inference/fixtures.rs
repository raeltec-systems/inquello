//! Compile-time-only TLS fixture seam for the retained ModelClientSession.
//! No config/env/RPC endpoint override. Never enable `inference-fixtures` in a
//! packaged release. Each supplied loopback client is bound to one synthetic attempt.
use super::*;
use crate::{ModelClient, ModelClientSession};
use codex_http_client::{HttpClientFactory, OutboundProxyPolicy};
use codex_login::auth::AgentIdentityAuthPolicy;
use codex_model_provider_info::{ModelProviderInfo, WireApi};
use codex_otel::SessionTelemetry;
use codex_protocol::{ThreadId, openai_models::ModelInfo};
use codex_protocol::config_types::ReasoningSummary;
use codex_protocol::protocol::SessionSource;
use codex_rollout_trace::InferenceTraceContext;
use codex_tools::{ResponsesApiTool, ToolSpec};
use std::sync::Arc;

static TRANSPORTS: OnceLock<Mutex<HashMap<String, MessagesClient>>> = OnceLock::new();
fn transports() -> &'static Mutex<HashMap<String, MessagesClient>> { TRANSPORTS.get_or_init(|| Mutex::new(HashMap::new())) }
pub(super) fn take_transport(attempt_id: &str) -> Result<Option<MessagesClient>> {
    transports().lock().map(|mut map| map.remove(attempt_id)).map_err(|_| failure("fixture transport unavailable"))
}

pub struct FixtureSession { session: ModelClientSession, thread: ThreadId }
impl FixtureSession {
    pub fn new() -> Self {
        let thread = ThreadId::new();
        let provider = ModelProviderInfo { name:"Synthetic Messages fixture".into(), wire_api:WireApi::Messages,
            ..Default::default() };
        let client = ModelClient::new(None, AgentIdentityAuthPolicy::JwtOnly, thread, provider, SessionSource::Cli,
            "inquello-synthetic-fixture".into(), None, true, false, false, false, None, false, false, None,
            HttpClientFactory::new(OutboundProxyPolicy::ReqwestDefault),
            codex_model_provider::WorkspaceRoutingContext::new("https://chatgpt.com/backend-api".into()), Vec::new());
        Self { session:client.new_session(), thread }
    }
    #[allow(clippy::too_many_arguments)]
    pub async fn stream(&mut self, context: AttemptContext, endpoint: &str, certificate_der: &[u8],
        history: Vec<ResponseItem>, tools: Vec<Tool>) -> Result<ResponseStream> {
        if context.binding.authority_basis != "synthetic-fixture-only" || context.binding.route_id != "claude-api-key" {
            return Err(failure("non-synthetic fixture invocation refused"));
        }
        let client = MessagesClient::fixture_from_der(endpoint, certificate_der).map_err(failure)?;
        let attempt = context.binding.attempt_id.clone();
        let mut prompt = Prompt { input:history, ..Default::default() };
        let mut specifications = Vec::new();
        for tool in tools {
            specifications.push(ToolSpec::Function(ResponsesApiTool { name:tool.name, description:tool.description,
                strict:false, defer_loading:None, parameters:serde_json::from_value(tool.input_schema)
                    .map_err(|_| failure("invalid fixture tool schema"))?, output_schema:None }));
        }
        prompt.tools = Arc::from(specifications);
        // No capability proof is installed: only this in-process test handle is bound.
        bind_attempt(&self.thread.to_string(), context).map_err(failure)?;
        { let mut map = transports().lock().map_err(|_| failure("fixture transport unavailable"))?;
          if map.len() >= 64 || map.contains_key(&attempt) { return Err(failure("fixture transport capacity")); }
          map.insert(attempt.clone(), client); }
        let model:ModelInfo = serde_json::from_value(json!({
            "slug":"claude-sonnet-5-5","display_name":"Synthetic Messages fixture","description":"Fixture only",
            "default_reasoning_level":"medium","supported_reasoning_levels":[],"shell_type":"shell_command",
            "visibility":"list","supported_in_api":true,"priority":1,"upgrade":null,"model_messages":null,
            "support_verbosity":false,"default_verbosity":null,"apply_patch_tool_type":null,
            "truncation_policy":{"mode":"bytes","limit":10000},"supports_image_detail_original":false,
            "context_window":32000,"auto_compact_token_limit":null,"experimental_supported_tools":[]
        })).map_err(|_| failure("fixture model metadata invalid"))?;
        let telemetry = SessionTelemetry::new(self.thread, "claude-sonnet-5-5", "claude-sonnet-5-5", None, None, None,
            "inquello-synthetic-fixture".into(), false, "fixture".into(), SessionSource::Cli);
        let metadata = crate::responses_metadata::CodexResponsesMetadata::new(uuid::Uuid::new_v4().to_string(),
            self.thread.to_string(), self.thread.to_string(), "fixture-window".into());
        let result = self.session.stream(&prompt, &model, &telemetry, None, ReasoningSummary::None, None,
            &metadata, &InferenceTraceContext::disabled()).await;
        // Any refusal before transport selection must not leave a reusable fixture handle.
        let _ = take_transport(&attempt);
        cancel_bound_attempt(&self.thread.to_string());
        result
    }
}
impl Default for FixtureSession { fn default() -> Self { Self::new() } }

// Real retained-Task fixture seam. This supplies transport only; the ordinary
// Task coordinator still owns identity, journal, idle turn, tools and accounting.
// Consumed fixture attempts can never fall through to the paid provider endpoint.
static REQUIRED_TASK_ATTEMPTS: OnceLock<Mutex<std::collections::HashSet<String>>> = OnceLock::new();
pub fn bind_task_transport(binding:&Binding,endpoint:&str,certificate:&[u8])->Result<()> {
    binding.validate().map_err(failure)?;
    #[cfg(debug_assertions)]
    if binding.route_id=="codex-responses" {return bind_responses_transport(binding,endpoint,certificate);}
    if binding.route_id!="claude-api-key" {return Err(failure("retained Task fixture requires a supported route"));}
    let client=MessagesClient::fixture_from_der(endpoint,certificate).map_err(failure)?;
    let mut required=REQUIRED_TASK_ATTEMPTS.get_or_init(||Mutex::new(std::collections::HashSet::new())).lock().map_err(|_|failure("fixture unavailable"))?;
    if required.len()>=128 || !required.insert(binding.attempt_id.clone()){return Err(failure("fixture attempt reused or capacity reached"));}
    transports().lock().map_err(|_|failure("fixture transport unavailable"))?.insert(binding.attempt_id.clone(),client);
    Ok(())
}
pub(super) fn task_transport_required(attempt:&str)->bool {
    REQUIRED_TASK_ATTEMPTS.get().is_some_and(|set|set.lock().map(|set|set.contains(attempt)).unwrap_or(true))
}

/// One-use no-auth transport, only for an exact retained Responses attempt.
/// This changes transport, not the ordinary request encoder/parser/tool runtime.
#[cfg(debug_assertions)]
#[derive(Clone)]
pub(crate) struct ResponsesTransport { pub(crate) endpoint:String, pub(crate) client:codex_http_client::HttpClient }
#[cfg(debug_assertions)]
static RESPONSE_TRANSPORTS:OnceLock<Mutex<HashMap<String,(Binding,ResponsesTransport)>>>=OnceLock::new();
#[cfg(debug_assertions)]
static RESPONSE_REQUIRED:OnceLock<Mutex<std::collections::HashSet<String>>>=OnceLock::new();
#[cfg(debug_assertions)]
pub fn validate_responses_transport(endpoint:&str,certificate:&[u8])->Result<()> {
    responses_transport(endpoint,certificate).map(|_|())
}
#[cfg(debug_assertions)]
fn responses_transport(endpoint:&str,certificate:&[u8])->Result<ResponsesTransport> {
    let url=reqwest::Url::parse(endpoint).map_err(|_|failure("invalid Responses fixture endpoint"))?;
    if url.scheme()!="https" || !matches!(url.host_str(),Some("127.0.0.1"|"[::1]"))
        || url.path()!="/v1/responses" || url.query().is_some() || url.fragment().is_some()
        || !url.username().is_empty() || url.password().is_some() || certificate.len()>8192 {
        return Err(failure("only pinned literal-loopback Responses TLS fixture is permitted"));
    }
    let cert=reqwest::Certificate::from_der(certificate).map_err(|_|failure("invalid fixture CA"))?;
    let client=reqwest::Client::builder().https_only(true).no_proxy().redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never()).add_root_certificate(cert).timeout(std::time::Duration::from_secs(30))
        .build().map_err(|_|failure("fixture transport unavailable"))?;
    Ok(ResponsesTransport {endpoint:endpoint.into(),client:codex_http_client::HttpClient::new_without_request_logging(client)})
}
#[cfg(debug_assertions)]
fn bind_responses_transport(binding:&Binding,endpoint:&str,certificate:&[u8])->Result<()> {
    let client=responses_transport(endpoint,certificate)?;
    let mut required=RESPONSE_REQUIRED.get_or_init(||Mutex::new(std::collections::HashSet::new())).lock().map_err(|_|failure("fixture unavailable"))?;
    if required.len()>=128 || !required.insert(binding.attempt_id.clone()) {return Err(failure("Responses fixture attempt reused or capacity reached"));}
    RESPONSE_TRANSPORTS.get_or_init(||Mutex::new(HashMap::new())).lock().map_err(|_|failure("fixture unavailable"))?.insert(binding.attempt_id.clone(),(binding.clone(),client));
    Ok(())
}
#[cfg(debug_assertions)]
pub(crate) fn take_responses_transport(binding:&Binding)->Result<Option<ResponsesTransport>> {
    let required=RESPONSE_REQUIRED.get().is_some_and(|set|set.lock().map(|set|set.contains(&binding.attempt_id)).unwrap_or(true));
    if !required {return Ok(None);}
    if binding.route_id!="codex-responses" {return Err(failure("fixture route mismatch"));}
    let (expected,transport)=RESPONSE_TRANSPORTS.get_or_init(||Mutex::new(HashMap::new())).lock().map_err(|_|failure("fixture unavailable"))?
        .remove(&binding.attempt_id).ok_or_else(||failure("Responses fixture consumed; production fallback forbidden"))?;
    if expected!=*binding {return Err(failure("Responses fixture exact attempt binding changed"));}
    Ok(Some(transport))
}
