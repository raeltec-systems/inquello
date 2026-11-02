# Owned Auth0 development pilot — qualified startup, human authentication pending

Normal Electron, normal system-browser OAuth/PKCE/state/nonce and Production service. No smoke mode, synthetic issuer, membership seed, model/provider activation, delivery activation or OS trust installation. User enters credentials directly in browser. Hosted signup/recovery/account switching remain actual pilot checks; local signout does not clear Auth0 browser session.

The 2026-11-02 qualification passed583 deterministic tests (2 explicit Windows symlink skips), protocol generation/build and actual normal Electron isolated-profile/runtime readiness. It does not prove hosted authentication or user-close/resume yet.

## Preconditions
- Engine tree4846abe8470db3c1ae45e26d71ad05980a41b348 committed, ordinary service SHA9af80fc7ffd3f19655cc6b15a07435bd3243f8a9133b341f6f42a13f8ef27083 retained.
- `.tmp/story131-serve-matched/matched-build.json` native build terminal and checked; desktop protocol/build/tests have passed against it.
- Reviewed maintained `desktop/scripts/run-auth0-pilot.cjs` and dev-profile gate.
- Installed PostgreSQL18 psql and Git OpenSSL executable preflight; existing private test-env setup is sourced, never printed.
- Explicit new absolute root and stable unprivileged service port, distinct from fixed Auth0 callback43821. Neither port occupied; no fallback.

## Commands (after qualification and resource authorization)
From D:\Projects\inquello in PowerShell, source `. .\.tmp\story121-env.ps1` privately. Then:

```
node desktop/scripts/run-auth0-pilot.cjs --root D:\Inquello\tmp\inquello-auth0-pilot-20261102 --port 45443 --manifest D:\Projects\inquello\.tmp\story131-serve-matched\matched-build.json
```

Root must not already exist. Runner creates only its own named database and TLS, private root ACL, config and empty profile. Read only public PILOT_READY plus lifecycle evidence; never dump config/environment/session/log contents. Readiness requires actual app.getPath isolation and runtime handshake.

Close the Inquello window normally to stop runtime and service gracefully. Runner retains database, TLS, configs and user work. Ctrl+C is an emergency owned-process shutdown and may interrupt a pending action; do not discard recovery envelopes. Never kill unknown existing topology PID28340.

Explicit continuation of the SAME run/config/database:

```
node desktop/scripts/run-auth0-pilot.cjs --resume D:\Inquello\tmp\inquello-auth0-pilot-20261102 --manifest D:\Projects\inquello\.tmp\story131-serve-matched\matched-build.json
```

A partial initialization, changed config/issuer/database authority or absent proof fails closed; do not delete/adopt/recreate automatically. Seven-day scoped certificate expiry requires operator renewal design; no claim of indefinite resumability. No cleanup/delete command is provided. Retained test data cleanup needs separate authorization.

## Human journey
Open Account → Workspace setup and team → Sign in / Sign up / Recover account. Follow normal external Auth0 browser. Observe fixed43821 callback, verified-email state, create Mupeta & Partners through UI, invite and accept only deliberate intended accounts. Email delivery remains unconfigured; no actual email is sent. The invited verified user discovers the invitation after login; a notification is not an authority grant. Test browser-session account switching separately; no synthetic hint can prove it. Do not enter secrets in chat.
