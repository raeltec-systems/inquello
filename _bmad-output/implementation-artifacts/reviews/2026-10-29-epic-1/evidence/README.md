# Review evidence

All credentials and private markers used by these fixtures are synthetic. No live provider requests were made. The scripts operate on temporary data; they are review reproductions, not application tests or proposed fixes.

The JavaScript fixtures expect the reviewed workspace at `/workspace/inquello` and an existing desktop build (`pnpm run build`). They load the real compiled main-process modules and replace external dependencies only where described in the report. `logout-repro.cjs` also transpiles the repository's identity test fakes into `/tmp/inquello-edge-identity-fakes.cjs`; run it before `additional-repros.cjs`, which reuses that fixture module. Other absolute workspace paths may need adjusting on another machine.

`additional-repros.out` records three distinct controlled cases: delayed bootstrap after local discard, vault save failure after remote refresh, and a legal partial-write return from the output file handle. The partial-write experiment does not claim to have induced a real kernel/filesystem short write. The import consequence is established by tracing the same copy helper's caller in `data/import.ts`.

`sqlite-race.rs` wraps the real SQLite adapter in a two-party barrier after the initial state read. Its two identical commands use the same operation ID and expected revision. `sqlite-race.out` records one successful receipt and one false revision conflict; order and generated timestamp vary.

`refresh-mutation.out` comes from a disposable copy with only `runRefresh`'s persistence call removed. The original repository source was unchanged. The verification layer's raw report explains the mutation and why the existing encrypted-byte assertion does not detect it.

Build and test logs are from the review session. They are not evidence of PostgreSQL integration, real OS-keyring behavior, a fresh Electron visual/accessibility smoke, or production eligibility. See the main report for exact counts and limitations.
