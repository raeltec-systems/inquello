---
title: 'Story 1.20: Authorize specific actions without granting professional approval'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-18-inspect-effective-managed-policy.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-19-bound-tool-reads-writes-network.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.19 records an escalation and declines it, but nobody can see or decide it. There are no command rules, and the inherited automatic approval reviewer is uncontrolled. Permission to act could be confused with review or Professional Approval (FR-33, C66, C69, AD-11, UX-DR24, UX-DR51).

**Approach:**
- **Command rules:** add allow, prompt and forbid rules on command prefixes, using the engine's inherited exec-policy matching. Rules come from the Workspace execution policy plus the user's own rules, which can only make things stricter. The most restrictive match wins, and every decision names the controlling rule.
- **ApprovalCard:** present each pending permission request as an ApprovalCard (the Story 1.8 primitive). It shows the exact action, content or command, destination and consequences, and the permitted alternatives. Its primary button names the action.
- **Denial:** a denial performs nothing, widens nothing and preserves unresolved work.
- **Automatic reviewer:** controlled by a Workspace policy switch, off by default. When on, it is bounded by the same sandbox and policy, and its decisions are labelled "Automated permission review".

**Owner decisions (2026-10-29):**
- **Rule sources:** Workspace administrators set command rules in the execution policy. A user may add personal rules that only prompt or forbid, never allow. Each decision names the rule and its source.
- **Automatic reviewer:** a Workspace policy switch, off by default. When it is on, it runs under the same sandbox and policy, cannot widen access, and is labelled "Automated permission review". It becomes usable only once a processing route exists (Story 1.22). Until then, an enabled switch reports "Not available: no processing route".

## Boundaries & Constraints

**Always:**
- **Rules:**
  - Each rule is `{prefix: [tokens], decision: allow|prompt|forbid, note?}`.
  - **Workspace rules:** an optional `execution.command_rules` list, validated (non-empty tokens; no shell metacharacters treated as patterns).
  - **User rules:** prompt or forbid only. They are stored as a per-principal, versioned record in the working store, with operation IDs, expected revision and receipts. An `allow` user rule is refused with `user_rule_cannot_allow`.
  - **Matching:** the engine's exec-policy prefix matching. Among matching rules the order is forbid > prompt > allow. With no match, the effective approval behaviour (Story 1.18) decides.
  - **Sandbox stays on:** an allowed command still runs inside the Story 1.19 profile. Allow never lifts the sandbox.
- **Decision record:** every evaluated command yields `{decision, controlling_rule, source: workspace_policy(rev) | user_rule(version) | approval_behaviour, analysis}`. The `analysis` describes the action and destination in plain words, for example "Runs `git push origin main`, which contacts github.com".
- **ApprovalCard (UX-DR24), one per pending request:**
  - **Label:** "Permission to act". Never "Approval", "Review" or "Professional Approval".
  - **Content:** the exact command or content, quoted. Its destination (path boundary or host). Its consequences (what changes, and whether it is reversible). The controlling rule.
  - **Primary button:** the action verb, for example "Run `git push origin main`" or "Allow contact with api.example.com". Never a bare "Approve".
  - **Alternatives:** only permitted ones, never wider than the request:
    - "Deny";
    - "Deny and add a rule to always ask";
    - "Deny and forbid this prefix" (a user rule).

    No "always allow" from the card.
  - **Expiry:** a stale or expired request cannot be confirmed; it shows "This request is no longer pending".
- **Deny:**
  - The runtime receives a decline. Nothing is performed.
  - Unresolved work (other pending requests, outputs, drafts) is untouched, and the Task continues.
  - The denial is recorded on the request with its actor. A human denial sets no review or approval state.
- **Allow:**
  - Recorded as a human permission decision for that single request only: actor, time, exact command or destination, and controlling rule.
  - It never writes the Story 1.15 `review` or `approval_marker` dimensions.
- **Automatic reviewer:**
  - An `execution.automatic_permission_review` boolean, default false.
  - When true and a route exists, it is mapped to the inherited reviewer setting. Its decisions:
    - are bounded by the same profile and rules (it can never turn forbid into allow, and can never change the sandbox or allowlist);
    - are recorded with `actor_kind = automated_reviewer`;
    - are labelled "Automated permission review — not analytical review or Professional Approval".
  - When it is true but no route exists, S07 and the Task say "Automated permission review: not available (no processing route)", and requests go to the user.
- **S07 and the Task:**
  - **S07:** lists the effective command rules with their sources, and the reviewer state.
  - **Task:** pending ApprovalCards sit in the contextual review area (Story 1.16), are announced once, and are reachable by keyboard.
  - **Settings:** the user's own rules can be added and removed there, prompt or forbid only.
- **Verification source:** since there are no model runs before Story 1.25, requests in this story come only from `inquello/tools/exec` (Story 1.19) commands that match prompt rules or need escalation. The same request path must serve model-originated requests in Story 1.25.

**Never:**
- No bare "Approve".
- No "always allow" from an ApprovalCard.
- No user allow rules.
- No permission decision writing review or approval states.
- No reviewer widening access.
- No model runs.
- No new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prompt rule | Exec matches a Workspace `prompt` rule | ApprovalCard with the exact command, destination, consequences and rule; button "Run …" | N/A |
| Allow | User confirms | Runs inside the sandbox profile; recorded as a permission decision only | N/A |
| Deny | User denies | Not performed; other pending work intact; Task continues | N/A |
| Forbid | Exec matches `forbid` | Refused without a card; rule and source named | N/A |
| Conflict | Workspace allow + user forbid on the same prefix | Forbid wins; source "your rule" | N/A |
| Allow in sandbox | Allowed command writes outside the profile | Sandbox denial (Story 1.19) | Boundary named |
| User allow | User adds an allow rule | Refused | `user_rule_cannot_allow` |
| Stale | Confirm after the request expired or resolved | "No longer pending"; nothing runs | N/A |
| Deny + rule | "Deny and forbid this prefix" | Denied, plus a user forbid rule recorded with a receipt | N/A |
| Reviewer off | Default policy | All requests go to the user | N/A |
| Reviewer on, no route | Switch on, no route | "Not available (no processing route)"; requests go to the user | N/A |
| Reviewer decision | Reviewer active (simulated in a unit test) | Labelled automated; cannot override forbid or widen the profile | N/A |
| No state bleed | Any permission decision | Story 1.15 review and approval dimensions unchanged | N/A |
| Other principal | Second principal reads or decides a request | Refused like unknown | No disclosure |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/execution_policy/` -- `command_rules`, `automatic_permission_review`, the user-rule record and the decision computation.
- `engine/codex-rs/execpolicy` -- the inherited prefix-rule engine; reuse it.
- `engine/codex-rs/inquello-adapters/` -- migration `0005` for user rules and permission decisions, plus races.
- The app-server inquello processor and protocol:
  - user-rule read and set;
  - pending requests list and decide;
  - exec-policy wiring for `inquello/tools/exec`;
  - mapping the reviewer setting.
- `desktop/src/main/policy/` -- request mediation and the decline-by-default timeout behaviour.
- `desktop/src/renderer/` -- ApprovalCards in the review area, S07 rules, the user-rules editor.
- `desktop/src/main/smoke-probe.ts` -- a `permissions` report.

## Tasks & Acceptance

**Execution:**
- [x] Domain rules, decision and records, plus policy validation, with tests for every matrix row.
- [x] Adapter migration 0005 and races.
- [x] Processor methods, the protocol, FORK-CUT patch, the regenerated protocol and stamp, and tests.
- [x] Desktop mediation, ApprovalCards, S07 and the rules editor, with jsdom and integration tests (real runtime, real sandbox).
- [x] Smoke `permissions` report:
  - a user prompt rule makes a `tools/exec` command show an ApprovalCard with an action-verb button and no "Approve";
  - Deny means nothing ran;
  - a second request is allowed and runs inside the sandbox;
  - a forbid rule is refused with its source named;
  - a user allow rule is refused;
  - review and approval states are unchanged.
- [x] `sprint-status.yaml` (1-20).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `permissions` and every earlier report are ok, and it exits 0.

## Implementation Notes

- **As built:**
  - **Domain (`inquello-domain/src/execution_policy/`):**
    - `section.rs`: `command_rules` (each `{prefix, decision, note?}`; tokens are non-empty literal command words, at most 256 bytes, without whitespace, control characters or shell and glob metacharacters (`*`, `?`, brackets, braces, `|`, `&`, `;`, `<`, `>`, `$`, the backtick, parentheses, the backslash); at most 16 tokens and 100 rules; no prefix twice; unknown fields refused) and `automatic_permission_review` (boolean). `EffectivePolicy` carries the Workspace rules and the switch (off when absent, attributed to the Inquello default).
    - `command_rules.rs`: `effective_rules` (Workspace rules first, then the person's), `evaluate_command(command, rules, matched, policy, status)`. It takes the runtime's own matches and picks forbid over prompt over allow, naming the Workspace rule on a tie. With no match, the Task's asking behaviour decides: `untrusted` asks; `on_request` and `never` allow, still inside the profile. A prompt under a mode that never asks is refused (`cannot_ask`). The decision record is `{decision, controlling_rule, source: workspace_policy(revision) | user_rule(version) | approval_behaviour, analysis, destination, consequence}`. The analysis names hosts a command gives in URLs, and whether each is on the allowed list. `ReviewerState` (`off`, `not_available`, `active`) maps to the runtime's `approvals_reviewer` (`user` unless active). `bounded_reviewer_verdict` never turns forbid (or `cannot_ask`) into allow.
    - `user_rules.rs`: the person's own rules as a per-principal versioned record (`set_user_rules`: operation ID, expected revision, receipt, R10 re-lookup). The whole list is replaced each time. An `allow` rule is `DomainError::UserRuleCannotAllow`.
    - `permission.rs`: `request_permission` (a forbidden command is never requested; TTL 1 s to 24 h), `decide_permission` and the creator-only `pending_requests` and `permission_request` (anyone else: `NotFound`). In `decide_permission`, a person allows or denies, the host only expires or denies, and the reviewer is bounded. A decided or expired request is `RequestNotPending`, and nothing is recorded. `use_permission` consumes an allowed request once, for exactly its command and Task (`PermissionNotGranted` otherwise). The module has no access to Task states.
  - **Adapters:** migration `0005_command_rules_and_permissions.sql` and `src/permissions.rs`. The schema allows one decision per request; only a person or the reviewer may allow, and only the host may expire.
  - **Host (FORK-CUT Patch 12):**
    - **Rule matching:** `matched_rules` turns each rule into a `codex-execpolicy` prefix rule through `codex_config::RequirementsExecPolicyToml`, with the rule's index in the justification. The runtime's `Policy::matches_for_command` decides which rules match; Inquello combines the matches.
    - **`inquello/tools/exec`:**
      - Forbid → `command_forbidden`, with the decision record.
      - Prompt → `permission_required`, unless `permissionRequestId` names an allowed, unused request for exactly that command.
      - Allow → runs inside the Task's profile, as before.
      - The sandbox check is now a fixed probe the processor builds (`sandboxProbeTarget`), so no rule can block it.
      - Every run writes `approvals_reviewer = "user"`.
    - **New methods:** `inquello/permissions/userRules/read|set`, `request`, `pending` and `decide`. A `human` decider is the bound principal; `automated_reviewer` is refused as `reviewer_not_available`.
    - **`inquello/policy/effective`:** gains `commandRules` and `reviewer`.
    - **Wire:** the execution-policy wire (`inquello-protocol`, `inquello-service`) now carries `command_rules`, `automatic_permission_review` and Story 1.19's `allowed_domains`.
  - **Desktop main:**
    - **`src/main/policy/permissions.ts`:** `PermissionMediator`.
      - `ask` records a request and waits for its decision. With no decision within 10 minutes it declines by default, recording `expired` as the host `inquello-desktop`.
      - `decide` records the person's decision and wakes the waiter.
      - `pending` returns the Task's cards.
      - The module also holds the card view, the forbid text and the payload validators.
    - **`PolicyService.runTool`:** on `permission_required` it asks the mediator. Only on `allowed` does it run again with the request ID. A denial or expiry returns `permission-denied` ("Denied: nothing ran." / "Not run: no one decided in time, so the request was declined."). A forbid returns `command-forbidden` with the rule and source.
    - **New `PolicyService` methods:** `pendingPermissions`, `decidePermission`, `permissionSettings` and `setUserRules`.
      - `decidePermission`: "Deny and add a rule to always ask" and "Deny and forbid this prefix" also record the person's rule, with its own receipt, for the controlling rule's prefix (else the exact command). They never loosen an existing rule.
      - The `permissions.*` operations and the preload expose these methods.
    - **Runtime connection:** `rpc.ts` answers a server request with a promise once it resolves.
    - **`EscalationGate.routeFor`:** sends a thread's command escalation through the same mediator. Story 1.25 wires it once threads belong to Tasks.
    - **`config.ts`:** writes `approvals_reviewer = "user"`.
  - **Renderer:**
    - **`Shell/PermissionRequests.tsx`:** the contextual review area ("Contextual review", between the work area and the Composer slot). It polls every second. Each pending request is an ApprovalCard: context "Permission to act", the action, the exact command quoted, Destination, Consequence and Rule. The primary button is "Run `…`"; the alternatives are "Deny", "Deny and add a rule to always ask" and "Deny and forbid this prefix". Each request is announced once through the Shell's live region. A stale request shows "This request is no longer pending". The area also carries the reviewer line when the switch is on.
    - **`ApprovalCard`:** gains an optional `rule` fact.
    - **`PermissionRules.tsx` (S07, after the Capability Contract):** each Workspace's rules with their sources, the reviewer state, and the person's own rules (add or remove, "Ask me first" or "Forbid" only). It sits outside `[data-policy-section]`, so the reviewer wording does not mix with the policy summary.
- **Deviations and interpretations:**
  - The runtime's exec-policy builder for requirements refuses `allow` rules, and Inquello's combination differs from the runtime's own (sources and ties). So the runtime is used only for matching, every rule entered as `prompt` with its index as the justification, and the domain combines the matches. `inquello-domain` stays free of `codex-*` crates, so matching runs in the app-server.
  - With no matching rule, `untrusted` asks before any command. The runtime's "known safe" command list is not reachable from the app-server without new dependencies.
  - A prompt under the No prompt or Full access mode is refused (as the runtime refuses a prompt under `approval_policy = never`), not asked.
  - Requests and decisions are persisted in the working store; the waiting itself is in main. Allow, Deny, the stale refusal and the expiry are each one request–decision pair. A runtime escalation of a known Task's thread takes the same path (`origin: runtime`). Before Story 1.25 no thread belongs to a Task, so escalations are still declined as in Story 1.19.
  - `inquello/permissions/evaluate` was not added: `inquello/tools/exec` and `inquello/permissions/request` evaluate the command themselves, so the host never supplies a decision.
  - The ApprovalCard primitive's overline stays "Permission needed" (Story 1.8); the card's context reads "Permission to act".
  - The smoke uses the person's own rules (a prompt rule on `/usr/bin/touch` and a forbid rule on `/usr/bin/rm`) with the default seed, and removes them at the end. Workspace rules are covered by the domain, processor and desktop integration tests.
  - The wire now carries Story 1.19's `allowed_domains`, which the Story 1.19 wire had dropped. A Workspace allowlist set through the operator path now reaches the desktop.
- **Results (2026-10-29):**
  - **Engine:**
    - `inquello-domain`: 114 lib tests (20 new) and the other targets pass.
    - `inquello-adapters`: `permissions` 5 new; `concurrent_operations` 24 (5 new).
    - `inquello-protocol` fixtures pass.
    - `inquello-service` with the database: lib 8, identity 20, memberships 15 (1 new), topology 9.
    - `codex-app-server --lib inquello`: 18 (5 new).
    - `codex-app-server-protocol`: 317 lib tests (fixtures regenerated, 1 ignored).
    - Clippy `-D warnings` is clean on the Inquello crates. `codex-app-server` shows only the pre-existing upstream `let_and_return`.
    - Both builds pass separately; `Cargo.lock` is unchanged.
  - **Desktop:**
    - `pnpm generate:protocol` emits 816 files (17 new types); `pnpm run build` is clean.
    - `pnpm test` with the database passes 945 tests (26 new). They include `permissions-integration.test.ts`, run against the real runtime, its exec-policy matching, the bundled bubblewrap and the working store: Workspace prompt rule, Deny, stale confirmation, Run inside the sandbox (the outside write denied), one use only, the Workspace forbid, the person's forbid over a Workspace allow, a person's allow refused, "Deny and forbid this prefix", the reviewer off and not available, and expiry.
  - **Keyring smoke** with the seeded topology as the `smoke` user: exit 0, and every report is ok, including `permissions`:
    - Both cards show context "Permission to act" and quote `/usr/bin/touch output/permission-smoke.txt ../<other Task>/permission-smoke.txt`.
    - Destination: "This Task's working folder and Output folder; no network destination".
    - Rule: "`/usr/bin/touch` (prompt), from your rule".
    - Buttons: "Run `/usr/bin/touch …`", "Deny", "Deny and add a rule to always ask" and "Deny and forbid this prefix"; no "Approve".
    - Announced as "Permission to act needed: Run `…`".
    - Deny → "Denied: nothing ran.", and no file.
    - Run → "Allowed for this one request. It runs inside this Task's sandbox."; the file was created inside `output`, and the write into the other Task was blocked with the boundary named.
    - `/usr/bin/rm` → "Refused: `/usr/bin/rm output/permission-smoke.txt` is forbidden. Rule: `/usr/bin/rm` (forbid), from your rule."
    - A user allow rule → `user-rule-cannot-allow`.
    - The review and approval dimensions are unchanged (0 records).
  - **Not verified:**
    - A real automatic reviewer: none is active before Story 1.22; it is covered only by the domain's simulated verdicts.
    - Model-originated requests (Story 1.25), and the escalation route with real threads.
    - macOS and Windows.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): tests for `inquello-domain`, `inquello-adapters` and `inquello-service` (with the database URL); `codex-app-server --lib inquello`; clippy; the two builds run separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol`, `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
