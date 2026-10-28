---
title: 'Story 1.11: Enforce internal-company memberships without disclosing private Tasks'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e84d2646600cb9e91634fa5f340929ca6b922d84'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/shared-service-contract-proposal-2026-10-27.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Memberships exist only as fixture rows. Nothing creates a Workspace, admits people, applies roles from policy or decides access. Membership could therefore be mistaken for permission to see another creator's private Task (AD-6/7, SC-1, SC-3, OQ-1).

**Approach:** Add three pieces:
- **Authorization decision:** a pure function in `inquello-domain`, giving allow or deny with a safe missing-authority reason. It is evaluated over memberships, Engagement memberships, policy roles and explicit grants.
- **Service:** the `internal_company` Workspace model, with versioned role policy, Engagements and Engagement membership. It has expiring, one-use invites bound to `(issuer, subject)`, and membership-management commands that use SC-2 Workspace-scoped receipts.
- **Operator CLI:** `inquello-service admin`, which bootstraps a Workspace with its policy and first administrator.

**Owner decisions (2026-10-28):** bootstrap through an operator CLI only, with no HTTP path to create Workspaces or self-elevate. Members join through invites bound to an identity. Service and domain only; no desktop UI before Story 1.14.

## Boundaries & Constraints

**Always:**
- **Workspace policy:** a versioned JSON document stored with the Workspace. It defines roles, each with a `kind`, a label and permitted actions. The kind is `audit_team` or `reviewer` only, so no firm hierarchy is hard-coded. Any other kind, such as `guest`, rejects the policy. `manage_membership` is an administrative action, separate from content actions.
- **Membership:** principal, status (`active` or `removed`), role bindings, policy revision and revision. Engagements belong to a Workspace and have their own membership, which needs an active Workspace membership.
- **Authorization decision:**
  - Allow needs an active session, an active Workspace membership, `internal_company` kind, and a policy role permitting the action.
  - For a resource, allow also needs an applicable grant for that exact resource and action.
  - A `private_task` reference is allowed only for its creator. Membership, roles, Engagement membership and `manage_membership` never reach it.
  - Deny reasons come from a fixed set (`not_signed_in`, `not_a_member`, `role_lacks_action`, `no_grant`, `not_the_creator`, `route_not_available`). They never name or confirm an inaccessible resource; an unknown resource and a forbidden one give the same reason.
- **Invites:**
  - An invite is bound to a Workspace, `(issuer, subject)`, roles from the policy, an expiry and an issuing administrator who holds `manage_membership`. It can be used once.
  - Only the matching authenticated principal can accept it; email never matches.
  - An expired, replayed, revoked or wrong-principal invite is rejected with the same safe error.
- **Commands:** issue and revoke invite, change roles, remove member, create Engagement, and add or remove Engagement member. They use SC-2 envelopes with `workspace_id` and `expected_revision`. Authorization and the expected-revision check happen in the same transaction as the receipt, with locks ordered principal → session → Workspace authorization epoch → resource.
- **Removals:** removing a member or changing roles increments the Workspace authorization epoch. A later command made under the old authority fails.
- **Operator CLI:**
  - `admin create-workspace --name --policy FILE --first-admin-issuer --first-admin-subject` creates the Workspace and a pending invite for the first administrator, writing an operator receipt. The person accepts it after signing in.
  - `admin update-policy` sets a new policy revision.
  - The CLI connects to the database directly; no HTTP route reaches it.
- **Roles listing:** shows only the policy's `audit_team` and `reviewer` roles. There is never a guest role.
- **External audit:** `external_audit` Workspace kinds and any client or independence attributes are rejected as `route_not_available` (OQ-15). Nothing is inferred from the internal-company model.

**Never:**
- No desktop changes.
- No grant-issuing API; grants come in Epic 4, so tests seed grant fixtures only.
- No content storage.
- No email matching.
- No new crates beyond those already locked.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bootstrap | CLI `create-workspace` with a valid policy | Workspace and first-admin invite; operator receipt | N/A |
| Guest role | Policy with `kind: "guest"` | Rejected | CLI error naming the kind |
| Accept invite | Matching principal accepts | Active membership with the invited roles | N/A |
| Wrong principal | Same email, different subject | Rejected; nothing disclosed | Same error as for an unknown invite |
| Replay / expired | Second accept, or accept after expiry | Rejected | Same safe error |
| Self-elevation | Member without `manage_membership` changes own roles | Denied | `role_lacks_action` |
| Private Task | Admin or Engagement member requests another creator's `private_task` | Denied | `not_the_creator`; no content |
| Creator | Creator requests own `private_task` | Allowed | N/A |
| Grant needed | Member reads a shared resource without a grant | Denied | `no_grant` |
| Unknown resource | Reference to a nonexistent resource | Denied, same reason as when forbidden | N/A |
| Stale authority | Member removed, then an old in-flight command commits | Rejected | Epoch/version conflict |
| Receipt retry | Same op ID and payload | Recorded outcome after an access recheck | Different payload: conflict |
| External audit | Workspace kind `external_audit` | `route_not_available` | N/A |
| Roles list | GET roles | Only `audit_team` and `reviewer` kinds | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/` -- add `authorization` (decision function, reason enum and policy types). Keep the dependency-direction test green.
- `engine/codex-rs/inquello-service/migrations/0001_identity_sessions_receipts.sql` -- the `memberships` table (fixture-only) and `receipts` with `scope_kind` `workspace`. Add `0002_workspaces_memberships.sql`; never edit 0001.
- `engine/codex-rs/inquello-service/src/{commands,routes,sessions}.rs` -- the SC-2 envelope, receipt and lock patterns from 1.10a; reuse them for Workspace scope.
- `engine/codex-rs/inquello-service/src/bin/` -- the existing binaries; add an `admin` subcommand entry, a new bin or a subcommand of a main service binary.
- `engine/codex-rs/inquello-protocol/` -- add the wire types and fixtures for the new routes and commands.

## Tasks & Acceptance

**Execution:**
- [x] `inquello-domain/src/authorization/` -- the decision function, `Action`, `ResourceRef` (`private_task`, `shared_resource`), `DenyReason` and policy validation, with unit tests for every policy and decision row.
- [x] `inquello-service` -- migration 0002, the Workspace, Engagement, membership and invite repositories, Workspace-scoped command handlers, the routes (`GET /v1/workspaces`, `GET /v1/workspaces/{id}/roles`, `POST /v1/invites/{id}/accept`, `POST /v1/workspaces/{id}/commands`) and the operator CLI.
- [x] `inquello-protocol` -- the new types and fixtures.
- [x] `inquello-service/tests/memberships.rs` -- every matrix row against PostgreSQL 18, including a "no disclosure" check that error bodies never contain resource IDs or names.
- [x] `FORK-CUT.md` (Patch 5) and `sprint-status.yaml` (1-11).

**Acceptance Criteria:**
- Given PostgreSQL 18 and the test issuer, when the membership suite runs, then every matrix row passes. No error body names a resource the caller cannot access, and only `audit_team` and `reviewer` roles can exist.

## Implementation Notes

- **Cloud machine (Linux, root):**
  - **PostgreSQL 18:** cluster `18 main` on port 5433; it stops when the worker restarts, so start it with `pg_ctlcluster 18 main start`. Use `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test` (test-only role, `CREATEDB`).
  - **Cargo:** use `-j 4`. `Cargo.lock` changes only for new members or edges.
  - **Engine stamp:** after committing, run `pnpm generate:protocol` in `desktop/` and amend; run `pnpm test` with `INQUELLO_TEST_DATABASE_URL` exported so the identity integration tests are not skipped.
  - **Baseline:** 41 service and protocol tests, 54 domain and adapter tests, and 506 desktop tests pass.

- **Build decisions (2026-10-28):**
  - **Access checks:** the resource matrix rows need a request to observe, so the service adds `POST /v1/workspaces/{id}/access-checks` (action plus optional `{kind, resource_id}`). It answers `allowed` with the authorization epoch, or a refusal. It reads only the fixture-only `resource_registrations` and `grants` tables; there is still no grant-issuing API.
  - **Refusal bodies:** `ErrorDetail` gains an optional `reason` (one of the six deny reasons). `not_signed_in` is sent as `unauthenticated`, the rest as `denied`. Existing bodies and `errors.json` are unchanged. Invite failures (unknown, expired, replayed, revoked, wrong principal, grantor no longer holding `manage_membership`, disabled Workspace kind) all get the plain `denied` body.
  - **Decision order:** session → Workspace kind (`route_not_available`) → active membership → for a `private_task`, creator check (`not_the_creator`, also for an unknown Task) → role permits the action → for a `shared_resource`, an active grant for that exact resource and content action whose audience includes the caller (principal or Workspace audit team), plus active Engagement membership when the resource belongs to an Engagement (`no_grant`, also when unknown). Every step before the resource step depends only on the caller.
  - **Commands:** all seven need `manage_membership`. `change_roles`, `remove_member` and `remove_engagement_member` lock the Workspace row `FOR UPDATE` and increment the epoch with a `workspace_events` row; the others take it `FOR SHARE`. A target that is missing or in the wrong state is `version_conflict`. A change that would leave no active `manage_membership` holder is refused (`version_conflict`). An exact receipt retry rechecks `manage_membership` before replaying.
  - **Invites:** the administrator-issued lifetime is a new explicit config input, `Lifetimes.invite`. The operator CLI takes `--invite-lifetime-seconds` (required), plus optional `--kind` (only `internal_company`), `--operator` (default `$USER`) and `--database-url` (default `INQUELLO_DATABASE_URL`). It runs migrations and refuses PostgreSQL older than 18. The first administrator's invite carries every policy role that permits `manage_membership`.
  - **Policy document:** `{"policy_version": 1, "roles": [{"id", "kind", "label", "actions"}]}` (sample: `inquello-protocol/fixtures/workspace/policy.json`). At least one role must permit `manage_membership`, and `update-policy` refuses a policy under which no active member would hold it. Unknown keys are refused; keys naming a client, independence or external attribute are `route_not_available`.
  - **Compatibility:** 0002 drops 0001's fixture-only `memberships` table and recreates it with role bindings. `GET /v1/memberships` keeps its wire shape and lists one row per role binding of an active `internal_company` membership. The Workspace fixtures sit in `fixtures/workspace/`, so the desktop's top-level fixture mirror is unchanged; mirroring them is deferred to Story 1.14 (`deferred-work.md`).
- **Results (2026-10-28):** domain 33 unit tests (21 new authorization tests) plus 24 integration tests pass. Protocol 9 tests (2 new) and service 47 tests pass: 8 unit, 17 identity, 13 memberships (every matrix row, including an in-flight command held on the epoch lock while the removal commits) and 9 topology. Clippy with and without `test-issuer`, and fmt, are clean. `cargo build --locked` leaves `Cargo.lock` unchanged (no new dependency edge). Step-04 review was skipped by owner rule.

## Verification

**Commands (in `engine/codex-rs`, with `INQUELLO_TEST_DATABASE_URL` set and the cluster started):**
- `cargo test -j 4 -p inquello-domain -p inquello-protocol -p inquello-service --features inquello-service/test-issuer` -- expected: all pass
- clippy `-D warnings` (with and without `test-issuer`), fmt, and `cargo build --locked` -- expected: clean, no changes
- After committing: `pnpm generate:protocol` and `pnpm test` in `desktop/` -- expected: only the stamp hash changes; all pass
