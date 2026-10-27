# Pass 2 — UX and architecture companion preservation

Date: 2026-10-27. Independent read-only review of `SPEC.md`, `scope-and-gates.md`, the actual final DESIGN, EXPERIENCE and ARCHITECTURE-SPINE referenced by the spec frontmatter, and bmad-spec's Companions, Spec Law and Self-Validate rules. PRD assumption/OQ references and the recorded source baseline were also checked. No fresh research, new choice, source change, memlog change or story work was performed.

**Verdict: preservation passes. One summary wording clarification is recommended before the final derive.** No load-bearing UX/architecture rule is missing from the binding contract. The clarification below corrects a compressed readiness summary; the full adopted spine already retains the exact limitation.

## Adoption and integrity

The spec has ten resolvable `companions:` paths: one spec-authored index and nine adopted artifacts. `sources: []` correctly avoids claiming that the adopted material was fully absorbed. The opening instruction, Constraints and index require downstream readers to read every companion. The final UX/architecture artifacts remain mandatory, not optional references. They need not be duplicated into the five-field kernel.

All nine adopted source hashes match `.working/source-baseline.json`; no adopted source has changed from that baseline. The actual architecture contains exactly AD-1 through AD-14: AD-1–4 retain `[ADOPTED]`, and AD-5–14 retain `[DERIVED]`.

| Reviewed artifact | SHA-256 at review |
| --- | --- |
| `SPEC.md` | `fc846af90aa86601e31501dcc8706e4a5212da924553424142f11c52e19910f5` |
| `scope-and-gates.md` | `20e5d57b6f1906746f57322a0d79bb545e0568294f712edacc301a021353446f` |
| Final `prd.md` | `dc2f625a0c47c25046e8bb9713010cf894c15a478a8eefe11da034d32a385dcf` |
| Final PRD `addendum.md` | `fd15c658805c1c506989a1060bdd399e08cb4cc9d21761d5be7ee8237c492cae` |
| Final `DESIGN.md` | `bfcf9be0a13c474b017fd5cd5971655162c83d1361debb4e611577d8e1f109e3` |
| Final `EXPERIENCE.md` | `6ce184c470887382f80b9a2668d9b3518c55c1a550984f0a1665d29f4f06003b` |
| Final `ARCHITECTURE-SPINE.md` | `557d29bd4970424b8464311bc04bd0bc0d5772fbb74caf20b485665b6ced2054` |
| Root product-definition `addendum.md` | `ff42db917c41fa2b8427e4d229dcf41bff9f377eb593f66cb2852ba1ee40a2ee` |
| `PRODUCT_BRIEF_TRACEABILITY.md` | `a24e449dc65b492c6cf3bee762402abe741733c6af3124db83e23a3188507b46` |
| `CODEX_AUDITOR_FEATURE_MIRROR.md` | `82de15e339768bbed6df374a500833b3e26e4718974b1aff962eb4a2edb4c4e2` |
| `CODEX_AUDITOR_FEATURE_MAP.md` | `35d14d408516fc4124daaf190bddbe6d06ff0a4e6ac2213efe3e8c10d167f654` |

Spec/index hashes identify the reviewed draft, not an assertion that the parent's final derive must preserve their bytes. The adopted-source hashes must remain unchanged.

## Claim families

| Family | Preserved contract and landing | Result |
| --- | --- | --- |
| Selected visual system and source precedence | DESIGN owns appearance; EXPERIENCE owns behavior; both override conflicting imported references. Index Source roles and Adopted architecture/UX boundaries explicitly adopt these rules and the linked asset/token contracts. | Pass |
| Complete UX inventory | Direct counts: 28 components (18 primitives plus 10 compositions), 13 logical surfaces, four imported references S01–S04, nine written-only surfaces S05–S13, 12 V1 surfaces and only S13 V2. Index repeats the correct counts and rejects a four-screen scope cut. | Pass |
| Journeys and supporting paths | EXPERIENCE has UJ-1–8 and SP1–7. All eight journeys remain V1; SP7 is the native-record V2 continuation. Spec/index retain all eight and seven paths. | Pass |
| Exact visual reconciliations | DESIGN retains the 14px semantic title, 380px artifact minimum, small symbol at ≤20px, exact palette/fonts/assets and original token values, with explicit stronger existing-token applications. Full rules remain adopted rather than flattened into generic styling. | Pass |
| Interactions and recovery | EXPERIENCE retains semantics, keyboard/focus, draft retention, truthful missing/blocked/interrupted/stale/uncertain states, unchanged authority on navigation and verified destination outcomes. Spec Constraints and CAP-2/4/7/17/21/22 align; no prototype handler is treated as runtime proof. | Pass |
| Accessibility and secondary clients | AS-UX2/3/4, rendered checks, target/contrast applications and OQ-6/8 are retained. Full multi-surface scope is not narrowed by desktop references, and no global conformance or unsupported offline/handoff promise is introduced. | Pass |
| Four adopted architecture choices | AD-1 public Codex fork, AD-2 separate audit semantics, AD-3 Electron React/TypeScript desktop and AD-4 shared Rust/separate working SQLite remain at original IDs. Spec implementation Constraint/index adopts them without putting HOW prescriptions into capability intents. | Pass |
| Earlier undecided wording | Index explicitly makes later architecture choices decisive and final UX/selected visual kit supersede historical pending-UX/framework language. OQ-12 preserves name/public-brand clearance and remaining validation, without reopening Electron/React/Rust/SQLite or selected design. | Pass |
| Dependency direction and preview isolation | AD-5 retains constrained preload/main, context isolation, no general IPC/shell bridge, separately sandboxed preview context with no trusted domain bridge or privileged-origin navigation, and human decisions only through trusted workbench authority. Kernel protected-store/preview Constraint and mandatory AD adoption preserve this. | Pass |
| Reviewed basis and decision applicability | AD-6 owns a common reviewed-basis revision across outputs/evidence/Method/departures/policy; review and delivery share it. AD-9 stales applicability and preserves immutable historical attribution/external authority. Kernel explicitly stales applicability even without changed output bytes; no weaker artifact-hash-only rule appears. | Pass |
| Protected domain and credential stores | AD-7 denies direct general-tool/subprocess reads and writes to both protected stores, keeps raw privileged secrets out of model context/tools/artifacts/exports/logs, and requires enforcement in every enabled mode or gating. Kernel access Constraint and full mandatory spine preserve both read/write denial and credential protection. | Pass |
| Mutation and cross-store/cross-host ownership | AD-7 preserves one logical domain owner, expected versions/operation identity, repository-owned writes, uncertain/unlinked reconciliation, no blind replay/shared transaction and verified transfer or a gated route. Index sharing and implementation gates retain these consequences. | Pass |
| Immutable authorised mandate revision | AD-11/12 bind accepted runs/effects to one immutable mandate revision, allow prospective changes or explicit trusted rebinding with checks, retain current revocation/restrictive policy, and separate disabling future eligibility from running work. Kernel reproduces the decision-bending rule; complete details remain adopted. | Pass |
| Method, context, routes and external effects | AD-8/10/11 preserve evidence distrust, scoped source/Method/memory, route eligibility, no silent provider fallback, bounded effects, destination verification, logical identity and uncertainty reconciliation without invented exactly-once delivery. Kernel and index do not weaken these. | Pass |
| Phase authority | AD-13, CAP-19–25 and the index preserve useful V1 working/review records with designated external formal authority. Only FR-38/40/42 add V2 native authority/lifecycle/migration. OQ-11 is not a V1 blocker; ordinary V1 engagement work and scheduled/unattended work remain required. | Pass |
| Capability and production evidence | AD-14 and the index retain actual implementation/service supply, enabled-route acceptance, unmet deferred scope, no parity claim from a smaller increment, and no install/build/runtime/security-conformance/release approval from architecture review. | Pass, with the summary clarification below |
| Assumptions | Exactly six: inherited AS-1/AS-2 and AS-UX1–4. Proposed owners and revisit triggers are retained in the index. No new assumption silently chooses a product policy. | Pass |
| Product decision gates | Exactly OQ-1–12 remain. Participation, retained evidence, recall, Method distribution, budgets, support/integrations, validation, operating/accessibility commitments, processing eligibility, release sequencing, native-record policy and name/public-brand validation retain the source's owners/triggers. Adoption resolves only explicit UX/architecture choices. | Pass |
| Supply and implementation gates | Scheduler production supply, team/cross-host ownership, actual remote/connected service identity/eligibility, local host availability and operating envelope remain required before dependent enablement/promises. Delivery fork cut, protocol/toolchain/driver, migrations/conflicts, secure paths, packaging/update and ownership-transfer checks remain before code. SQLite 3.51.3+ or fixed-backport check applies independently to the domain driver. | Pass |

## Wrapper-only content

The kernel/index appropriately omit upstream run chronology, greetings, process menus, review-pass mechanics, memlog bookkeeping and working-ledger prose as standalone requirements. Those records remain available at their original locations and do not become additional top-level scope. Source rationale is not silently substituted for product law.

No UX/architecture artifact, diagram, detailed component contract, journey, source reconciliation, gate or acceptance limitation was dropped as wrapper. The architecture diagram remains in its adopted companion. Imported narrative/prompts and prototype callbacks remain untrusted reference data; relevant assets and evidence links remain transitively available through DESIGN and the spine. No requirement was omitted merely because it appears in a supporting file.

## Exact correction

At the reviewed `scope-and-gates.md` line 124, replace the sentence:

> Follow the spine's linked evidence before dependent implementation, including experimental/unsupported-production transport limitations.

with:

> In the remote Code Mode host section, current upstream documentation warns that the app-server command and WebSocket transport are experimental/unsupported for production; default stdio availability establishes neither blanket production support nor Inquello readiness. Verify and harden the chosen fork/route before release.

Reason: the existing phrase mentions only transport and omits the context-specific app-server-command caveat and stdio/readiness qualification present in ARCHITECTURE-SPINE §Stack, line 161. This is a precision correction to a summary, not a reason to reopen the stack choice or duplicate all AD rules into the kernel. The parent accepted this wording for the logged final derive. No second or third correction is supported by this review.

## Actual preservation gaps

None found in the mandatory combined contract. All reviewed source claim families have a binding landing. Readiness remains unproved exactly where the adopted sources say so: fixtures/runtime acceptance are unexecuted; prototype integrations are illustrative; rendering/keyboard/focus/contrast checks remain pending; the combined stack has no validating install/build; service entitlement, actual route supply and release approval remain gated.
