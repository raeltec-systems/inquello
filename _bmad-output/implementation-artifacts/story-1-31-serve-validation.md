# Story 1.31 — maintained real-issuer serve entry checkpoint

2026-11-02 06:10 UTC. Service entry implemented and tested; actual Auth0 pilot is NOT yet launched.

- Existing inquello-service binary now supports serve --config ABSOLUTE_PRIVATE_JSON [--exit-on-stdin-eof].
- Maintained library start, hardcoded Production, empty JWKS for exact real-issuer discovery, loopback HTTPS only, explicit named database environment, explicit lifetimes. No test issuer, membership seed, account linking, delivery activation, certificate generation or OS trust mutation.
- Strict duplicate/unknown config/flags, bounded regular files, fixed-category errors, exact public issuer and fixed callback checks. Existing lifetime validator reused; its visibility alone changed to pub(crate).
- Service shuts down only its own listener/tasks; it never drops the supplied database. Operator setup and ACL requirements documented in engine/codex-rs/inquello-service/SERVE.md.

## Evidence
.tmp/story131-serve-verify.ps1 PID24392:
ordinary no-default-features inquello-service binary build PASS (1m20s), full domain/protocol/service **280 tests PASS**, including8newserve tests. Initial strict clippy failed on one test-style err_expect lint; original evidence preserved in story131-serve-clippy-first-failed.log and tests-first-pass.log.
One test-only correction used existing redacted ServiceConfig Debug; no new Debug implementation or production code change.
.tmp/story131-serve-rerun.ps1 PID19104 exit0: affected8tests PASS and strictclippy --all-targets -Dwarnings PASS (7.23s), fmt/diffcheck PASS. No blind repeat of unchanged fullsuite/binary.
Frozen ordinary NO-test-issuer executable:
.tmp/story131-serve-production/inquello-service.exe
SHA256 9AF80FC7FFD3F19655CC6B15A07435BD3243F8A9133B341F6F42A13F8EF27083.
Test-feature builds subsequently used separate target output; the production copy is preserved.

Tests cover flag/JSON duplicates, unknown/missing configuration, invalidbind/issuer/callback/lifetimes/skew, explicit/missingDB, bounded/malformedTLS, mismatchedTLS refusal beforeDB, ordinary HTTPS startup with zero principals/workspaces/memberships, stdinEOF listener shutdown with database preserved, and safe CLI errors.
All network tests used owned local PostgreSQL/TLS and example issuer metadata without remote discovery/login. No real account, provider credential, vendor email or trust store action.

## Remaining
Matched native refresh, approved normal isolated development profile with explicit owned resume proof, reviewed persistent pilot runner/TLS/database setup, then observed real Auth0 signup/switching/recovery. Scoped pending journal and wider onboarding acceptance remain unfinished. Existing unknown topology28340 untouched. No builder remote actions.
