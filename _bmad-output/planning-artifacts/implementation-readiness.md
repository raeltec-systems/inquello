# Implementation readiness — Inquello

**Current scope: approved Increment 1 (Epics 1–6, 84 stories), synthetic-development implementation handoff. **PASS for scoped planning implementability**, following the independent route/service recheck on 27 October.** The full 139-story future roadmap is assessed separately; no runtime acceptance or production authorization is claimed. This supersedes earlier notes that incorrectly treated not-yet-run acceptance tests as pre-build planning blockers.

## Decisions and contracts now recorded

- OQ-16A adopted: OIDC separate from inference login; shared Rust service, PostgreSQL permission/version metadata and private storage for explicitly shared files. Detailed SC-1–6 are architect-derived contracts, not field-by-field owner decisions.
- Cloud-model agent work needs model connectivity for private/shared Tasks. Shared-derived use additionally needs live Inquello authority. Local tools/files do not mean offline inference. Local models are not a current priority; no automatic fallback, offline editor or relabelling shared context as private.
- Owner selected Claude API-key access as the initial additional inference route. Subscription access is conditional on permitted official integration; the Claude companion records the distinct official-binary route and custom-app restriction. No credential, calls, costs, installation or terms acceptance authorized.
- CR-1 now defines an Inquello-owned direct Messages adapter at the retained runtime model boundary: canonical requests/history/tool identities/events, usage/error/stop normalization, capability limits, retry/cancellation and credential isolation. Pinned Responses-only configuration is not advertised as drop-in compatible. Building/testing the specified adapter is implementation work, not an unresolved product decision.
- SC-7 defines an isolated synthetic service, local PostgreSQL/private filesystem blob adapter and OIDC fixture environment with generated data and explicit test policies. Production rejects test identity configuration. No supplier/region is selected or provisioned now.

## Correct gate criterion

The installed BMAD gate asks whether a developer can implement the scope without inventing unrecorded decisions. It does not require implementation acceptance already to have run. Story 1.25 must ultimately demonstrate real configured inference on synthetic inputs; that is a completion criterion, not a reason a fully specified plan cannot enter tracking. Likewise, production identity/storage operators, real-data policy, credentials and live-route testing gate enablement at their relevant stage rather than all synthetic implementation planning.

The approved 84-story increment is not reduced to the nine-story foundation. Stories 1.1–1.9 remain its first bounded sequence, followed by identity, actual agent execution, sources, artifacts, sharing/memory, review and fixture validation. Entities and controls are introduced with their stories; later runtime paths do not become hidden prerequisites for earlier fixtures.

## Scope-specific results

| Scope | Current assessment | Boundary |
| --- | --- | --- |
| Increment 1: Epics 1–6 / 84 stories | PASS for scoped synthetic-development implementability; CR-1/SC-7 recorded | Synthetic implementation planning only; never production/data-use or code-execution approval. |
| Full roadmap: 17 epics / 139 stories | FAIL for a blanket all-stories-ready handoff | External-audit OQ-15, later service supplies and V2 policy remain unresolved for their own stories. |
| Production / real customer data | Not authorized or validated | OQ-16B actual issuer/operator/region/retention/deletion/recovery and inference/source processing eligibility must be resolved and tested before use. |

## Remaining work and gates

1. Implement the recorded first-increment contracts only when separately authorized. Select/pin the actual fork cut/toolchain and intentionally supported API/model versions, implement adapters and run the specified unit/protocol/integration/security/accessibility/fixture tests. These are ordinary build/acceptance work.
2. Establish actual account/credential/processing policy and test-usage authorization before live inference calls; verify each route independently. Synthetic input does not make a paid API call free or automatically authorized.
3. Resolve OQ-16B before real shared data and production deployment. Test fixture retention values and test issuer keys are not production policy. Host trust changes and other setup need their applicable authorization.
4. Resolve OQ-15 before external-audit cross-client use. Later hosted/remote routes, scheduler supply, actual external record destination and V2 native record lifecycle retain their own gates, without blocking the agreed internal-company synthetic scope.

## Evidence

- 17 epics / 139 stable story IDs; 84 first increment, 50 later V1, five V2. All 372 prior acceptance IDs and original 89-story/238-AC traceability preserved; AC 1.22.4 has one explicit editorial qualification narrowing the former blanket Claude gate to conditional subscription integration. Ten added conformance criteria yield 382.
- Spine lint and current document mapping/path checks pass. SPEC retains 25 CAPs and 14 valid companions. Independent service reviews and adoption/connectivity recheck are recorded; current provider/readiness review is distinct.
- Historical spec checker remains 15/17 because its old hardcoded companion inventory/source snapshot predates earlier reconciliation; disclosed, not rewritten to manufacture a pass. Current bounded checks validate actual paths/IDs/mappings.
- No runtime test, API call, credential handling, implementation code, package installation, service provision, deployment or merge occurred. Scoped sprint tracking now records six epics and 84 stories, all backlog, plus six optional retrospectives. It is planning only, not implementation authorization. The other 55 stories remain in the canonical roadmap. See sprint-scope-2026-10-27.json for exact selection and validation.

## Scoped tracking and independent review

The independent provider/readiness reviewer returned PASS for implementability of the approved 84-story synthetic-development plan after reviewing CR-1 and SC-7: no remaining unrecorded blocking design decision was found in the scoped provider/service gates. This is not a fresh independent review of every acceptance criterion or runtime certification. The previously completed service reviews and current mechanical checks are separate evidence.

The installed sprint generator could not import `ruamel.yaml`; an offline dependency resolution also found no cached package. No package was installed. A documented deterministic-equivalent fallback used the installed parser expressions, exact slug function and status header against the approved Epics 1–6 subset. PyYAML independently read the resulting file; exact IDs, ordering, counts, unique keys and legal backlog/optional statuses were checked. The official generator itself did not run successfully. No existing tracker or advanced status was overwritten.
