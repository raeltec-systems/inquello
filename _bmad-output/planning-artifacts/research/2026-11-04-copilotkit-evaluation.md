# CopilotKit for Inquello — evaluation (2026-11-04)

Research only: no repository files changed, nothing installed. CopilotKit was read from the published npm artefacts (`@copilotkit/react-core@1.84.1`, `@copilotkit/core@1.84.1`, `@ag-ui/client@1.0.3`, via unpkg) and docs.copilotkit.ai; the GitHub repo itself is blocked from this session. The Electron app was not launched (no display, no built engine); the gap analysis is from the renderer source on `feat/epic-1-secure-private-desktop`.

**Bottom line:** do not adopt CopilotKit. Its value is a chat-and-tool-call UI wired to its own runtime over HTTP; Inquello's value is a truthful, authorized projection of Codex app-server work rendered through named preload operations. The parts of CopilotKit that would close real gaps (markdown, live updates, Codex-style work grouping) are small, third-party pieces Inquello can take directly. Details and the proof that would overturn this are below.

## 1. The target experience

Verified from the planning docs:

- PRD (`prds/prd-inquello-2026-10-26/prd.md:23`): "the broad working experience Codex gives developers: bring existing work, request an outcome, steer the agent's work, inspect the result and continue."
- EXPERIENCE.md "Inspiration & Anti-patterns" (l.180–184): "a quiet working area where the artifact, evidence and review are prominent; the source question/plan/agent/diff patterns preserve the Codex-derived experience." Forbidden: decorative confidence, colour-only status, Stop marking steps done, toast-only success, "accepted" for an automated check.
- Voice (l.50–66) and UX-DR47 (`epics.md:373`): terse, factual, sentence case; never "Everything looks good", generic "Approve", "Delivered" from a toast.
- UX-DR51 (`epics.md:377`): one visual language must keep five meanings apart: permission to execute, proposed/applied edit, human review decision, Professional Approval, Delivery.
- UX-DR24/29/49 (`epics.md:344, 352, 375`): ApprovalCard names the actual action; Composer carries FileChip context and scope/method/environment/reasoning controls; accessibility floor (landmarks, live announcements, 4.5:1, reduced motion, 24px targets).
- Owner decisions of 2026-11-04 (commits `f70260a`, `3d385b7`; `spec-1-15…:82`): Codex desktop pattern — live status in the sidebar, neutral "Finished · worked for …" line, model/reasoning/environment in the composer footer, usage in Settings, inline notices.

So the target is Codex desktop's calm transcript (user turn, collapsible activity, a result, a quiet end-of-turn line) with ChatGPT-grade reading comfort (rendered markdown, tables, code, smooth live updates), minus every piece of theatre. It is not a generic copilot widget.

## 2. The gap today (renderer code)

Verified:

1. **Agent text is plain text.** `Shell/ConversationItems.tsx:39–44` renders every message as `<p className="iq-progress-text">{item.text}</p>`. No markdown, lists, tables or code blocks. For an audit assistant that answers in tables, this is the single biggest visible difference from ChatGPT/Codex.
2. **No live streaming in the renderer.** `Shell/task-observation.ts` polls `tasks.progress` every 1,500 ms plus invalidation on `onProgressChanged`; main only *invalidates* on `item/agentMessage/delta` (`main/tasks/service.ts:184`). Text appears in snapshot jumps. The sidebar status (`TaskLifecycle.tsx:21–23`) is the only continuous "working" signal.
3. **Work activity is a flat list of `<details>` rows** ("Command / Tool activity / File change", `ConversationItems.tsx:56–65`), adapted from t3code's WorkLog (`desktop/THIRD_PARTY_NOTICES.md`). Codex groups a turn's activity and collapses it; Inquello shows each row at full weight, each with its own live-edge scroller.
4. **The transcript still reads as an inspector**, despite `TaskView.tsx:205` ("Ordinary chat is a transcript, not a runtime inspector"): "Current results" with First/Previous/Next paging buttons, "Previous result versions", "Evidence for … page", an "About tool output and verification" disclosure, and multi-sentence caveats (`TaskProgress.tsx:95–96, 113–125`). The domain needs these facts; the presentation needs to be Codex-quiet.
5. **Questions** (`TaskProgress.tsx:16–36`) are bare fieldsets with a disclaimer sentence.
6. **Composer** (`Shell/Composer.tsx:86–111`) is textarea + permanent "Shift+Enter" hint + send/stop; no FileChip attachments, no suggestions, no welcome prompts (UX-DR29/33).
7. **Permission cards** are good and truthful (`PermissionRequests.tsx:5–11, 156–170`); they are polled every 1 s (`:28`).
8. **No artifact area content** yet (`ArtifactArea.tsx:3–9`).

Inference: items 1–4 are what makes Inquello feel "short of Codex/ChatGPT"; 5–8 are scope not polish.

## 3. CopilotKit, as it actually is

Verified facts:

- **Shape.** `@copilotkit/react-core@1.84.1` (published 2026-11-04, MIT, React `^18 || ^19`). v1 is deprecated; the current surface is `@copilotkit/react-core/v2` (`CopilotKitProvider`, `CopilotChat`, hooks) with a `/v2/headless` entry (`useAgent`, `useFrontendTool`, `useHumanInTheLoop`, `useInterrupt`, `useRenderToolCall`, `useThreads`; `dist/v2/headless.d.mts:1008`). A `2.0.0-rc.29` train is being cut the same day (npm time log): the API is moving.
- **Transport.** `CopilotKitCoreConfig` (`@copilotkit/core dist/index.d.mts:2189–2229`): `runtimeUrl`, `runtimeTransport` (REST default), `headers`, `credentials`, and `agents__unsafe_dev_only: Record<string, AbstractAgent>` documented as "For development only - production requires CopilotRuntime". Docs (self-hosting): direct agent connections are "intended for development and prototyping … not officially supported". In code, `useAgent` resolves a locally registered agent via `copilotkit.getAgent()` and reports `isReady: true` without any runtime (`dist/v2/headless.mjs`), and no `/info` fetch happens without `runtimeUrl` (`fetchRuntimeInfo`, `core.d.mts:370`).
- **Agent contract.** `@ag-ui/client` `AbstractAgent` (`dist/index.d.ts:532–593`): implement `run(input): Observable<BaseEvent>` emitting AG-UI events (RUN_STARTED, TEXT_MESSAGE_*, TOOL_CALL_*, STEP_*, STATE_SNAPSHOT/DELTA, RUN_FINISHED).
- **Rendering model.** Tool renderers get `status: "inProgress" | "executing" | "complete"` and `result: string` (`headless.d.mts:848–869`). `useHumanInTheLoop` gives `render({args, status, respond})`; the approval UI is developer-rendered. `useInterrupt` is LangGraph-only.
- **UI stack.** The v2 chunk imports `streamdown`, `react-markdown`, `@radix-ui/{popover,tooltip,dropdown-menu,slot}`, `lucide-react`, `@tanstack/react-virtual`, `use-stick-to-bottom`, `@a2ui/web_core`, `@copilotkit/web-components/threads-drawer` (Lit), `@copilotkit/mcp-apps-renderer`. Styling is Tailwind v4 (`dist/v2/index.css`, 95 KB, preflight scoped to `[data-copilotkit]`, 76 `--cpk-*` variables, slot overrides merged with `twMerge`). Package dependencies also pull `katex`, `recharts`, `lit`, `@jetbrains/websandbox`, `@copilotkit/web-inspector` (7.3 MB) and a `maplibre-gl` peer; unpacked size 12.9 MB.
- **Accessibility.** Across ~830 KB of UI code: 28 `aria-label`, 24 `aria-hidden`, 6 `aria-live`, 1 `sr-only`, roles `status`/`dialog`/`listbox`/`option`; `prefers-reduced-motion` present. No conformance statement found.
- **Network and telemetry.** Frontend `fetch` sites: audio transcription (`{runtimeUrl}/transcribe`) and a Copilot Cloud `/ciu` poll keyed on `publicApiKey`. Docs: telemetry is metadata-only, sent by the runtime and the Inspector (random browser ID in localStorage), disabled by `COPILOTKIT_TELEMETRY_DISABLED`. `@scarf/scarf` (install-time analytics, `postinstall: node ./report.js`) is a dependency of react-core and runtime; `@segment/analytics-node` and `@copilotkit/license-verifier` come via `@copilotkit/shared`. Licence keys are only for Intelligence/cloud features.
- **CopilotRuntime** itself depends on `graphql-yoga`, `hono`, `openai`, LangChain peers, `@segment/analytics-node`, `@copilotkit/license-verifier` (npm `@copilotkit/runtime@1.84.1`).

## 4. Hard constraints

| Constraint | Finding | Verdict |
|---|---|---|
| Runtime topology | Supported path is UI → HTTP/SSE → CopilotRuntime → agent. Inquello's renderer has `default-src 'none'` and no `connect-src` (`renderer/index.html:5`), is sandboxed (`main/main.ts:260`), and reaches main only via the 77 named operations (`security/operations.ts:63–77`). Hosting CopilotRuntime inside main and opening an HTTP port to the renderer would breach AD-5 and the CSP. The only compatible path is the "dev only / unsupported" `agents__unsafe_dev_only` with a custom `AbstractAgent` bridged over `tasks.*`/`permissions.*`. | Works in code, unsupported by vendor. |
| Renderer sandbox | UI packages make no network calls unless `runtimeUrl`, `publicApiKey` or transcription are used. Styles ship as a CSS file (fine under `style-src 'self'`); no `<style>` injection found. Unverified: Lit web components (threads drawer, inspector) under this CSP. | Probably OK; verify. |
| Data and telemetry | Nothing leaves the device from the React UI with no runtime, no `publicApiKey`, Inspector off. Install-time scarf ping and Node analytics packages in the dependency tree must be audited for Story 1.12's data-policy register. | Manageable, adds audit surface. |
| Truthfulness | Tool status collapses to `inProgress/executing/complete` with a string `result`; Inquello needs running/completed/failed/cancelled/proposed/unknown plus "Execution ended — outcome unconfirmed" (`ConversationItems.tsx:33–37`) and five authority meanings. Every default view would have to be replaced through slots; HITL is "LLM calls a frontend tool", not Codex `serverRequest` approvals with user rules. | Achievable only by replacing most of the UI. |
| Licence/maturity/fit | MIT. 1,191 npm versions, v1 deprecated, 2.0 RCs landing daily, docs pages 404 or disagree on the provider's name. React 19 OK. Tailwind-token theming vs Inquello's 152 CSS custom properties and `iq-*` classes (`design/tokens.css`); IBM Plex via `--cpk-font-sans`. A11y well below UX-DR49. | Poor fit. |

## 5. Opportunities, limitations, options

**Opportunities (ranked by value to the target experience):**
1. Rendered markdown for agent messages (CopilotKit uses `streamdown`/`react-markdown`). Closes gap 1. Replace `ItemContent` for `kind === 'message'`.
2. Live text updates and stick-to-bottom scrolling (`use-stick-to-bottom`). Closes gap 2; needs main to push deltas or a faster bounded read for the open Task only.
3. Codex-style tool-call grouping (`CopilotChatToolCallGroup` pattern): one collapsed "activity" group per turn, headed by the neutral "Finished · worked for …" line. Closes gap 3; replaces the per-row `<details>` list.
4. Suggestions/welcome and attachments UI patterns for S01 (UX-DR33) — scope, not CopilotKit-specific.

**Limitations:** unsupported no-runtime path; AG-UI message model has no place for Inquello's results/judgment/checks/evidence/revision history, plan evidence links or permission cards (all would be custom renderers); heavy dependency tree in a renderer that today has only React; a11y and theming redo; 125 test files and the smoke probe's 105 `data-*` selectors assume today's DOM; a moving 2.0 API.

**Options:**
- (a) Adopt CopilotKit UI wholesale — **No.** It replaces the truthful domain presentation with a generic chat and still needs an unsupported adapter.
- (b) Headless hooks over Inquello's bridge — **No.** `useAgent` would give back a message store Inquello already has as an authorized, bounded snapshot (`tasks-bridge.ts:4–10`); the adapter (snapshot → AG-UI events) is pure cost.
- (c) Borrow patterns, keep Inquello's primitives — **Yes.** Markdown rendering with `react-markdown` + `remark-gfm` + `rehype-sanitize` (or `streamdown`) styled by `iq-*` tokens; `use-stick-to-bottom` or the existing `WorkLogDetails` live-edge logic lifted to the thread; grouped activity; the `inProgress/executing/complete` idea generalised to Inquello's richer status set.
- (d) assistant-ui — `@assistant-ui/react@0.15.32` (MIT, 2026-10-28, Radix-based primitives) has an `ExternalStoreRuntime` that needs no backend and models tool approvals (`onRespondToToolApproval`). Architecturally a better fit than CopilotKit for a no-backend desktop, but still a 0.x API, still a message-model mapping, still a re-theme. Only worth revisiting if the owner later wants a full chat kit rather than the three targeted fixes.

## 6. Recommendation and smallest proof

**Recommendation:** option (c). Spend the next UI effort on the three gaps that actually separate Inquello from Codex/ChatGPT — rendered markdown, live message updates, collapsed per-turn activity — plus quieting the results section into the transcript (details behind one disclosure, JudgmentTag results inline). Keep ApprovalCard, PlanSteps, the composer footer and the sidebar status as they are; they already implement the owner's Codex-desktop decisions. Be willing to delete `ConversationItems.tsx`'s row model and the paging UI in `TaskProgress.tsx` in favour of a transcript-first layout; none of that code is load-bearing for authority — main's projections are.

**Smallest proof that would overturn this (if the owner still wants CopilotKit tested), about two days:**
1. Write `InquelloAgent extends AbstractAgent` whose `run()` turns `tasks.progress` snapshots (and `permissions.pending`) into AG-UI events, emitting only what main authorized.
2. Mount `CopilotKitProvider` with `agents__unsafe_dev_only`, no `runtimeUrl`, no `publicApiKey`, Inspector off, inside the sandboxed renderer under the unchanged CSP; render `CopilotChat` with the assistant-message, tool-call and input slots replaced by Inquello components.
3. Go only if all hold: zero network requests and zero CSP violations in a smoke run; the five authority meanings and "outcome unconfirmed" render without any CopilotKit default view; the permission flow needs no fake frontend tool; the existing shell tests and smoke probe pass with fewer than ~30 selector changes; renderer bundle grows by less than 1 MB gzipped; a11y announcements match today's single polite live region. If any fails — my expectation is that 2, 3 and 5 fail — stop, keep the markdown/scroll/grouping work, and record the spike under deferred work.

Scratch material (declaration files and chunks read for this report): `/tmp/claude-0/-home-user-inquello/32c063d9-b20b-55c4-a365-3239c76b4724/scratchpad/ckit.II2Q/`.
