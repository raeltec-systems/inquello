# BMAD acceptance audit — Stories 1.1–1.13

Reviewed HEAD: `ace1ca2883cc8cf62c44dd2df9563236c025c19a`.

Scope: all 14 supplied packets in `/tmp/inquello-story-review-t_bczhks`: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10a, 1.10b, 1.11, 1.12 and 1.13. Each packet was mapped to its matching frozen spec, its acceptance/matrix requirements, the documents referenced by its frontmatter, and the corresponding current implementation. Current HEAD was used for findings, so already repaired historical behavior is not reported. Review only; no tracked file was modified by this auditor.

## Confirmed findings

### A1 — [P1] Export follows history symlinks into excluded or outside files

- **Story:** 1.12, still present after 1.13.
- **Violated constraint:** spec 1.12, lines 49–52 and 64: export includes only the governed categories; “Credentials are never included” and “No export of credentials or provider secrets.” Story 1.13 preserves the provider-vault exclusion and requires the sentinel protection test.
- **Current evidence:** `desktop/src/main/data/inventory.ts:70–79` records a symlink as an ordinary file using `lstat`, without preserving its file type. Classification at lines 98–102 uses the link's relative name. `desktop/src/main/data/export.ts:182–192` treats `sessions/linked-secret.jsonl` as included task history; `copyWithDigest` at `export.ts:90–95` opens that source with `fs.promises.open(source, 'r')`, following the link. It never checks that the resolved target remains within the same governed category/root or refuses nonregular files.
- **Failure:** a leaf symlink under `runtime-home/sessions/` pointing to an excluded credential file or a private file outside the governed roots is exported as task history with a valid digest. The manifest can simultaneously say the credential category was omitted. The pathname-based exclusion therefore does not enforce the stated export rule.
- **Reproduction:** `/tmp/inquello-repro-export-symlink.cjs`, prepared by the parent reviewer and independently rerun by this auditor against the current compiled implementation. It creates only synthetic temporary files, points the history link to an outside synthetic private marker, and reports `{"exportSucceeded":true,"privateSentinelCopied":true,"sourceOutsideGovernedRoots":true}`. Inventory calls the link `task-history`.
- **Practical boundary:** this requires local filesystem manipulation or a preexisting symlink; no remote attacker path or existing renderer filesystem authority is claimed. It is a current export-policy failure, without requiring later Task tools or real-data eligibility.

### A2 — [P2] Local-data deletion leaves a memory-only Claude key usable

- **Story:** 1.13 integration with 1.12.
- **Violated constraint:** spec 1.12 “Delete: by category” and truthful removed/retained reporting; spec 1.13 lines 40–45 and 54 requires the supported memory-only fallback, key removal, and a governed provider-vault category. The shipped category at `desktop/data-policy.json:223–240` explicitly offers deletion through Local data and labels recovery as requiring the key again.
- **Current evidence:** `desktop/src/main/data/service.ts:137–139` offers `claude-key-vault` as deletable, regardless of backend. `service.ts:262–293` has a semantic credential-removal hook only for the identity session; provider removal is never called. `desktop/src/main/data/delete.ts:97–105` only removes inventoried files. For `basic_text`/unavailable safeStorage, `desktop/src/main/providers/claude-vault.ts:91` and `108–112` keep the key in `this.memory`, which only `clear()` at lines 126–128 removes.
- **Failure:** after storing a key in memory-only mode, `data.delete(['claude-key-vault'])` returns `ok:true` and puts the category in `removed` with zero remaining files. The provider still reports `stored-unverified`; a subsequent verification still sends the retained key. Restarting the Rust runtime does not restart or clear the main-process vault.
- **Reproduction:** `/tmp/inquello-repro-memory-delete.cjs`, prepared by the verification reviewer and independently rerun by this auditor. Synthetic fake safeStorage uses `basic_text`; no real provider call occurs. Output includes `"stillHeld":true` and `{"verifyAfterDelete":true,"checkCalls":1}` after successful Local data deletion.
- **Scope note:** `provider.removeClaudeKey()` itself clears memory correctly. The missed behavior is specifically the separately offered Local data action. OS-backed deletion already reads the file as truth and is not affected by this particular bug.

### A3 — [P2] Concurrent identical store commands return a conflict instead of their receipt

- **Story:** 1.4, unchanged by later stories.
- **Violated constraint:** spec 1.4 matrix line 35: “Same op ID and same command again” returns “The stored receipt … nothing re-applied”; domain command replay/conflict semantics in the execution tasks.
- **Current evidence:** `engine/codex-rs/inquello-domain/src/commands.rs:51–60` checks receipts before reading state outside the adapter write transaction. Two identical `InitializeStore` calls can both see no receipt and revision 0. The adapter takes `BEGIN IMMEDIATE`, then checks the revision at `engine/codex-rs/inquello-adapters/src/store.rs:115–131` before inserting the receipt. The loser sees revision 1 and returns `RevisionConflict`; the domain passes that through at `commands.rs:93–95`, only doing another receipt lookup for `DuplicateOperation` at lines 96–101.
- **Failure:** the same immutable operation races with itself and yields a false stale-revision conflict, although its operation receipt now exists and its mutation succeeded once. A conflict is appropriate for a different operation or payload, not for this exact retry.
- **Reproduction:** `/tmp/blind-store-race.rs` and `/tmp/blind-store-race`, prepared by the blind reviewer and independently inspected/run by this auditor. It uses the real SQLite adapter and a barrier after the two initial state reads. Output is one `Ok(... replayed: false)` and one `Err(RevisionConflict { expected: Revision(0), actual: Revision(1) })` for `identical-op`. No tracked source changes were needed.
- **Practical limit:** no double write or corruption was observed. This is an idempotent-command acceptance failure under overlap; a later sequential retry succeeds.

## Intent/spec reconciliation items (separate from the confirmed defects)

### S1 — Story 1.12's policy ships as runtime-loaded JSON instead of being compiled in

- Frozen Approach at `spec-1-12-govern-local-data-held-by-first-route.md:21` explicitly says “reviewed, compiled-in local data-policy register.”
- `desktop/src/main/data/policy.ts:220–234` instead reads `desktop/data-policy.json` from beside package.json on first runtime use. It strictly validates and freezes that in-memory result, but changing the shipped JSON between build and launch changes classification, export and enablement rules without recompiling. The build-time validator and Rust capability cross-check cannot pin the runtime copy to the bytes they checked.
- Implementation notes openly describe this choice as a workaround for TypeScript `rootDir`; the frozen intent and empty change log do not record a matching intent change.
- Treat as a low-priority acceptance/documentation reconciliation or resolve with packaging. This is **not** evidence of a distinct exploitable security boundary: an actor allowed to alter this unpackaged app's JSON can ordinarily alter its JavaScript as well, and signed packaging is explicitly deferred. Either embed the selected register at build time or explicitly reconcile the spec with the intended packaged trust model.

### S2 — Unsupported Workspace kind versus non-disclosure needs a consistent precedence

- `engine/codex-rs/inquello-service/src/workspaces.rs:245–253` returns `not_a_member` for a missing Workspace and `route_not_available` for an existing disabled-kind Workspace before looking up membership.
- Spec 1.11 simultaneously requires unknown/forbidden resources to look identical and explicitly requires `external_audit` to return `route_not_available`. A nonmember can therefore distinguish a seeded unsupported Workspace from an unknown ID.
- This is a source-confirmed contract tension, not promoted here to a confirmed current user-route defect: normal operator commands reject creating external-audit Workspaces, and the current suite uses a fixture to represent that state. A membership-first refusal for unknown/nonmember scopes can preserve non-disclosure while keeping `route_not_available` for a caller entitled to know the Workspace. Record the intended precedence when reconciling the contract.

## Coverage by packet

“None found” means no additional confirmed current-HEAD acceptance violation in this pass; it is not a proof of full correctness. Counts are unique changed paths in the supplied packet, including generated/mechanical material.

| Packet | Paths | Acceptance trace and disposition |
| --- | ---: | --- |
| 1.1 | 5 | Cut/toolchain/import record and deferrals checked. Independently verified squash tree and original import tree both equal `307e4fa207fe563a11f3f7af09cee6fccd2d8376`; current deliberate engine patches are confined to manifest/lock and Inquello additions. Original `fork/` name and later owner rename to `engine/` respected. No new current defect. |
| 1.2 | 785 | Process ownership, stdio-only arguments, handshake/version gate, framing, stderr separation, backpressure, shutdown and generation record reviewed. Semver-only build identity and Windows tree kill are recorded deferrals. Unbounded server-response bypass already has an explicit rejected triage entry; not re-reported. No new acceptance finding. |
| 1.3 | 10 | Preload operation registry, payload and sender checks, app scheme, permissions, request/navigation/window policy and smoke probe contract reviewed. Later identity/data/provider operations are authorized later-story additions, not violations of the original one-op baseline. No new acceptance finding. |
| 1.4 | 25 | Domain ports/rules, protected SQLite location, version gate, atomic state+receipt writes and replay requirements traced. A3. Host-only dependency graph check remains explicitly deferred. |
| 1.5 | 33 | Typography/font/icon semantics, exact token/conformance tests, CSP and renderer build boundaries checked. No new acceptance finding; no independent fresh visual smoke in this auditor pass. |
| 1.6 | 25 | Native action/input semantics, pending/disabled reasons, errors/value retention, focus and reduced-motion implementation plus contrast validation mechanism checked. No additional current acceptance defect identified. Parent verification separately reports a floating-point evidence serialization mismatch. |
| 1.7 | 24 | Avatar identity, named/live Badge, roving SegmentedControl, manual/automatic Tabs, Menu focus/disabled semantics, explicit StatusChip labels reviewed. No new acceptance finding. Outside-click focus preservation when another control was clicked is an implementation-documented behavior, not treated as a security/functional defect. |
| 1.8 | 20 | Judgment basis, FileChip state/removal name, PlanStep check/state/live region, explicit ApprovalCard labels, DiffLine stage and Toast timer/focus/reduced-motion contracts reviewed. No new acceptance finding. |
| 1.9 | 16 | Embedded validated register, fail-closed eligibility, evidence kinds, inventory-map/parser tests, all-99 coverage and seed-only synthetic entry reviewed. No later capability entry or UI requirement imposed prematurely. No new acceptance finding. |
| 1.10a | 50 | ID-token validation, session/credential hashing, refresh-family behavior, transaction/receipt ordering, synthetic issuer config gating, fixtures and test matrix reviewed with SC-1/SC-2/SC-7. HTTPS and desktop portions are now supplied by 1.10b, not counted missing. No additional confirmed acceptance finding. |
| 1.10b | 48 | PKCE/state/loopback, scoped HTTPS trust, host vault, serialized refresh, persistent logout operation and renderer-safe account view traced. Explicit OS-host isolation and production/JWKS/TLS material deferrals respected. No additional confirmed acceptance finding. |
| 1.11 | 39 | Pure role/grant decisions, creator-private path, policy kinds, invite matching/replay, admin-only bootstrap, command epoch/revisions/receipts and membership matrix reviewed. S2 noted separately. No desktop/grant-issuing/content/retention work demanded from this service-only story. |
| 1.12 | 31 | Register/classifier, export/import/delete/journal, runtime-home isolation, main-operation wiring, policy display, tests and smoke claims traced. A1; S1 separately. “Empty” home allows explicitly documented rebuildable state/logs; no active Task wiring demanded before Task stories. |
| 1.13 | 34 | Both vault/account routes, environment stripping, keyring-only runtime config, provider status/identity independence, free verification, local-data integration, test/smoke negative scan and password-field clearing traced. A2; A1 remains relevant to export protection. No Messages adapter, inference, or Claude subscription OAuth requirement imposed. |

## Context, exclusions and verification limits

All matching spec frontmatters were checked. Shared context read includes `epic-1-context.md`, `FORK-CUT.md`, the linked sibling specs, `shared-service-contract-proposal-2026-10-27.md` (the applicable SC-1/2/3/7 portions), `claude-access-routes-2026-10-27.md`, and `deferred-work.md`. Future shared-data/lineage/recovery and Messages-adapter sections were treated as future-stage contracts, not missing work in these packets.

Historical packets contain generated protocol files, assets, lock/evidence data, repeated fix commits and story metadata. Review focused on their governing requirements, changed handwritten implementations and matrix tests, then current HEAD; it did not manually inspect every generated protocol declaration or upstream imported file. The supplied 1.1 packet does not include the full imported upstream tree; import integrity was checked independently using git tree objects.

This auditor ran the three focused reproductions above, all against synthetic temporary data. Full build/test and environment-backed conformance runs were performed or attempted by the parent/verification reviewers, not rerun here; their results should be reported under their own evidence. No claim of a fresh Electron visual/keyring/browser smoke, PostgreSQL 18 service run, Windows/macOS validation, actual inference, or production eligibility is made by this pass. No real provider request or real credential was used.
