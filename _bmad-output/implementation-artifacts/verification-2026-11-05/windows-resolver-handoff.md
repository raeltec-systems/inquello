# Windows resolver held handoff
## Result and scope
Windows host resolution now accepts only ordinary fully-qualified drive-rooted existing .exe regular files, canonicalized through existing AbsolutePathBuf/dunce. Bare/relative/drive-relative, UNC/device, ADS/NUL, unsupported extension, missing/directory/broken-link paths stay unresolved. No PATH/PATHEXT lookup, dependency, permission change, classifier, guest behavior or argv change. Canonical rule matching is unchanged.
Only two native files changed. Exact current hashes, patch, builds and historical test outcomes: windows-resolver-handoff.json and windows-resolver-current.patch. Existing desktop/planning/untracked files are preserved.

## Corrected diagnosis
The first broad native run had four failures. Full access is host execution and now has a valid native PowerShell fixture. The other three tests are NOT host-only after their Task folder exists. tools_exec_plan derives guest scope from a valid existing Task folder and selects BoundedGuest on Windows. WslExecPlan.connect_tracked requires the real profile binding at D:/Inquello/profiles/<scope>/bindings/<task>.json; the unit fixture creates only a host directory, without transfer/binding. Replacing those commands with Windows executables was incorrect and was fully reverted. Original guest argv and all assertions remain.

The missing-folder assertion is a separate call-order case: absent folder means no valid run_folder/scope, so resolution uses Host before the later missing-folder check. An unresolved bare true can therefore return permission_required before task_folder_missing. A native resolved no-op is appropriate only for that initial missing-folder request; do not create the folder early or change the expected error.

## Prepared real guest fixture plan (not implemented)
- Test-only Windows RAII helper, exact TempDir/tasks parent, fixed fictional ALICE and fresh test Task ID. No fabricated binding/storage proof or production resolver shortcut.
- Use already-built desktop/dist WslTasks(taskParent, principal).transition(taskId, 'linux') after make_folder. Use original Linux commands and rule prefixes for bounded execution.
- Use existing wslDataStorage(taskParent, () => null).erase() for ownership-checked guest/profile cleanup. Construct guard before setup so partial setup failures also clean only the exact owned scope.
- Successful tests must fail if cleanup fails. During an existing assertion unwind, preserve cleanup failure evidence without hiding the original failure. Record scope/task/setup/cleanup results in test output.
- Child Node environment must be cleared, then allow only SystemRoot/WINDIR/USERPROFILE (existing .wslconfig preflight), System32 PATH, and D-only TEMP/TMP/TMPDIR. No credentials or NODE_OPTIONS. Resolve installed Node to an absolute regular file; fail clearly if Node, built desktop module or guest prerequisite is missing. No downloads, skips, fabricated readiness or test timeout relaxation.
- Three original bounded tests need real guest setup. Full-access fixture needs no guest.
- Run entire app-server --lib inquello test set, not just new tests. Existing guest tests and original desktop integration witnesses remain required. A test-only fixture is not a claim of complete Epic acceptance.

## Commands and handoff
Native: cargo with --offline --locked -j4, CARGO_INCREMENTAL=0, development/test debug=0, D:/Toolchains Rust/Cargo/temp. Fixture target D:/Inquello/cache/fixture-20261105 with inference-fixtures; standard target engine/codex-rs/target without that feature.
Owned Docker receipt: D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json. run-docker-resolver-witness.cjs preserves ownership/loopback/private receipt checks and invokes installed Vitest directly with run --configLoader runner. It deletes INQUELLO_APP_SERVER intentionally, exercising the rebuilt default standard binary; fixture binary is separate.
Desktop worker now owns policy-fixture correction and full integration reproduction. No concurrent edits or builds until it releases. No native processes owned by this worker remain active. No staging, commit, push or guest-runtime installation performed.
