# Completed-story review — secure private desktop

Reviewed 2026-10-29 with the explicitly requested [bmad-code-review skill](../../../../.agents/skills/bmad-code-review/SKILL.md). Branch: `feat/epic-1-secure-private-desktop`; reviewed HEAD: `ace1ca2883cc8cf62c44dd2df9563236c025c19a`.

**Result: 0 decision-needed, 15 patch, 3 defer, 11 rejected reviewer findings.** The patch count is unique root causes after grouping; rejected count is individual normalized findings. All 14 completed specifications (1.1–1.13, including 1.10a and 1.10b) were reviewed. “Patch” means an actionable code/test correction, not that it was applied or that every item deserves immediate work.

**Recommendation:** fix R01–R09 now or in the same remediation pass. Schedule R10 before the next local-command consumer and R11 before production service use; handle R12 before dynamic component values. R13–R15 are inexpensive optional cleanup. Leave D01–D03 and the rejected items alone until their stated triggers/evidence change. No implementation fixes were made.

Four independent layers returned: blind-hunter, edge-case-hunter, verification-gap and acceptance-auditor. Their original reports are in [raw/](raw/). All formal findings were individually graded before duplicates were grouped; [triage.json](triage.json) preserves the normalized records. The blind hunter did not meet the skill’s numeric finding floors, and the edge reviewer explicitly did not achieve exhaustive call-site/branch coverage. No speculative filler was added. This is a completed evidence-based review pass, not exhaustive certification or a clean-review verdict.

## How risk affected the recommendations

BMAD verdicts are **high** (intolerable outcome), **medium** (material but tolerable), **low** (minor), **false** (refuted), or **maybe-false** (insufficient evidence). Those grades are separate from likelihood. Likelihood is ordinal for this branch and its current callers: **High** = observed in ordinary validation; **Medium** = plausible supported use/sequence; **Low** = unusual failure/race, special local setup or a caller not yet present; **Unknown** = the practical trigger is unverified. Impact rates the consequence if triggered, including developer checks. These are judgments, not measured probabilities. Change risk estimates regression/complexity risk in the proposed fix.

A low-likelihood credential exposure still merits repair. A speculative runtime stall or an unsupported future UI state does not justify immediate recovery machinery. For test gaps, likelihood describes exposure to an undetected future regression, not a claim that current production behavior already fails.

## Ranked action list

| ID | Story | Finding | BMAD | Likelihood | Impact | Recommendation | Change risk |
|---|---|---|---|---|---|---|---|
| [R01](#r01) | 1.12 | Export follows allowed history symlinks into excluded or outside files | high | Low | High | Fix now | Moderate |
| [R02](#r02) | 1.10b | Failed refresh during logout is reported as confirmed server revocation | high | Low | High | Fix now | Moderate |
| [R03](#r03) | 1.13 | Local data deletion leaves a memory-only Claude key usable | medium | Medium | High | Fix now | Low–moderate |
| [R04](#r04) | 1.10b | A pending sign-in can recreate credentials after local removal | medium | Low | Medium | Fix now | Moderate |
| [R05](#r05) | 1.10b | Vault write failure leaves rotated credentials stale on disk | medium | Low | Medium | Fix now | Moderate |
| [R06](#r06) | 1.13 | Offline recheck makes a known-rejected Claude key authorized | medium | Medium | Medium | Fix now | Low |
| [R07](#r07) | 1.12 | Short writes can silently truncate exports and restored files | high | Low | High | Fix now | Low |
| [R08](#r08) | 1.6 | Contrast evidence rejects harmless floating-point serialization differences | medium | High | Medium | Fix now | Low |
| [R09](#r09) | 1.10b | Default refresh tests do not detect lost credential persistence | medium | Medium | Medium | Fix alongside R05 | Low |
| [R10](#r10) | 1.4 | Concurrent identical local commands return a false revision conflict | medium | Low | Medium | Schedule before the first concurrent command consumer | Moderate |
| [R11](#r11) | 1.10a | Expiry checks use time captured before database lock waits | medium | Low | Medium | Schedule before shared-service production use | Low–moderate |
| [R12](#r12) | 1.7 | Lossy ID normalization creates duplicate tab and menu ARIA references | medium | Low | Medium | Schedule before dynamic values; cheap to fix sooner | Low |
| [R13](#r13) | 1.5 | Production build omits the renderer type check | low | Low | Low | Optional small cleanup | Low |
| [R14](#r14) | 1.8 | DiffLine collapses significant whitespace in plain-text source | low | Low | Medium | Optional small cleanup before source-code diff use | Low |
| [R15](#r15) | 1.12 | Containment check mistakes a ..backup child for an outside path | low | Low | Low | Optional small cleanup | Low |
| [D01](#d01) | 1.11 | Administrator preservation counts disabled principals | medium | Low | Medium | Leave until the principal-disable lifecycle is implemented | Moderate |
| [D02](#d02) | 1.11 | Invite redemption checks grantor membership but not principal status | medium | Low | High | Leave until the principal-disable lifecycle is implemented | Moderate |
| [D03](#d03) | 1.13 | Claude action completion waits for an unrelated Codex status request | maybe-false | Unknown | Medium (unverified) | Leave unless a shipped-runtime stall is reproduced | Moderate |

## Story-by-story coverage

| Story | Reviewed commit packet | Result |
|---|---|---|
| [1.1](../../spec-1-1-set-up-initial-inquello-fork.md) | `db3986e` | Import/cut/toolchain records and tree integrity; no new actionable defect. Full imported upstream is outside this review. |
| [1.2](../../spec-1-2-run-packaged-runtime-over-desktop-transport.md) | `b4f76c9` | Runtime lifecycle, framing, RPC and schema/version gates. No new actionable defect; prior deferrals/rejections respected. |
| [1.3](../../spec-1-3-isolate-desktop-renderers-from-host-privilege.md) | `ea49529` | Renderer isolation, operation/sender checks, app scheme and navigation policy. No new actionable defect. |
| [1.4](../../spec-1-4-keep-local-working-metadata-behind-domain-commands.md) | `744d854` | Domain, SQLite transactions, receipts, paths and migrations. R10; invalid path corner case rejected. |
| [1.5](../../spec-1-5-apply-typography-tokens-and-icon-semantics.md) | `3dfa5c5` | Renderer build, typography, fonts and icon semantics. R13; renderer typecheck passes. |
| [1.6](../../spec-1-6-operate-core-action-and-input-primitives.md) | `509a8a5` | Native actions/inputs, state, focus and contrast. R08 (shared evidence with 1.7–1.8). |
| [1.7](../../spec-1-7-navigate-and-identify-work-with-accessible-primitives.md) | `d0ecb0d + 30506d9` | Tabs, segments, Menu, identity/status primitives. R12; R08 cross-reference. Dynamic-option concerns left alone. |
| [1.8](../../spec-1-8-inspect-progress-and-proposed-actions-with-accessible-primitives.md) | `8c2f487` | Approval, progress, file/diff and Toast primitives. R14; R08 cross-reference. No fresh browser visual check. |
| [1.9](../../spec-1-9-register-capability-limits-before-enablement.md) | `9b8753c` | Capability register, evidence gates, inventory mapping and enablement. No new actionable defect. |
| [1.10a](../../spec-1-10a-authenticate-identity-shared-service.md) | `d2714b6` | Identity/token/bootstrap/session contracts and service units. R11; live PostgreSQL scenarios not run. |
| [1.10b](../../spec-1-10b-desktop-sign-in-and-https-topology.md) | `be6dc11 + e84d264 + 31617fa` | PKCE/loopback/TLS topology, vault/session state and account view. R02/R04/R05/R09. |
| [1.11](../../spec-1-11-enforce-internal-company-memberships.md) | `b4e9f3b` | Workspace roles, memberships, grants, invites, operator policy and receipts. D01/D02; no current supported disable route. |
| [1.12](../../spec-1-12-govern-local-data-held-by-first-route.md) | `91c0201` | Policy, inventory, export/import/delete and journal. R01/R07/R15; R02/R04 consequences and R03 integration cross-references. |
| [1.13](../../spec-1-13-keep-provider-credentials-separate.md) | `ace1ca2` | Provider isolation, vault/status, Codex account and Local data wiring. R03/R06; D03; R01 still relevant. |

Each packet was assessed against current HEAD so later-story fixes/additions are not reported as historical defects. Story 1.1’s setup packet does not include the entire upstream import; the recorded original import and squash trees were independently checked to equal `307e4fa207fe563a11f3f7af09cee6fccd2d8376`. The upstream fork is not claimed to have been audited exhaustively.

## Verification actually performed

| Check | Result | Evidence / limits |
|---|---|---|
| Desktop build | Pass | [build.log](evidence/build.log); main TypeScript, data-policy validator and Vite. |
| Renderer TypeScript | Pass | `pnpm exec tsc -p tsconfig.renderer.json --noEmit`, exit 0. Separate from build. |
| Full desktop suite | 709 passed, 8 skipped, 1 failed | [desktop-tests.log](evidence/desktop-tests.log). Only failure: R08 floating-point evidence. 22 files passed, 1 failed, 1 skipped. |
| Domain/adapters/protocol Rust suites | 88 passed | [rust.log](evidence/rust.log); `cargo test --locked -j4 -p inquello-domain -p inquello-adapters -p inquello-protocol`. |
| Service library unit tests | 8 passed | [service-tests.log](evidence/service-tests.log); `cargo test --locked -j4 -p inquello-service --features test-issuer --lib`. |
| Refresh-persistence mutation | 27 tests still passed after removing persistence | [refresh-mutation.out](evidence/refresh-mutation.out); disposable copy only. Establishes R09. |
| Focused synthetic reproductions | Confirmed findings as described | Symlink export, memory-key deletion, logout, rejected-key status, SQLite race, ARIA IDs; plus controlled sign-in/write-failure/short-write cases. |

Pinned dependencies were installed without changing the lockfiles. Rust tests used the current branch with pinned Rust 1.99.1 and an isolated target directory. Desktop runtime integration reused the existing built upstream app-server; its app-server/core/login/code-mode-host source trees were compared with the current engine trees and matched. It was not a fresh full branch/upstream rebuild.

**Not executed:** PostgreSQL 18 integration/topology suites, real OS keyring behavior, a fresh Electron/browser visual or accessibility smoke, Windows/macOS validation, live provider/model calls, full upstream Codex tests or production issuer/JWKS/TLS validation. Database and keyring-dependent desktop tests account for skips. Historical story test claims were read as context, not represented as new runs. Component CSS and SQL findings explicitly distinguish source reasoning from execution.

## Detailed findings

<a id="r01"></a>
### R01 — Export follows allowed history symlinks into excluded or outside files

**Story 1.12; patch; BMAD high. Likelihood: Low. Impact: High. Change risk: Moderate.**

Location: [desktop/src/main/data/export.ts:93](../../../../desktop/src/main/data/export.ts#L93). Sources: blind-hunter+edge-case-hunter+verification-gap+acceptance-auditor; normalized findings 18, 28, 31, 34.

Inventory uses lstat but loses the file type (inventory.ts:70–79). An included sessions/linked-secret.jsonl is then opened with r, following its target. Two synthetic fixtures exported both an outside private marker and excluded auth.json bytes as task-history. The manifest can simultaneously claim credentials were omitted. This requires a preexisting local symlink; no remote link-creation capability is claimed.

**Recommendation:** Fix now. Refuse nonregular export sources and enforce the allowed source boundary when opening/copying. Address ancestor substitution if concurrent mutation is supported. Keep credential exclusions intact; do not merely add another filename denylist.

**Verification needed for remediation:** Test an allowed leaf link to excluded credentials and an outside marker, a directory alias, normal files, and any supported concurrent replacement. Verify no secret bytes reach the destination. Evidence: export-symlink.cjs, edge-data-repro.cjs and export-symlink.out.

<a id="r02"></a>
### R02 — Failed refresh during logout is reported as confirmed server revocation

**Story 1.10b; patch; BMAD high. Likelihood: Low. Impact: High. Change risk: Moderate.**

Location: [desktop/src/main/identity/session.ts:549](../../../../desktop/src/main/identity/session.ts#L549). Sources: blind-hunter+edge-case-hunter; normalized findings 15, 27.

If access expires at the logout command boundary, the command returns unauthenticated. A dependency failure in refresh returns false while preserving the family (session.ts:430–434), but attemptLogout calls finishLogout and returns ok:true. The reproduction observed no revocation call, a cleared local vault, and a refresh token the fake service still accepted. Story 1.12 then describes server revocation as confirmed (data/service.ts:268–280). This is a specific expiry/outage interleaving, not a claim that ordinary logout fails.

**Recommendation:** Fix now. On the FIRST unauthorized logout attempt, distinguish refresh unavailability from a definitively ended family. Keep revocation unconfirmed/pending and preserve the operation ID when appropriate. Local deletion may still discard locally but must report that server revocation was not confirmed. The separate owner-approved rule for unauthenticated RETRIES is not changed by this patch recommendation.

**Verification needed for remediation:** Exercise expired access plus undelivered/dependency-failed refresh; assert no confirmed revocation is reported and retry identity survives. Recheck normal logout and lost-response recovery. Evidence: logout-repro.cjs.

<a id="r03"></a>
### R03 — Local data deletion leaves a memory-only Claude key usable

**Story 1.13; patch; BMAD medium. Likelihood: Medium. Impact: High. Change risk: Low–moderate.**

Location: [desktop/src/main/data/service.ts:285](../../../../desktop/src/main/data/service.ts#L285). Sources: blind-hunter+edge-case-hunter+verification-gap+acceptance-auditor; normalized findings 23, 29, 32, 35.

The supported basic_text/no-keyring fallback stores the key in ClaudeKeyVault.memory. Local data deletes governed files but never clears provider memory. With a synthetic key, deletion returned ok:true with zero files remaining; a subsequent verification still received the key. Explicit Providers → Remove clears it correctly; this finding concerns the separate Local data action.

**Recommendation:** Fix now. Coordinate deletion of claude-key-vault with the provider vault/removal lifecycle, including memory-only state and an in-flight verification. Avoid reporting completion while a retained key can still be used.

**Verification needed for remediation:** Delete from Local data in memory-only and OS-backed modes, then verify provider status and refusal to use the old key. Include a pending verification so deletion cannot resurrect it. Evidence: memory-delete.cjs and memory-delete.out.

<a id="r04"></a>
### R04 — A pending sign-in can recreate credentials after local removal

**Story 1.10b; patch; BMAD medium. Likelihood: Low. Impact: Medium. Change risk: Moderate.**

Location: [desktop/src/main/identity/session.ts:239](../../../../desktop/src/main/identity/session.ts#L239). Sources: blind-hunter; normalized findings 13.

signIn runs outside the exclusive session queue; signOut returns success when record is null, and forgetLocally does not invalidate the pending sign-in. A delayed bootstrap later assigns and persists a new record at :368–383. A controlled synthetic bootstrap reproduced signOutOk:true followed by finalIdentity:signed-in and credentialsRecreated:true after local discard. The Account UI disables its sign-out button while signing in, limiting that direct UI path; Local data is independently callable and also does not cancel the pending identity flow.

**Recommendation:** Fix now. Give local removal/sign-out an internal way to invalidate a pending sign-in and prevent its eventual result from being installed. Abandon/revoke any resulting server session as appropriate. Coordinate Local data removal even when no completed record exists.

**Verification needed for remediation:** Delay browser/bootstrap completion, remove identity data, then finish the old sign-in; no credentials may reappear. Also verify a deliberately NEW sign-in after removal works. Evidence: additional-repros.cjs/out.

<a id="r05"></a>
### R05 — Vault write failure leaves rotated credentials stale on disk

**Story 1.10b; patch; BMAD medium. Likelihood: Low. Impact: Medium. Change risk: Moderate.**

Location: [desktop/src/main/identity/session.ts:613](../../../../desktop/src/main/identity/session.ts#L613). Sources: blind-hunter; normalized findings 14.

persist catches a save failure and only logs it. After remote rotation, the session continues with new credentials in memory but the previous encrypted record remains on disk and credentialStorage still says os-backed. A synthetic ENOSPC injection reproduced refreshed:true, staleRefreshOnDisk:true and serverHasRotated:true. Restart can reuse the old refresh credential and revoke the family, requiring sign-in again. This is a write-failure path; ordinary refresh currently does persist correctly.

**Recommendation:** Fix now. Handle persistence failure as a session/storage recovery outcome: prevent stale rotated credentials from being reloaded, and truthfully report that persistence failed using the existing status/reason mechanisms. Do not silently treat the backend being available as proof that this record was saved.

**Verification needed for remediation:** Fail a real vault save after rotation, recreate the vault/session, and verify stale credentials are not retried. Cover failure while persisting pending logout as well. Evidence: additional-repros.cjs/out.

<a id="r06"></a>
### R06 — Offline recheck makes a known-rejected Claude key authorized

**Story 1.13; patch; BMAD medium. Likelihood: Medium. Impact: Medium. Change risk: Low.**

Location: [desktop/src/main/providers/index.ts:149](../../../../desktop/src/main/providers/index.ts#L149). Sources: blind-hunter; normalized findings 22.

A definitive rejected outcome is overwritten by unreachable on the next network failure; status.ts:84–85 considers unreachable authorized. A rejected→offline verification sequence reproduced inferenceAuthorization changing false→true for the same key. This misstates route eligibility; it does not bypass Anthropic authentication, and no inference adapter is implemented yet.

**Recommendation:** Fix now. Retain the last conclusive rejection until a successful verification or key replacement. Track availability without turning a known-invalid credential back into an eligible route.

**Verification needed for remediation:** Cover rejected→unreachable, verified→unreachable and replacement with a new unverified key. Preserve the intended behavior for a never-rejected stored key. Evidence: rejected-offline.cjs.

<a id="r07"></a>
### R07 — Short writes can silently truncate exports and restored files

**Story 1.12; patch; BMAD high. Likelihood: Low. Impact: High. Change risk: Low.**

Location: [desktop/src/main/data/export.ts:104](../../../../desktop/src/main/data/export.ts#L104). Sources: blind-hunter; normalized findings 20.

copyWithDigest ignores FileHandle.write().bytesWritten and hashes/counts input bytes. Injecting a legal short successful write produced reportedSize:24 and actualSize:12. A damaged export will fail later import validation. More seriously, import.ts:158–166 uses the SAME helper, compares its input-derived digest/size, and then renames the temporary output; a short write during restoration can therefore pass that comparison with a truncated restored file. The executed test injects the documented short-write outcome; a real filesystem short write was not induced.

**Recommendation:** Fix now. Write each chunk completely, handling forward progress and write errors before reporting its digest/size. Preserve cleanup on incomplete copies.

**Verification needed for remediation:** Inject a partial write for both export and import and verify complete output or explicit failure, never a successful truncated restore. Evidence: additional-repros.cjs/out; import call path statically traced.

<a id="r08"></a>
### R08 — Contrast evidence rejects harmless floating-point serialization differences

**Story 1.6; patch; BMAD medium. Likelihood: High. Impact: Medium. Change risk: Low.**

Location: [desktop/test/contrast.test.ts:194](../../../../desktop/test/contrast.test.ts#L194). Sources: verification-gap; normalized findings 33.

The full desktop suite fails on exact JSON string equality for values such as 8.99580851260002 versus 8.995808512600018. The contrast thresholds and pass values are identical. Node 24.19.0 satisfies the declared >=24 engine. This affects developer verification, not observed visual contrast. The evidence file also includes Stories 1.7 and 1.8.

**Recommendation:** Fix now. Make stored ratio comparison stable through deliberate precision or numerical tolerance while still checking category/token coverage and independently enforcing the actual contrast thresholds. Do not simply rewrite the file on each platform or loosen accessibility thresholds.

**Verification needed for remediation:** Run the contrast suite and ensure an actual ratio below threshold still fails. Evidence: desktop-tests.log.

<a id="r09"></a>
### R09 — Default refresh tests do not detect lost credential persistence

**Story 1.10b; patch; BMAD medium. Likelihood: Medium. Impact: Medium. Change risk: Low.**

Location: [desktop/test/identity-session.test.ts:215](../../../../desktop/test/identity-session.test.ts#L215). Sources: verification-gap; normalized findings 30.

The ordinary rotation test searches encrypted bytes for the old plaintext credential, which does not prove the new pair was persisted. Removing only runRefresh’s persist call in a disposable copy leaves all 27 session tests passing. Meaningful decrypted checks exist in the PostgreSQL-gated integration suite, which was skipped here. This is a verified regression-detection gap; it is not a claim that the current successful refresh path omits persistence.

**Recommendation:** Fix alongside R05. Reload/decrypt the real test vault after rotation, assert both saved credentials match the new pair, and instantiate a fresh session that successfully uses the saved record.

**Verification needed for remediation:** The missing-persist mutation must fail the always-run test. Evidence: refresh-mutation.out; raw/verification-gap.md contains the mutation procedure.

<a id="r10"></a>
### R10 — Concurrent identical local commands return a false revision conflict

**Story 1.4; patch; BMAD medium. Likelihood: Low. Impact: Medium. Change risk: Moderate.**

Location: [engine/codex-rs/inquello-adapters/src/store.rs:127](../../../../engine/codex-rs/inquello-adapters/src/store.rs#L127). Sources: blind-hunter+edge-case-hunter+acceptance-auditor; normalized findings 4, 26, 36.

Receipt lookup occurs before the write transaction (domain/commands.rs:51–60). Two identical InitializeStore commands can both miss it, after which the loser checks the new revision before looking for the successful receipt. A barrier over the real SQLite adapter reproduced one Applied and one RevisionConflict for identical-op. No duplicate mutation or corruption occurred; a later sequential retry retrieves the receipt. The foundation currently has no production command consumer.

**Recommendation:** Schedule before the first concurrent command consumer. Recover the matching receipt at the transactional conflict boundary while preserving rejection for a different payload using the same operation ID and for genuinely stale independent commands.

**Verification needed for remediation:** Keep a deterministic overlapping identical-operation test plus differing-payload and different-operation conflict cases. Evidence: sqlite-race.rs/out. Story 1.14 is a sensible integration checkpoint.

<a id="r11"></a>
### R11 — Expiry checks use time captured before database lock waits

**Story 1.10a; patch; BMAD medium. Likelihood: Low. Impact: Medium. Change risk: Low–moderate.**

Location: [engine/codex-rs/inquello-service/src/sessions.rs:303](../../../../engine/codex-rs/inquello-service/src/sessions.rs#L303). Sources: blind-hunter; normalized findings 12.

refresh captures now before pool acquisition and principal/session locks, then compares credential/session expiry against that old value at :331–334. bootstrap similarly captures time at login.rs:101 and reuses it after FOR UPDATE at :170. A request valid at entry can be accepted after expiry if it waits across that boundary. Revoked/rotated state is still reread under lock; this is not a general revocation bypass. This is a source-verified interleaving, without a live PostgreSQL lock-wait reproduction.

**Recommendation:** Schedule before shared-service production use. Use the injected clock at the point expiry is enforced after waiting for the relevant locks, and keep issuance timestamps consistent with that check. Preserve the intentional ID-token clock-skew allowance.

**Verification needed for remediation:** In PostgreSQL, hold the relevant lock, advance the test clock past expiry, release it and assert refusal for bootstrap and refresh. Use non-expired controls to catch timing regressions.

<a id="r12"></a>
### R12 — Lossy ID normalization creates duplicate tab and menu ARIA references

**Story 1.7; patch; BMAD medium. Likelihood: Low. Impact: Medium. Change risk: Low.**

Location: [desktop/src/renderer/primitives/shared.tsx:64](../../../../desktop/src/renderer/primitives/shared.tsx#L64). Sources: blind-hunter; normalized findings 7.

idFragment replaces punctuation/space with underscore. Distinct values a.b and a b render duplicate IDs through Tabs.tsx:48–49 and Menu.tsx:200. ReactDOMServer confirmed duplicate tab, panel, radio-item and label IDs. aria-controls/aria-labelledby can then reference the wrong element. Current inspected callers use safe distinct constants, so no current specimen interaction was shown broken.

**Recommendation:** Schedule before dynamic values; cheap to fix sooner. Use a collision-free encoding or stable unique association for component values. Keep each label/control pair consistent.

**Verification needed for remediation:** Render distinct values that previously collide and assert unique IDs and correct reference targets. Add keyboard/assistive-browser verification when dynamic callers land.

<a id="r13"></a>
### R13 — Production build omits the renderer type check

**Story 1.5; patch; BMAD low. Likelihood: Low. Impact: Low. Change risk: Low.**

Location: [desktop/package.json:16](../../../../desktop/package.json#L16). Sources: blind-hunter; normalized findings 6.

build runs the main-process tsconfig then Vite, which transpiles renderer TSX without typechecking it. tsconfig.renderer.json exists and each story lists a separate required check; that check passed in this review. A future developer running only build/test can therefore miss renderer type errors. No present renderer type failure is claimed.

**Recommendation:** Optional small cleanup. Include the existing renderer no-emit check in the build/check command used before packaging. This is a direct command correction, not a new test framework.

**Verification needed for remediation:** Run the existing renderer check and build. A temporary type mismatch in a disposable copy should fail the build if validating the new command.

<a id="r14"></a>
### R14 — DiffLine collapses significant whitespace in plain-text source

**Story 1.8; patch; BMAD low. Likelihood: Low. Impact: Medium. Change risk: Low.**

Location: [desktop/src/renderer/primitives/primitives.css:852](../../../../desktop/src/renderer/primitives/primitives.css#L852). Sources: blind-hunter; normalized findings 11.

DiffLine renders children in a normal span without a whitespace-preserving rule. Normal HTML whitespace collapsing removes indentation and repeated spaces from plain text. Current specimen rows are ordinary financial prose, so the current screen has no demonstrated data misrepresentation. The failure matters when the primitive displays whitespace-sensitive source.

**Recommendation:** Optional small cleanup before source-code diff use. Preserve plain-text whitespace in the diff body, choosing wrapping consistent with the existing layout.

**Verification needed for remediation:** Inspect a line with leading indentation and multiple spaces in a real browser. No fresh rendered-browser reproduction was performed in this review.

<a id="r15"></a>
### R15 — Containment check mistakes a ..backup child for an outside path

**Story 1.12; patch; BMAD low. Likelihood: Low. Impact: Low. Change risk: Low.**

Location: [desktop/src/main/data/export.ts:165](../../../../desktop/src/main/data/export.ts#L165). Sources: blind-hunter; normalized findings 19.

rel.startsWith("..") rejects any prefix, not just a parent segment. A destination such as <user-data>/..backup/export is inside the root but passes the outside-root test; inventory.ts:51 repeats the predicate. Normal nested paths are rejected correctly. Inventory is taken before copying, so this is not an immediate infinite-recursion claim; an in-root export can instead become unclassified app data and violate the promised outside-root boundary.

**Recommendation:** Optional small cleanup. Compare against the exact parent segment (.. or .. plus the platform separator) and retain the absolute-path check in both predicates.

**Verification needed for remediation:** Check an ordinary child, a ..backup child, the root itself, a true ../ sibling and a different drive where supported.

<a id="d01"></a>
### D01 — Administrator preservation counts disabled principals

**Story 1.11; defer; BMAD medium. Likelihood: Low. Impact: Medium. Change risk: Moderate.**

Location: [engine/codex-rs/inquello-service/src/workspace_commands.rs:110](../../../../engine/codex-rs/inquello-service/src/workspace_commands.rs#L110). Sources: blind-hunter; normalized findings 16.

The query counts active memberships without joining principal status; admin.ts:317 does likewise. With two administrator memberships and one disabled principal, the only usable administrator can be removed/demoted while the predicate still passes. Disabled principal rows are represented in tests, but no supported production disable command exists in src; ordinary operator commands do not create this transition. This is a conditional lifecycle risk, not a reproduced current UI failure.

**Recommendation:** Leave until the principal-disable lifecycle is implemented. When principal disable/reenable becomes supported, define usable-administrator preservation across that transition and membership/policy changes, with consistent locks. Do not bolt isolated filters onto queries before that lifecycle is designed.

**Verification needed for remediation:** Add a PostgreSQL fixture with one active and one disabled admin, then test removal, demotion, policy update, disable and reenable concurrently. No database-backed reproduction was run here.

<a id="d02"></a>
### D02 — Invite redemption checks grantor membership but not principal status

**Story 1.11; defer; BMAD medium. Likelihood: Low. Impact: High. Change risk: Moderate.**

Location: [engine/codex-rs/inquello-service/src/workspaces.rs:590](../../../../engine/codex-rs/inquello-service/src/workspaces.rs#L590). Sources: blind-hunter; normalized findings 17.

A pending invite remains redeemable if its grantor’s membership stays active while the principal is disabled: the predicate checks membership and manage_membership only. The invitee is still authenticated and the invite remains bound to the exact issuer/subject; this does not let an arbitrary person redeem it. As with D01, disabling currently requires fixture/direct database manipulation rather than a supported user route.

**Recommendation:** Leave until the principal-disable lifecycle is implemented. Address effective grantor authority and outstanding invites when implementing principal disable/re-enable, respecting the principal→session→workspace lock order. Keep the operator-created bootstrap invite exception explicit.

**Verification needed for remediation:** Exercise redemption before/after grantor disable, removal and reenable, including a racing disable. Decide the lifecycle contract at that feature checkpoint; this review does not require a new account-disable feature.

<a id="d03"></a>
### D03 — Claude action completion waits for an unrelated Codex status request

**Story 1.13; defer; BMAD maybe-false. Likelihood: Unknown. Impact: Medium (unverified). Change risk: Moderate.**

Location: [desktop/src/main/providers/index.ts:91](../../../../desktop/src/main/providers/index.ts#L91). Sources: blind-hunter; normalized findings 25.

Every completed Claude action awaits getStatus, including Codex account/read. A never-resolving fake request would leave the UI waiting even after the key operation completed. The coupling is confirmed, but no indefinite account/read stall was demonstrated with the pinned shipped runtime; generic absent RPC deadlines were already rejected in Story 1.2 under its trust model. No actual provider key loss was shown.

**Recommendation:** Leave unless a shipped-runtime stall is reproduced. Do not add timeout/retry machinery on this evidence alone. If a normal keyring/runtime failure reproduces the stall, return the completed Claude outcome independently using existing status state and handle refresh separately.

**Verification needed for remediation:** Reproduce with the shipped runtime and a real keyring failure, recording request completion/termination behavior; a deliberately hung fake alone does not establish production likelihood.

## Individual triage ledger

Each row retains its own verdict/evidence. Shared group IDs indicate deduplication only after that decision.

| # | Layer | Story | Finding | Verdict | Route/group | Evidence or refutation |
|---|---|---|---|---|---|---|
| 1 | blind-hunter | 1.2 | Unbounded stderr file | low | rejected | Real append-only file, but default logging is quiet; rotation adds machinery. Explicitly rejected in prior Story 1.2 triage. No everyday growth failure demonstrated. |
| 2 | blind-hunter | 1.3 | Blocked-navigation probe list grows in production | low | rejected | The array is uncapped, but ordinary UI does not repeatedly attempt forbidden navigations. No present memory failure shown; adding production tracking guards for this rare negligible case is not warranted. |
| 3 | blind-hunter | 1.3 | Status reports expected runtime version | low | rejected | getStatus returns the stamp even after a mismatch, but VersionMismatchError includes the detected version in the failure/log path and the runtime is blocked. Adding another diagnostic state path has little present value. |
| 4 | blind-hunter | 1.4 | Identical operation race conflicts | medium | R10 | Real SQLite barrier reproduction yields one Applied and one RevisionConflict for identical-op. |
| 5 | blind-hunter | 1.4 | Database symlink to directory can change permissions | low | rejected | Canonicalization accepts the directory target; on Unix ensure_owner_only_file can tighten it from 0755 to 0700 before open fails. Requires an invalid configured database path, has no present production caller, and the owner keeps access. Additional special-file guard complexity is not justified for this low present risk. |
| 6 | blind-hunter | 1.5 | Build skips renderer type check | low | R13 | Build configuration confirms omission; the separately required renderer check passes. Direct command correction is inexpensive. |
| 7 | blind-hunter | 1.7 | ARIA value encoding collisions | medium | R12 | SSR reproduced duplicate tab/panel/menu IDs for distinct a.b and a b. Current callers use safe constants. |
| 8 | blind-hunter | 1.7 | Tabs retains removed selection | low | rejected | The uncontrolled selection stays stale if children remove that value. Existing caller has a fixed tab set; dynamic removal is not an accepted current flow. Automatic reconciliation adds state/registration complexity; revisit with that caller. |
| 9 | blind-hunter | 1.7 | SegmentedControl retains absent selection | low | rejected | Changed options can leave none checked, but the first option remains keyboard reachable and selection recovers on interaction. Current options are fixed. Additional reconciliation is not worth adding before a dynamic consumer exists. |
| 10 | blind-hunter | 1.8 | Toast dismissal survives changed content | low | rejected | A reused dismissed instance remains hidden, but a new keyed/mounted Toast has a fresh lifecycle; no current transient-message replacement consumer exists (specimen is persistent). Adding message-identity semantics now is unnecessary. |
| 11 | blind-hunter | 1.8 | Diff whitespace collapses | low | R14 | Normal span/CSS collapses whitespace; current prose specimen avoids it. Direct CSS correction is small. |
| 12 | blind-hunter | 1.10a | Expiry checked with pre-lock clock | medium | R11 | Post-lock credential and transaction checks reuse time sampled before awaits. Lock-wait crossing is source-verified; PostgreSQL execution remains outstanding. |
| 13 | blind-hunter | 1.10b | Sign-in completes after sign-out | medium | R04 | Controlled bootstrap delay reproduced recreation after signOut plus forgetLocally. Direct Account button is guarded; separate local deletion is not cancellation-safe. |
| 14 | blind-hunter | 1.10b | Persistence errors leave stale rotated record | medium | R05 | Injected save failure leaves old disk refresh, new server refresh and os-backed displayed state. |
| 15 | blind-hunter | 1.10b | Logout confirms after failed refresh | high | R02 | First unauthorized command plus dependency failure retains a valid server family yet returns ok:true. Current-class fake-service reproduction. |
| 16 | blind-hunter | 1.11 | Disabled members counted as administrators | medium | D01 | SQL counts membership status only; conditional disabled-principal fixture can strand usable administration. Supported disable transition is absent, so defer lifecycle work. |
| 17 | blind-hunter | 1.11 | Disabled grantor invite remains redeemable | medium | D02 | Membership/permission predicate omits principal status; exact-subject binding still applies. Conditional fixture/direct-DB state, deferred with principal lifecycle. |
| 18 | blind-hunter | 1.12 | Symlink export crosses exclusion boundary | high | R01 | Allowed history link exported a private marker/excluded credential fixture with the real exporter. |
| 19 | blind-hunter | 1.12 | ..backup misclassified outside root | low | R15 | String prefix test differs from parent-segment test; direct predicate correction. No immediate recursion claimed. |
| 20 | blind-hunter | 1.12 | File copy ignores short writes | high | R07 | Injected short successful write yields 24 reported versus 12 actual bytes. Same helper is used in restore and checks input-derived digest before rename. |
| 21 | blind-hunter | 1.12 | Restart failure discards data result detail | low | rejected | Detailed result is lost, but the existing explicit message says the local data action ran and asks to restart Inquello (service.ts:123). It does not say nothing changed. Rare restart failure plus extra public result/recovery branching is not worth changing now. |
| 22 | blind-hunter | 1.13 | Rejected key becomes authorized offline | medium | R06 | Real status/service with synthetic verifier reproduces false→true route eligibility for the same rejected key. |
| 23 | blind-hunter | 1.13 | Local deletion misses memory key | medium | R03 | Current DataService returns deletion success; real vault retains key and fake verification receives it afterwards. |
| 24 | blind-hunter | 1.13 | Malformed Codex account becomes connected | false | rejected | The pinned trusted runtime serializes account/read from its typed, tagged Account enum (including apiKey/chatgpt and other provider variants), not arbitrary {}. No current caller emits the alleged malformed state; inventing an untrusted runtime contradicts the accepted transport boundary. There is no demonstrated current authorization bypass. |
| 25 | blind-hunter | 1.13 | Claude completion waits on Codex | maybe-false | D03 | The dependency is real; a production indefinite stall is not established. Need a shipped-runtime/keyring failure reproduction, not a hung fake alone. |
| 26 | edge-case-hunter | 1.4 | Concurrent same-operation conflict | medium | R10 | Independent interleaving trace matches the real SQLite barrier reproduction. |
| 27 | edge-case-hunter | 1.10b | Logout falsely confirms revocation | high | R02 | Executed expiry/dependency fixture proves the FIRST-attempt defect. Related generic retry-401 observation follows an explicit frozen owner rule, so it is not separately proposed for patching. |
| 28 | edge-case-hunter | 1.12 | History symlink exports auth.json | high | R01 | Synthetic excluded auth.json copied under task-history by the real exporter. Requires an existing local link. |
| 29 | edge-case-hunter | 1.13 | Memory-only key survives category deletion | medium | R03 | Real vault/DataService fixture retains memory after successful zero-file deletion. |
| 30 | verification-gap | 1.10b | Rotation-persistence mutation passes default tests | medium | R09 | Pre-verified gap evidence accepted as filed: removing only persist leaves 27 session tests passing; effective decrypted checks are DB-gated. |
| 31 | verification-gap | 1.12 | Symlink export leaks outside sentinel | high | R01 | Outside sentinel reproduction run against real compiled inventory/exporter; parent reran successfully. |
| 32 | verification-gap | 1.13 | Memory key still verifies after deletion | medium | R03 | Real compiled service/vault plus synthetic verifier reports stillHeld:true and one post-delete verification call. |
| 33 | verification-gap | 1.6 | Contrast snapshot differs on float rounding | medium | R08 | Full desktop run fails only byte equality of equivalent float ratios; all pass/threshold fields agree. |
| 34 | acceptance-auditor | 1.12 | Credential exclusion fails through symlink | high | R01 | Independently reran outside-marker reproduction; violates current included-only and credential-never-exported rules. |
| 35 | acceptance-auditor | 1.13 | Governed deletion omits supported memory fallback | medium | R03 | Independently reran Local data deletion fixture; shipped policy promises removal via that action. |
| 36 | acceptance-auditor | 1.4 | Receipt replay fails for concurrent identical command | medium | R10 | Independently inspected/reran real SQLite reproduction against the same-command receipt contract. |
| 37 | acceptance-auditor | 1.12 | Runtime JSON differs from compiled-in policy wording | low | rejected | Mismatch is real, but strict validation/freeze remains and an actor modifying this unpackaged app can also modify its JS. No separate security boundary demonstrated. Reject a fix consisting of changing frozen intent; revisit embedding with already-deferred packaging. |
| 38 | acceptance-auditor | 1.11 | Disabled Workspace kind reveals existence | low | rejected | Conditional seeded external_audit row returns route_not_available, unlike a missing row. Normal creation forbids that kind; the spec explicitly selects this precedence and also asks for nondisclosure. Do not edit the frozen spec or add future-route branches now; reconcile when unsupported kinds become reachable. |

## Workflow state and files changed

Review findings and rejected appendices were written under Tasks & Acceptance in every story; three deferrals were appended to deferred-work.md. Frozen intent/acceptance criteria, application code, tests, lockfiles and branch HEAD were not changed. The pre-existing untracked `fork/` directory was preserved.

Owner decision (2026-10-29): **leave all 15 patch findings as open action items**. No fixes were applied; the three recorded deferrals and 11 rejected findings retain their dispositions. Story frontmatter and sprint tracking are synchronized under the skill’s status rules.

Stories **1.1, 1.2, 1.3 and 1.9 are done** for this review pass. Stories **1.4, 1.5, 1.6, 1.7, 1.8, 1.10a, 1.10b, 1.11, 1.12 and 1.13 are in-progress** because patch items or unresolved medium/high findings remain. Story 1.11 has only deferred medium findings; it remains in-progress under the skill’s explicit unresolved-issue rule. Story 1.10a/b share the sprint key for 1.10, which is in-progress. This changes 13 sprint entries: four done and nine in-progress. The epic remains in-progress; later backlog stories and existing deferral dispositions are unchanged.

Status updates are workflow bookkeeping, not a new validation run or production-readiness claim. The review recommendations and risk ratings remain available for the later remediation pass.

## Rejected appendix

These 11 formal findings are left alone. Risk is for the current branch, not a future hypothetical feature.

| # | Story | Verdict | Likelihood | Impact | Why no fix now |
|---|---|---|---|---|---|
| 1: Unbounded stderr file | 1.2 | low | Low | Low | Real append-only file, but default logging is quiet; rotation adds machinery. Explicitly rejected in prior Story 1.2 triage. No everyday growth failure demonstrated. |
| 2: Blocked-navigation probe list grows in production | 1.3 | low | Low | Low | The array is uncapped, but ordinary UI does not repeatedly attempt forbidden navigations. No present memory failure shown; adding production tracking guards for this rare negligible case is not warranted. |
| 3: Status reports expected runtime version | 1.3 | low | Low | Low | getStatus returns the stamp even after a mismatch, but VersionMismatchError includes the detected version in the failure/log path and the runtime is blocked. Adding another diagnostic state path has little present value. |
| 5: Database symlink to directory can change permissions | 1.4 | low | Low | Low | Canonicalization accepts the directory target; on Unix ensure_owner_only_file can tighten it from 0755 to 0700 before open fails. Requires an invalid configured database path, has no present production caller, and the owner keeps access. Additional special-file guard complexity is not justified for this low present risk. |
| 8: Tabs retains removed selection | 1.7 | low | Low | Low | The uncontrolled selection stays stale if children remove that value. Existing caller has a fixed tab set; dynamic removal is not an accepted current flow. Automatic reconciliation adds state/registration complexity; revisit with that caller. |
| 9: SegmentedControl retains absent selection | 1.7 | low | Low | Low | Changed options can leave none checked, but the first option remains keyboard reachable and selection recovers on interaction. Current options are fixed. Additional reconciliation is not worth adding before a dynamic consumer exists. |
| 10: Toast dismissal survives changed content | 1.8 | low | Low | Low | A reused dismissed instance remains hidden, but a new keyed/mounted Toast has a fresh lifecycle; no current transient-message replacement consumer exists (specimen is persistent). Adding message-identity semantics now is unnecessary. |
| 21: Restart failure discards data result detail | 1.12 | low | Low | Low | Detailed result is lost, but the existing explicit message says the local data action ran and asks to restart Inquello (service.ts:123). It does not say nothing changed. Rare restart failure plus extra public result/recovery branching is not worth changing now. |
| 24: Malformed Codex account becomes connected | 1.13 | false | Low | None demonstrated | The pinned trusted runtime serializes account/read from its typed, tagged Account enum (including apiKey/chatgpt and other provider variants), not arbitrary {}. No current caller emits the alleged malformed state; inventing an untrusted runtime contradicts the accepted transport boundary. There is no demonstrated current authorization bypass. |
| 37: Runtime JSON differs from compiled-in policy wording | 1.12 | low | Low | Low | Mismatch is real, but strict validation/freeze remains and an actor modifying this unpackaged app can also modify its JS. No separate security boundary demonstrated. Reject a fix consisting of changing frozen intent; revisit embedding with already-deferred packaging. |
| 38: Disabled Workspace kind reveals existence | 1.11 | low | Low | Low | Conditional seeded external_audit row returns route_not_available, unlike a missing row. Normal creation forbids that kind; the spec explicitly selects this precedence and also asks for nondisclosure. Do not edit the frozen spec or add future-route branches now; reconcile when unsupported kinds become reachable. |

Additional exploratory leads were not promoted to formal findings and are not included in the counts: the fake-child shutdown hang is refuted for the shipped runtime by its dedicated 45-second exit watchdog (`engine/codex-rs/app-server-transport/src/transport/stdio.rs:168–180`); generic response-queue flooding/RPC deadlines remain prior low-risk rejections under the trusted-runtime model. Form reset/forced-colors, capability evidence freshness, socket timeout and extreme-date ideas lack a demonstrated current failure. The raw reports preserve these limits.

The retry-401 logout observation is deliberately excluded from R02’s proposed correction: Story 1.10b explicitly records the owner decision that unauthenticated on a retried self-logout means logged out. R02 independently demonstrates false confirmation on the first attempt after a refresh dependency failure. Changing the frozen retry rule would require renegotiating intent; this review does not do that.
