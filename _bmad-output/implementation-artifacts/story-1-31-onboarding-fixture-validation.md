# Story 1.31 — owned onboarding issuer fixture checkpoint

2026-11-02 05:02 UTC. This is test-fixture groundwork, not actual Electron acceptance or hosted Auth0 signup proof.

## Change
- Explicit debug/test-issuer `--onboarding` topology starts a disposable database with no workspaces or memberships; all seed options and foreign smoke/provider flags are rejected.
- Fixed fictional Chanda Mwansa (`chanda.mwansa@mupeta.invalid`, stable subject `synthetic-developer`) and Elias Ndlovu (`elias.ndlovu@mupeta.invalid`, subject `synthetic-colleague`) are selected by fixed `chanda`/`elias` hints only.
- Identity is copied into each authorization code. Unknown/missing hints reject; token-request hints reject and consume the code. Interleaving cannot rebind subjects. Existing client, redirect, PKCE, nonce, expiry and replay checks remain.
- Explicit mode requires exact loopback, synthetic client/subject/redirect profile. Default provider remains one-subject/unverified. Production OIDC unchanged.

## Verification
Launcher: `.tmp/story131-onboarding-fixture-verify.ps1`, PID 17360, terminal exit 0.
- Offline/locked Cargo -j1; existing environment sourced without printing secrets.
- Missing test-issuer feature binary gate: expected refusal PASS.
- cargo fmt PASS; git diff --check PASS.
- Full domain/protocol/service suite: **272 tests PASS**, including 18 onboarding and 15 topology tests.
- Six new tests cover unchanged default behavior, signed interleaved identity claims with normal service bootstrap and zero memberships, unknown/missing/token-override/cross-code negatives, seed/foreign-flag refusal, non-synthetic profile refusal, and owned empty-database startup/cleanup.
- Strict clippy --all-targets -- -D warnings PASS.
- Logs: `.tmp/story131-onboarding-fixture-{no-feature,fmt,tests,clippy}.log`.
- Real PostgreSQL and owned local synthetic HTTPS issuer only. No real Auth0, external email, vendor credentials or inference.

## Remaining
Desktop owned-profile gate/probe, rematched native runtime, actual visible create/invite/accept/role-change journey and inspected PNGs remain unexecuted for this increment. Release-mode guard has source review but no release binary execution claim. Approved scoped pending journal and wider acceptance remain pending. Existing unknown topology PID 28340 was not targeted. No remote publication by this builder.
