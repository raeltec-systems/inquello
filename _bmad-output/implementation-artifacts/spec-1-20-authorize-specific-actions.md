---
title: 'Story 1.20: Authorize specific actions without granting professional approval'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
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
- [ ] Domain rules, decision and records, plus policy validation, with tests for every matrix row.
- [ ] Adapter migration 0005 and races.
- [ ] Processor methods, the protocol, FORK-CUT patch, the regenerated protocol and stamp, and tests.
- [ ] Desktop mediation, ApprovalCards, S07 and the rules editor, with jsdom and integration tests (real runtime, real sandbox).
- [ ] Smoke `permissions` report:
  - a user prompt rule makes a `tools/exec` command show an ApprovalCard with an action-verb button and no "Approve";
  - Deny means nothing ran;
  - a second request is allowed and runs inside the sandbox;
  - a forbid rule is refused with its source named;
  - a user allow rule is refused;
  - review and approval states are unchanged.
- [ ] `sprint-status.yaml` (1-20).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `permissions` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): tests for `inquello-domain`, `inquello-adapters` and `inquello-service` (with the database URL); `codex-app-server --lib inquello`; clippy; the two builds run separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol`, `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
