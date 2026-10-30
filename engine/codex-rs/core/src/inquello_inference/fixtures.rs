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
