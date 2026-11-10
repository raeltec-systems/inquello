# Quota reader binding verification — 2026-11-01

Source repair: `35e20d6eaba05c73aa3fabca3bfe2f0506f3ae03`; protocol stamp: `b5c360bb03b9596024199fdf85236076f949e508`.
Engine tree: `0f1c042921b0736e1d1926d2975bb497b5016599`.

- Main service/security/route tests: 245 passed across six files; main TypeScript passed.
- Native guards: 25 distinct tests, 28 passing executions. Covers exact quota fixture/current route/session/principal/connection, fresh authority and mid-await clear/revocation, ordinary credential refusal, real-data refusal, private transport origin, queued disclosure fences. The redundant `private_queue` Cargo invocation was stopped before execution; no coverage is claimed from that empty-name filter. Actual named queued tests ran against the completed exact test binary.
- App-server + CLI build: passed, 5m41 native; matched protocol generation 816 files and desktop build passed; entire launcher363.99s.
- App-server SHA256: `4518099D5F428BAC23AE009E9C836C2F73BFE9ED4D4DE7562D9E606DD8BD7C47`.
- CLI SHA256: `60D497726E27D3443994FA06DC3D6CC04484929F471746CEC4C27A34032F760B`.
- Actual isolated Electron quota journey: passed70.46s, no missing/failed checks, zero fixture-provider calls, cleanupErrors empty. Artifact `.tmp/inquello-seeded-smoke-nX1YOH/quota`, launch log `.tmp/quota-binding-candidate/quota-full-shell.log`.

This proves the dedicated synthetic quota scenario, not a real provider call, production signup, or complete Epic1 acceptance. Release-build fixture absence remains source/dispatch-tested rather than a freshly executed release binary. The extended Rust integration witness remains pending Linux execution: its explicit Linux-only target compiled but selected zero tests on Windows. That invocation is not a pass and does not add coverage. The actual Windows full-shell quota result above is separately executed evidence.
