# Focused review fixes: R1–R4 and R9

Validation date: 2026-10-30. Baseline: `20c8aef35be7f4a6c4f80ecc57a8a0804d7d201c`.

## Scope

- R1: refuse an occupied working-store DB/WAL/SHM family; stage and verify the complete working-store directory before publication. Failed second-file copies and competing nonempty destinations cannot mix or partially publish the family.
- R2: stop all runtime writers before export inventory/copy, then restart in finally. Refuse active work and stop failure. Serialize initial startup/shutdown; do not restart once the application is quitting.
- R3: refetch current authority and effective policy after permission. Bind immutable argv, principal, runtime and policy/profile; changed or unavailable context refuses the old approval rather than silently broadening it.
- R4: reject pre-existing linked destination ancestry. Linux pins parent descriptors; portable ancestry rechecks and exclusive publication strengthen other platforms, with the residual race below.
- R9: add populated real-runtime recovery coverage and a runnable real SQLite/DataService semantic recovery test using originals independent of the export manifest.

R5–R8 and R10 from the review are not included. No story completion or release readiness is asserted by this corrective commit.

## Executed verification

From `desktop/`:

```sh
./node_modules/.bin/vitest run --configLoader runner \
  test/data-import-boundaries.test.ts test/data-operations.test.ts \
  test/data-policy.test.ts test/data-recovery.test.ts \
  test/policy-units.test.ts test/permissions-units.test.ts \
  test/tool-bounds-units.test.ts test/policy-shell.test.tsx \
  test/permissions-shell.test.tsx test/runtime-lifecycle.test.ts
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc -p tsconfig.build.json
./node_modules/.bin/tsc -p tsconfig.renderer.json --noEmit
node scripts/check-data-policy.cjs
```

Results: 10 focused test files / **148 tests passed**; all three TypeScript checks and policy validation passed. An independent focused rerun passed 42 overlapping tests, not 42 additional unique tests. The SQLite fixture had committed WAL content before export and verified Task/state/receipt rows and output bytes after import and a second reopen. Its small schema is not the domain runtime.

The complete desktop test command was also attempted: **32 files passed, 10 failed, 1 skipped; 847 tests passed, 3 failed, 5 skipped**. Seven integration files failed collection because the built `codex-app-server` was absent. Design collection and one navigation assertion lacked imported design reference assets. Two schema assertions failed because the materialized snapshot lacked Git metadata and contained 48 required generated declarations rather than all 816 files. These observed failures are recorded, not represented as a full-suite pass. The skipped identity integration had no configured topology.

Environment: Node 24.22.1; available pnpm 11.25.0 with frozen lockfile and install scripts disabled. The repo declares pnpm 10.34.5; use that pinned version for remaining verification. Package manifest and lockfile were unchanged. No Electron binary installation hook ran. Patch applicability and exact output bytes were checked against the pinned originals.

## Open validation gates and limitations

1. **R4 is not fully closed for a hostile concurrent same-user actor on Windows/macOS.** Pre-existing links are rejected, but Node has no portable descriptor-relative API and ancestry rechecks retain an ancestor-swap race. Linux tests do not certify Windows. Filesystems without hard-link support refuse per-file publication rather than falling back to overwrite-prone writes.
2. Native Windows import behavior remains unverified. Existing-empty-directory `EEXIST`/`EPERM` behavior was simulated on Linux; the fallback removes only a verified empty real directory, nonrecursively. Unknown non-SQLite files are preserved by refusing restore.
3. **R9 full domain/runtime recovery test is added but unrun.** No pinned runtime binary or Rust toolchain was present. The supplemental SQLite test does not replace it.
4. Real service/database permission integration, packaged Electron smoke and full builds remain to be run in the provisioned environment. Main TypeScript emit is not an Electron package build.
5. Directory publication is atomic under tested filesystem semantics, not a certification of directory-fsync/power-loss durability. Abrupt quit and native platform crash behavior remain untested. Existing SIGTERM-only stop behavior (R8) is unchanged.
6. Old permission execution cannot resume on a replacement runtime due to instance binding, but existing pending rows/waiters may remain until decision/expiry; verify this UX in packaged smoke.

## Provisioned-environment follow-up

- Build the pinned `codex-app-server` according to `FORK-CUT.md`, or point `INQUELLO_APP_SERVER` to that build; run `test/data-integration.test.ts`, including populated recovery and durable operation-ID replay.
- Use the complete Git checkout/generated protocol/design assets; configure the documented database/service topology and run the full desktop suite, explicitly reporting skipped tests.
- Run native Windows linked/junction ancestry, empty-directory restore, late-target, hard-link and permission-failure tests; document the accepted concurrent-local-actor threat model.
- Run packaged Electron export/restart/recovery and permission smoke before marking the gates closed. Do not treat these documented omissions as passes or erase them merely because publication was authorized.
