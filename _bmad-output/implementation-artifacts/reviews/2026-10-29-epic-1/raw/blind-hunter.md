# Blind Hunter findings

All 14 requested diff packets were inspected separately. Reviews used the diff content and current source/call sites, without story narratives or claims files. Imported upstream Codex was not exhaustively reviewed. The arithmetic below uses kB = bytes / 1024. The requested numeric floors exceed the number of findings substantiated in this pass; those shortfalls are reported rather than filled with speculative defects.

## Story 1.1

N = min(floor(sqrt(37431 / 1024) + 1), 10) = 7.

The packet contains import/setup narrative and status material, with no independently reviewable implementation content under this layer's context-free restriction. No implementation findings asserted.

## Story 1.2

N = min(floor(sqrt(799189 / 1024) + 1), 10) = 10.

- `desktop/src/main/runtime/stderr.ts:32` opens an append-only stderr log, and `desktop/src/main/runtime/stderr.ts:70` writes every stderr chunk without rotation or a retention cap. A runtime that repeatedly logs errors grows this governed local file indefinitely across launches; bounding the recent in-memory diagnostics does not bound the persisted log.

Reviewed runtime process supervision, framing, RPC, stderr capture, version validation, binary selection, and protocol generation changes. No finding retained for missing SIGKILL escalation or per-request timeouts: the trusted shipped runtime's shutdown watchdog changes the former assessment, and untrusted-server queue scenarios were not demonstrated for the shipped runtime.

## Story 1.3

N = min(floor(sqrt(65268 / 1024) + 1), 10) = 8.

- `desktop/src/main/main.ts:97` appends every blocked navigation/window event to `blocked` during normal application operation. That array is only needed by the smoke probe and has no cap or production clearing path. Repeated blocked navigations accumulate retained URL strings for the lifetime of the application.
- `desktop/src/main/security/operations.ts:205` returns the configured schema-stamp version as the runtime version, wired from `desktop/src/main/main.ts:356`. When the installed executable fails the version compatibility check, diagnostics still report the expected version instead of the detected incompatible version, concealing the value needed to diagnose the failure.

Reviewed renderer isolation, custom protocol, navigation policies, preload facade, IPC validation, and startup integration.

## Story 1.4

N = min(floor(sqrt(119693 / 1024) + 1), 10) = 10.

- `engine/codex-rs/inquello-domain/src/commands.rs:59` and `engine/codex-rs/inquello-domain/src/commands.rs:93` perform receipt lookup before entering the commit transaction; `engine/codex-rs/inquello-adapters/src/store.rs:127` checks the expected revision before recovering an existing receipt. Two simultaneous identical initialization commands with the same operation ID and expected revision can both observe no receipt, after which one succeeds and the other returns `RevisionConflict` instead of replaying the successful receipt. Reproduced against the real SQLite adapter with a barrier after both initial reads: one `Applied`, one `RevisionConflict { expected: 0, actual: 1 }`. Reproduction: `/tmp/blind-store-race.rs` and `/tmp/blind-store-race`.
- `engine/codex-rs/inquello-adapters/src/location.rs:32` canonicalizes a symlink target without checking the target's type again. The directory check at line 40 applies to the nonsymlink branch. A configured database symlink pointing at a directory therefore reaches the existing-file permission path at line 88 and can chmod that directory before SQLite rejects it as a database. Reject nonregular targets before changing permissions.

Reviewed domain commands, model validation, database location handling, migration, SQLite transaction implementation, and adapter tests.

## Story 1.5

N = min(floor(sqrt(90362 / 1024) + 1), 10) = 10.

- `desktop/package.json:16` builds using `tsconfig.build.json`, which excludes renderer source, followed by Vite transpilation. The renderer's separate TypeScript configuration is not part of that build command. A renderer type error can therefore pass the production build and ship; include the renderer typecheck in the required build path.

Reviewed token/theme foundations, font declarations, icon implementation, renderer entry, and build wiring. No additional implementation defect substantiated within this pass.

## Story 1.6

N = min(floor(sqrt(218088 / 1024) + 1), 10) = 10.

Reviewed core button, icon button, choice, switch, text field, shared accessibility utilities, and CSS changes. No additional issue elevated to a verified finding in this pass; native form reset behavior and forced-colors focus visibility remain unverified leads rather than asserted defects.

## Story 1.7

N = min(floor(sqrt(176810 / 1024) + 1), 10) = 10.

- `desktop/src/renderer/primitives/shared.tsx:64` sanitizes distinct values to the same ID suffix. `Tabs.tsx:48` and `Tabs.tsx:49` use those suffixes for tab/panel IDs, and `Menu.tsx:200` uses them for menu item/label IDs. Values `a.b` and `a b` produce duplicate IDs in both components. Reproduced with ReactDOMServer: tabs emitted duplicate `_R_0_tab-a_b` and `_R_0_panel-a_b`; menu radio items emitted duplicate `_R_0_menu-0-a_b` and label IDs. The resulting `aria-controls`, `aria-labelledby`, and label references can resolve to the wrong element. Generate a unique suffix independent of lossy normalization, or encode values injectively.
- `desktop/src/renderer/primitives/Tabs.tsx:64` retains the selected value when the corresponding tab disappears. The tab rendering at line 132 assigns `tabIndex=-1` to every remaining tab, and no remaining panel matches the stale selection. Removing the selected tab can leave no visible panel and no tab stop in the tab list; repair uncontrolled selection when available tabs change.
- `desktop/src/renderer/primitives/SegmentedControl.tsx:38` initializes local selection once; the later focus clamping at lines 41–44 does not repair selection. If options initially arrive empty or the selected option is removed, all remaining options can have `aria-checked=false` indefinitely. Reconcile uncontrolled selection with the current option set.

Reviewed composite tabs, segmented control, menu, avatar, badge, status chip, shared IDs, and styling. Dynamic option findings are source-verified, not browser reproductions.

## Story 1.8

N = min(floor(sqrt(164744 / 1024) + 1), 10) = 10.

- `desktop/src/renderer/primitives/Toast.tsx:34` preserves `dismissed` across content changes, while the timer effect at lines 41–48 does not track message content. Reusing the mounted Toast for another message after dismissal leaves the new message hidden; replacing an undismissed message also inherits the old message's remaining dismissal time. Reset the lifecycle on a message identity or make the required remount contract explicit.
- `desktop/src/renderer/primitives/DiffLine.tsx:48` renders source text with the `.iq-diff-body` style, whose definition in `primitives.css:852` does not preserve whitespace. Normal HTML whitespace collapsing removes indentation and repeated spaces from displayed diff content, so the rendered source can differ materially from the actual changed line.

Reviewed approval card, toast, file chip, diff line, plan steps, judgment tag, and associated CSS. No rendered browser or assistive-technology checks were run for this layer.

## Story 1.9

N = min(floor(sqrt(117876 / 1024) + 1), 10) = 10.

Reviewed capability register deserialization, validation, embedded inventory, evidence references, and enablement calculation. No runtime defect substantiated in this pass. Evidence freshness/binding and validation diagnostics are improvement leads; they are not reported as demonstrated authorization bypasses.

## Story 1.10a

N = min(floor(sqrt(217037 / 1024) + 1), 10) = 10.

- `engine/codex-rs/inquello-service/src/login.rs:101` captures the current time before acquiring the transaction lock at line 167, and the expiry check at line 170 compares against that stale timestamp. `engine/codex-rs/inquello-service/src/sessions.rs:303` and line 331 repeat the pattern for refresh. A database lock wait spanning the credential or transaction expiry can therefore allow an already expired credential/transaction to succeed. Refresh the clock after acquiring the lock before enforcing expiry. This is a source-verified timing defect; no live PostgreSQL lock-wait reproduction was run.

Reviewed identity configuration, OIDC verification, transaction/bootstrap/session services, command receipts, server routes, and database schema.

## Story 1.10b

N = min(floor(sqrt(332698 / 1024) + 1), 10) = 10.

- `desktop/src/main/identity/session.ts:239` starts sign-in outside the exclusive session-operation queue. `session.ts:461` allows sign-out to succeed when no record exists, while the earlier sign-in can later commit a record at lines 368–383. Signing out while browser sign-in is pending can consequently be followed by a signed-in state without another explicit sign-in request. Cancel/invalidate pending sign-in when sign-out is requested.
- `desktop/src/main/identity/session.ts:613` catches and logs persistence failures while retaining the updated credential state as though storage succeeded. If rotating credentials succeeds remotely but writing the new record fails, the application continues with new credentials in memory and old rotated credentials on disk. On restart, refresh uses the stale token, which can trigger replay revocation of the session family. Persistence failure must change the exposed storage/recovery state.
- `desktop/src/main/identity/session.ts:539` handles logout's authentication failure by attempting refresh; the refresh failure path can retain a still-existing session when transport delivery is known not to have occurred. Nevertheless, the logout path proceeds to local clearing and reports success at line 550. An offline refresh after a logout 401 is not evidence of successful server revocation; retain a pending revocation state instead of reporting confirmed sign-out.

Reviewed desktop identity transport, loopback flow, credential vault, session state machine, logout/refresh recovery, and server TLS changes. These findings follow current source paths; no live identity issuer/database exercise was performed.

## Story 1.11

N = min(floor(sqrt(246937 / 1024) + 1), 10) = 10.

- `engine/codex-rs/inquello-service/src/workspace_commands.rs:110` counts active administrator memberships without excluding disabled principals. The administrative policy check at `engine/codex-rs/inquello-service/src/admin.rs:317` has the same omission. If the only other administrator principal has been disabled, a currently functioning administrator can remove/demote their own membership while satisfying this check, leaving the workspace with no principal able to authenticate and administer it.
- `engine/codex-rs/inquello-service/src/workspaces.rs:589` checks that an invite grantor still has active membership and permission, but does not check whether the grantor principal is disabled. An invite can therefore remain redeemable after its grantor has been disabled, although that principal can no longer authenticate to issue the same grant.

Reviewed role definitions, authorization decisions, workspace commands, membership changes, invitation redemption, admin commands, and shared-state lookup. Disabled-principal scenarios are source-verified; no PostgreSQL integration reproduction was run.

## Story 1.12

N = min(floor(sqrt(217735 / 1024) + 1), 10) = 10.

- `desktop/src/main/data/inventory.ts:70` inventories symbolic links using their path category without retaining/rejecting the symbolic-link type; `desktop/src/main/data/export.ts:93` later opens the path and follows the link. A link placed under an exportable task-history directory can target an excluded identity/provider credential file, causing its bytes to be included in the export under the harmless history path. Parent independently reproduced the cross-category credential export in `/tmp/inquello-repro-export-symlink.cjs`.
- `desktop/src/main/data/export.ts:165` uses a relative-path check that treats any path beginning with `..` as outside the root. A descendant literally named `..backup` is therefore classified as outside even though it remains under the governed root, allowing an export destination that should be rejected as recursive/in-place. `desktop/src/main/data/inventory.ts:51` uses the same incorrect containment test. Check for `..` as a whole path segment, not a string prefix.
- `desktop/src/main/data/export.ts:104` ignores the `bytesWritten` value returned by `FileHandle.write`. A short successful write is legal; the export would then contain fewer bytes than the input hash and manifest describe, while the operation reports success. Loop until each buffer has been fully written.
- `desktop/src/main/data/service.ts:311` discards an already produced import/deletion result when restarting the runtime fails. Files may already have been imported or deleted, yet the caller receives only a failed operation and loses the applied-result details. Return the completed data-operation result with a separate restart error so users can understand the irreversible changes that already occurred.

Reviewed governed-root inventory, export/import manifest handling, copy and restore paths, local deletion, export journal, desktop integration, and local-data UI. Symbolic-link behavior has concrete parent reproduction; other retained items are source-verified.

## Story 1.13

N = min(floor(sqrt(210852 / 1024) + 1), 10) = 10.

- `desktop/src/main/providers/index.ts:149` overwrites the stored Claude key state with each verification outcome. `desktop/src/main/providers/status.ts:84` treats `unreachable` as an authorized inference route. After the key has been explicitly rejected, retrying verification while offline changes it to `unreachable` and makes that same rejected key authorized again. Preserve the last conclusive rejection separately from the most recent network-check result.
- `desktop/src/main/providers/claude-vault.ts:126` clears an in-memory key only through the provider removal path. Local-data deletion operates on governed files, and the `DataService` wiring in `desktop/src/main/main.ts:319` has no provider-memory clearing hook. When safe storage is unavailable and a Claude key is stored only in memory, deleting the corresponding local credential data can report no files remaining while the credential stays configured and usable until process exit.
- `desktop/src/main/providers/codex-account.ts:58` maps an unrecognized nonnull account object to `{ type: 'other' }`; the status path at line 88 considers a known nonnull account connected and authorizes its route. A malformed `account/read` payload such as `{ account: {} }` can therefore become an authorized connection rather than an invalid/unknown state. Validate the expected account discriminator before treating the response as authenticated.
- `desktop/src/main/providers/index.ts:91` builds every provider-operation result by awaiting the complete provider status refresh. That refresh includes Codex `account/read` even for Claude key storage, removal, and verification. A stalled Codex request prevents an already completed Claude operation from returning, coupling otherwise independent provider controls. Return the completed operation promptly and refresh the unrelated provider independently.

Reviewed provider status composition, Claude vault and verification, Codex account/login handling, child configuration, main-process operations, and provider settings UI. Rejected-key state regression and memory-only deletion are source-traced; no external provider calls were made.

## Coverage and limits

Covered all 14 packets; Story 1.1 had no implementation content to review under the requested context-free rule. Retained 25 findings across the remaining packets, with explicit no-finding coverage for Stories 1.6 and 1.9. The requested numeric floors were not met; further speculative findings were deliberately omitted. Current-source paths are under `engine/` where older packets used `fork/`.

Concrete local reproductions were run for duplicate ARIA IDs and the identical-operation SQLite race. The export symlink reproduction was supplied by the parent. No tracked files were modified. This review did not execute a production issuer flow, PostgreSQL scenarios, Windows-specific behavior, browser rendering/accessibility testing, or an exhaustive imported-upstream review. Source-traced timing and state-machine issues are identified as such above. The fake-child shutdown hypothesis and generic RPC queue/timeout hypotheses were excluded after trusted-runtime evidence was supplied.
