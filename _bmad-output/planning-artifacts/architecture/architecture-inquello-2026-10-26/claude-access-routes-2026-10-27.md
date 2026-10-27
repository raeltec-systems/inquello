# Claude access routes and compatibility decision — 2026-10-27

**Owner-selected direction; implementation and eligibility unproven.** User message `Sentinel_1ee4b9e93af48191bd5a2f035d7b74c6`: Claude subscription login if Anthropic allows it, and API-key access. This closes the product preference for the initial additional provider route, not permission to run paid requests, handle/store credentials, accept new terms, install software or deploy anything.

## Route states

| Route | Current decision and boundary |
| --- | --- |
| Claude direct API with API key | Selected additional initial inference route alongside the inherited default. Implement through supported Anthropic API authentication, subject to the actual adapter, key-owner/account entitlement, model/version and processing policy. No API call or secret handling occurred. |
| Custom Claude.ai subscription sign-in inside Inquello's Codex-derived harness | Not enabled. Owner desire is conditional on permitted use; it is not permission to collect/reuse native-app tokens. Obtain explicit Anthropic approval for this custom integration before promising or implementing it. |
| Unmodified official Claude Code as a separately integrated executable | Conditional candidate, not the current runtime architecture. Assess the documented conditions and the distinct process/auth/tool/history/permission boundaries before proposing it. Do not silently replace the retained Codex engine or treat its OAuth as a general inference credential. |
| Eligible plan credits used through API keys | Billing possibility, not a second authentication architecture. Verify actual plan and Console eligibility; never assume this user or a customer qualifies. |

## Official policy evidence

Anthropic's [legal/compliance documentation](https://code.claude.com/docs/en/legal-and-compliance) directs custom products to API keys or supported providers and prohibits third-party Claude.ai login/token intermediation. It separately permits offering the **unmodified Claude Code binary** under its commercial terms and conditions: retain its authentication choices, let users authenticate in its own flow with their own credentials, and do not resell or intermediate their usage. Branding conditions also apply. This does not automatically make subscription authentication available to Inquello's own model client.

The [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) requires prior approval for third-party Claude.ai login/subscription-limit use. Product billing descriptions are not substitutes for integration permission. No outreach to Anthropic or agreement acceptance occurred.

Anthropic documents [API-key authentication](https://platform.claude.com/docs/en/manage-claude/authentication) and the [Messages endpoint](https://platform.claude.com/docs/en/api/messages/create). The observed API reference displays version `2026-10-21` and `POST /v1/messages`; it is a versioned Messages protocol, not evidence of OpenAI Responses compatibility. Pin the selected API/model version during the adapter design and test that version rather than copying old wire assumptions.

[Monthly API-credit guidance](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans) describes eligible Max/Team credits claimed into a Console organisation for API-key usage. This is separate from reusing subscription OAuth or assuming subscription limits fund API traffic. No plan, credit balance or entitlement was verified here.

Sources checked 2026-10-27. Recheck before enabling a route or making customer promises.

## Actual inherited runtime inspection

The repository is a planning checkout, not an implemented Inquello runtime. Inspected the same public Codex evidence revision already cited by the architecture, `970111f6cb62cc02fe36a82ea7d71b37a2889c97`:

- [`codex-rs/model-provider-info/src/lib.rs`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/model-provider-info/src/lib.rs), blob `7e635a392d244c419c897629f0f24410d1ac21a0`: `WireApi` exposes `Responses`; deserialization rejects unsupported variants. Configurable providers are Responses-compatible. Its built-in catalog contains OpenAI, supported cloud routes and local OSS entries, not a direct Anthropic Messages adapter.
- [`codex-rs/core/src/client.rs`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/client.rs), blob `99550cb20c42e35db54bdc7f7d3aa11014577875`: the inspected client header/imports describe Responses requests, stream types, WebSocket continuation and provider ownership. These are not evidence of Messages wire compatibility.

**Conclusion:** changing a base URL or inserting an Anthropic key is not a demonstrated compatible route at this pin. The provider preference is settled; the protocol seam still needs explicit engineering design. The actual delivery fork cut may differ and must be checked again. Existing Bedrock/GCP entries do not prove arbitrary Claude support merely because those platforms offer Claude elsewhere.

## Adapter implementation contract — CR-1 resolved at design level

**Architecture decision:** implement an Inquello-owned direct Anthropic Messages adapter behind the retained Codex model-client boundary. Reuse the existing engine, tool executor, permission checks and audit domain; introduce a provider-dispatch branch at the selected cut where required. Do not route through a third-party translating gateway and do not replace the harness with Claude Code. Those would be new architecture/processing decisions. Exact filenames at a later fork cut may move; the ownership and wire contract below may not diverge silently.

### Ownership and boundaries

- `inquello-adapters` owns the Anthropic request/stream/auth translator and provider capability declaration. The shared audit domain owns source/permission/run authority; the retained runtime owns agent turns, tool execution and conversation persistence. The client/UI consumes the same normalized work events regardless of provider.
- The integration seam is the session/turn model-dispatch boundary identified by the inspected `ModelClient`/`ModelClientSession` in `core/src/client.rs`. Add a distinct Messages route dispatch and provider definition as a focused fork modification, rather than force Messages through `WireApi::Responses`. Provider adapter must not execute tools itself, create human decisions or write domain state directly.
- A provider-independent normalized contract is owned with the Inquello runtime facade, versioned alongside its generated client schemas. The native Responses and new Messages adapters satisfy it; no independently invented Anthropic-only UI state or audit semantics.

### Canonical request and history

Each request binds `schema_version`, `task_id`, `run_id`, `turn_id`, `attempt_id`, selected `route_id`, account identity reference, exact model/API-version identifiers, authorized context/basis revision, ordered messages, tool schemas, output limits, supported reasoning settings, and cancellation handle. Credentials are injected only by the trusted provider-auth adapter, outside this model-visible request record.

Messages retain ordered content blocks with role/origin and trust boundaries: trusted instructions, user input, assistant output, tool request and tool result. Tool-result text remains untrusted evidence, never promoted to system instruction. The Messages translator maps supported roles/content to the selected Anthropic API version and handles top-level system instructions deliberately. Retain stable local message/tool identities plus provider IDs; do not invent OpenAI `previous_response_id`, WebSocket prewarm or remote memory support.

A tool request is `{tool_call_id, tool_name, arguments_json}` and a tool result is `{tool_call_id, status, content_blocks, error_kind?}`. The runtime's tool executor validates schema and current permission before execution. Duplicate/missing IDs, malformed complete JSON or mismatched results fail the affected turn with diagnostics; partial streamed JSON never triggers a tool. Batching/parallel calls must preserve each ID and actual result. Retried inference cannot execute an already completed tool a second time merely because its output is requested again.

### Normalized events and outcomes

Every event carries local turn/attempt identity, monotonically increasing sequence within the attempt, and provider request/message ID when supplied. The adapter emits:

- `started`: route, model/API version and accepted provider request identity; never interpreted as task success.
- `text_delta`: attributable visible output only, accumulated in order; incomplete output remains labelled partial until terminal outcome.
- `tool_arguments_delta`: buffered opaque partial tool arguments; not executable.
- `tool_request_ready`: one complete parsed and schema-checked request, handed to the existing tool-permission boundary.
- `usage_update`: reported input/output/cache token categories and any supplied cost attribution with origin; unavailable values stay unknown, never fabricated zero or a subscription entitlement.
- `completed`: explicit normalized stop reason (`end_turn`, `tool_requests`, `output_limit`, `refused`, `cancelled`, `error`) and exact provider reason retained. Only `end_turn` completes model output; it never confers audit acceptance.
- `failed`: normalized error category (`auth`, `rate_limit`, `credit_limit`, `invalid_request`, `unsupported_capability`, `provider_unavailable`, `transport`, `malformed_stream`, `cancelled`) with safe retryability and provider diagnostic reference.

Unknown protocol events are retained only as safe technical diagnostics and cannot produce tool execution or a successful terminal state. Unknown required message/tool semantics fail explicitly. Once a terminal event is accepted, late events cannot reopen the attempt. Error and usage normalization must preserve partial output/consumption and distinguish request rejection from uncertain provider completion.

### Features, cancellation and recovery

Text, tool requests/results and required history reconstruction are the initial baseline. Supported images are enabled only with an explicit content mapping and the selected model's capability declaration, exercised when the image-input story is introduced. Structured outputs, prompt caching and reasoning controls are mapped per API/model contract or shown unsupported; no silently ignored settings. Provider-required opaque reasoning/signature blocks are retained only as required protocol state under runtime data policy, never presented as audit evidence or reconstructed from model prose.

Cancellation closes the local stream, asks the transport/provider to stop where supported, and marks subsequent results unusable. It does not assert that remote computation stopped instantly or billing was reversed. Current permission/revocation checks still run before dispatch and before result use; in-flight stale results are suppressed under SC-5. Account/route switch terminates the old attempt and clears provider-owned continuation state; permitted history is re-encoded for the newly selected route only after an explicit route change.

For a retry, preserve the logical turn and allocate a new `attempt_id`, recording every potentially billed attempt. Reconcile any actual tool effects before replay. No exactly-once inference guarantee, silent provider fallback, subscription-token substitution or automatic local-model fallback. On incompatible history or unsupported blocks, fail with the offending capability and preserve the draft rather than losing evidence or coercing it into a false equivalent.

### Build and acceptance work, not pre-build proof

Story 1.22 implements this adapter and its schema fixtures at the selected cut. Tests cover tool ID/stream ordering, malformed/partial tool arguments, usage/error fidelity, cancellation, account switch, history limits, unsupported settings and revocation during a response. Story 1.25 then exercises actual configured inference with synthetic content under separately authorized credentials/usage. These tests are required acceptance work; their not having run is not itself a planning-readiness failure.

API version `2026-10-21` is the observed current seed; implementation pins the intentionally selected supported version and model IDs after compatibility review, recording deviations. Ordinary patch/library/model configuration is engineering work, not an unresolved product preference. No API calls, software install or implementation occurred in this planning run.

## Story placement and readiness

- **Story 1.22** owns implementation of the selected initial Claude API-key adapter under CR-1. The original initial route configuration and separate per-route evidence remain; no extra unapproved provider is substituted.
- **Story 1.25** still requires actual agent execution on a configured synthetic-approved route. Fake responses do not complete it. Owner approval of the route does not authorize paid execution now.
- **Story 9.10** retains later Claude capability expansion and regressions; it does not duplicate the initial adapter if already supplied. Subscription integration stays explicitly conditional and separately assessed rather than becoming a hidden prerequisite for the API-key route.
- **Planning versus proof:** provider selection and CR-1 ownership/normalization are recorded. Actual adapter build/live inference tests and provider/service eligibility are implementation/enablement work, not missing architecture by themselves. Assess the first 84-story synthetic build plan separately from production and later-policy gates; no smaller increment is silently substituted.

The next bounded technical step is implementation against this contract only when separately authorized, not another owner choice about protocol mapping. No implementation was performed by this planning pass; sprint tracking status is reported separately.
