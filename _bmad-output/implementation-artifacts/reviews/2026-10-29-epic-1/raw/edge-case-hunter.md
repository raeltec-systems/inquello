# Edge Case Hunter findings

Review inputs: all fourteen story packets in `/tmp/inquello-story-review-t_bczhks`: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10a, 1.10b, 1.11, 1.12, 1.13. Current source paths below use `engine/` where historical diffs used `fork/`. No tracked source files were changed by this reviewer.

## Surviving findings

### Story 1.4: concurrent idempotent initialization can return revision conflict

- Current locations: `engine/codex-rs/inquello-domain/src/commands.rs:51-60` and `:93-100`; adapter deciding branch `engine/codex-rs/inquello-adapters/src/store.rs:116-132`.
- Trigger: two callers submit the same operation ID, command, and expected revision before either receipt lookup sees a committed receipt.
- Trace A: both initial replay lookups miss; caller A commits; caller B then loads the updated revision and returns `RevisionConflict` at line 60, without rechecking the matching receipt.
- Trace B: both callers load revision zero; caller A commits; caller B obtains the SQLite write lock and sees revision one. The adapter returns `RevisionConflict` before inserting/checking the duplicate receipt. The command handler maps that error directly at lines 93-95; its `DuplicateOperation` replay recovery is never entered.
- Consequence: caller B reports failure for the same idempotent operation already successfully committed. The caller must retry again to discover its receipt.
- Evidence: deterministic current-source interleaving; no Rust runtime concurrency reproduction was executed by this reviewer. This is a demonstrated control-flow gap, with runtime manifestation inferred from the described interleaving.
- Missing handling: recheck the matching operation receipt before returning a revision conflict arising after the initial lookup.
- Claim affected: matching-receipt replay does not hold for this overlapping execution.

### Story 1.10b, with Story 1.12 consequence: logout can falsely confirm server revocation

- Current location: `desktop/src/main/identity/session.ts:539-551`; refresh preservation branch at `:430-434`; retry classification at `:517-519` and `:541-545`.
- Trigger: an access token expires after logout preparation, the server rejects it as unauthenticated, and refreshing returns a dependency failure.
- Trace: the logout request returns unauthenticated. `refresh()` returns false for `dependency_unavailable` while retaining a still-valid refresh session. `attemptLogout()` nevertheless calls `finishLogout()` and returns `{ok:true}` at lines 549-551. No server revocation was acknowledged. The local refresh credential is discarded, leaving the server family valid.
- Related retry path: `pending.sent` is set before request delivery is known. An earlier undelivered attempt followed by access expiry can make a later unauthenticated response enter lines 541-545. That branch treats any retried unauthorized logout as proof the previous logout committed, although expired access and actual revocation are different conditions. This is the same false-confirmation defect, not a separate finding.
- Downstream consequence: `desktop/src/main/data/service.ts:268-280` treats the returned `ok` as confirmed server revocation and tells the user “the shared service confirmed the session was revoked.”
- Evidence: `/tmp/inquello-edge-logout-repro.cjs` uses the current compiled `IdentitySession` and `CredentialVault`, and the existing identity `FakeService` transpiled to `/tmp/inquello-edge-identity-fakes.cjs`. It advances the clock past access expiry at the command boundary and makes refresh return dependency failure. Result: `ok:true`, signed out locally, vault cleared, zero revocation calls, fake service `serverRevoked:false`; refreshing the still-held server token subsequently succeeds. The fake dependency rejection performs no server mutation, so this does not depend on an ambiguous lost response.
- Observed output: `{ "result": { "ok": true, "status": { "identity": { "state": "signed-out" }, "sharedService": "unavailable", "credentialStorage": "memory-only", "privateWork": "local" } }, "calls": ["capabilities", "session", "sessionCommand", "refresh"], "serverRevoked": false, "vaultCleared": true, "revocationCalls": 0, "refreshStillAccepted": true }`.
- Missing handling: keep revocation unconfirmed on refresh dependency/transport failure; accept retry success only with evidence of the relevant session revocation, not any unauthorized access response.
- Claim affected: the 1.10b claim that an unauthenticated retried self-logout means logout committed conflates expired/invalid access with revoked refresh sessions.

### Story 1.12: export follows symlinks into excluded credential files

- Current location: `desktop/src/main/data/export.ts:90-104`, especially opening `source` at line 93. Caller `:180-192`. Inventory source: `desktop/src/main/data/inventory.ts:67-79`.
- Trigger: an included task-history path is a symlink to excluded credential data.
- Trace: inventory records non-directory symlinks as ordinary held files using `lstat` size, but does not preserve their type. Path-based policy classifies `runtime-home/sessions/linked.jsonl` as included task history. `copyWithDigest()` opens it with `r`, following the symlink. The bytes of excluded `runtime-home/auth.json` are then included under the allowed manifest path and category.
- Evidence: `/tmp/inquello-edge-data-repro.cjs` invokes the current compiled exporter with the shipped policy and a temporary governed-root tree. A symlink from an allowed session file to synthetic `auth.json` credentials produces `{ "case": "export symlink", "exportedCategory": "task-history", "credentialsCopied": true, "sourceWasSymlink": true }`.
- Consequence: a shareable export contains credentials despite their category being excluded. This finding requires an existing symlink; it does not assume a remote actor can freely create one.
- Missing handling: reject symlink/nonregular export sources and verify the opened source belongs to the intended allowed path without following forbidden aliases; ancestor replacement also matters if concurrent mutation is supported.
- Claim affected: the absolute credential exclusion claim does not hold for credential bytes reached through included aliases.

### Story 1.13: Local data deletion leaves memory-only Claude credentials held

- Current integration location: `desktop/src/main/main.ts:317-350` and `:366`. Credential lifetime: `desktop/src/main/providers/claude-vault.ts:90-91`, `:108-112`, `:126-128`. File-only deletion path: `desktop/src/main/data/delete.ts:97-109` and `:123-124`.
- Trigger: OS-backed storage is unavailable, a Claude key is held in memory, and the user deletes the Claude-key category in Local data.
- Trace: the memory-only vault retains the key in its memory field. The data-service integration only supplies identity cleanup; `deleteData(categories)` forwards directly to the filesystem-based deletion service. The `claude-key-vault` policy names an on-disk blob, so a memory-only key yields no inventoried file. Deletion reports success with zero files remaining without calling `ClaudeKeyVault.clear()` or the provider removal operation. Subsequent vault loads still return the verified key.
- Evidence: `/tmp/inquello-edge-data-repro.cjs` constructs the current compiled memory-only vault, saves a synthetic verified key, and invokes the real DataService with the shipped policy and current integration shape. Output: Local data returns `ok:true`, zero files removed/remaining, and `keyStillHeld:true`.
- Consequence: Local data says the provider-key category was deleted while the running application still holds and authorizes use of that key.
- Missing handling: coordinate provider credential removal with deletion of its policy category, including in-memory state.

## Coverage and limitations

All fourteen packets were separately inventoried and their core production changes traced. Claims were held unread during path tracing; all fourteen claims files were read only in the claims pass. The deletion-check and claims-check references were read. No additional deletion-specific regression survived beyond the findings above. Current call sites and source were checked for reported findings; obsolete `fork` paths were mapped to `engine`. A runtime-version/originator issue corrected in later stories was not reported.

| Packet | Core coverage | Additional limitation |
|---|---|---|
| 1.1 | Documentation/toolchain/fork setup changes | No runtime production finding |
| 1.2 | Runtime binary, framing, RPC, process lifecycle, stderr, schema version and generation integration | Generated protocol/type/test changes not exhaustively traced |
| 1.3 | App protocol, sender validation, operation policy, preload and main integration | No real Electron security/browser execution |
| 1.4 | Domain command/store/revision/receipt paths and SQLite transaction adapter | Concurrency issue established by source interleaving; Rust tests not run |
| 1.5 | Renderer setup, tokens, icon and CSP paths | Asset and visual evidence not fully verified |
| 1.6 | Button, choice, icon button, switch, text field and shared helpers | CSS/contrast tables and all test call sites not exhaustive |
| 1.7 | Tabs, segmented control, menu, avatar, badge and status chip | No rendered accessibility/browser interaction verification |
| 1.8 | Toast, plan step, approval card, diff line, file chip and judgment tag | No browser rendering verification |
| 1.9 | Capability register/inventory logic and policy enum boundary | Full register data and test permutations not exhaustive |
| 1.10a | Current service login, command, session, OIDC and configuration logic | Not every route, DTO, migration and test call site traced |
| 1.10b | Desktop identity state machine, vault, transport, loopback and service integration; TLS/server paths | Dev topology/CLI/test-provider branches not exhaustive; logout executed with fakes |
| 1.11 | Decision checks, workspace commands, workspace adapter and admin paths | Full route/migration/test matrix not traced or executed |
| 1.12 | Export, import, inventory, delete, journal, service and shipped data policy | Policy parser and UI not exhaustive; export/deletion fixtures executed |
| 1.13 | Provider services, Codex account flow, Claude vault/verification, runtime environment and provider UI/main wiring | Renderer bridge/operation diffs not exhaustive; memory deletion fixture executed |

The review instructions demand exhaustive enumeration including every test call site. That standard was not fully achieved across these large packets: generated/test/documentation/asset hunks and some supporting paths were not read or checked exhaustively. Coverage spans every story, but does not constitute an exhaustive all-branches certification. No database, full Rust suite, real provider network, real identity service, native keychain, cross-platform or browser validation was performed by this layer. Findings distinguish executed reproductions, parent-provided execution, and static interleavings above. Parent requested finalization before additional experiments.

## Leads not promoted to findings

- Story 1.2 shutdown: a fake process ignoring SIGTERM leaves the desktop stop promise pending, but the parent verified the shipped upstream runtime has a dedicated 45-second process-exit watchdog at `engine/codex-rs/app-server-transport/src/transport/stdio.rs:168-180`. Prior review triage already accepted this behavior. The fake does not establish a current shipped-runtime defect, so this lead is rejected.

- Shared DOM id punctuation normalization can collide for specially chosen IDs, but current inspected call sites use distinct safe constants.
- Export's `FileHandle.write` return value is ignored, which could matter for partial writes; no reproduction or practical current trigger established.
- Socket timeout, extreme service date arithmetic, identity-delete/sign-in concurrency, and encrypted-vault files across memory-only sessions were considered but not sufficiently established for this report.
