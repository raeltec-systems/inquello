# OAuth callback socket teardown repair, 2026-11-06

## Scope and source
Story 1.21 approved lifecycle repair only. Changed engine/codex-rs/rmcp-client/src/perform_oauth_login.rs and added src/oauth_callback_transport.rs. No dependency, protocol, credentials policy, provider validation or credential-persistence arbitration changes. No real grants, installs, downloads or publication. Original app-server RPC cancellation regression is unchanged.

The callback listener uses the existing Axum/Tokio dependencies. A cancellation-aware wrapper wakes and closes accepted idle/partial/read/write sockets as well as stopping the listener. The callback-closed signal follows awaited server/connection termination. Completion, cancellation and timeout wait for this signal. A terminal callback is delivered to the OAuth flow only after its response flush/shutdown, avoiding a fast completion truncating the browser response. Every response closes the HTTP connection; duplicate callbacks are refused. Address diagnostics deliberately exclude pending callback code/state. Existing path/state/issuer validation and the credential-write mutex are unchanged.

## Evidence
- Baseline unchanged source c7cc44396822ac8b3d9a2e6c6436d5fbbb7510aeea5660764c2b56aae24c805d: compiled successfully, but the unchanged app-server RPC cancellation test failed with deadline elapsed after cancelled/completion=false. Log oauth-baseline-20261106.log. Native process 7972 finished; cargo exit 101, 0 passed/1 failed, 12.12 seconds.
- First candidate full rmcp test stopped before compile because tracing-test 0.2.5 was missing in the guest offline cache. No download was attempted.
- Existing Windows cached tracing-test and tracing-test-macro 0.2.5 archives were copied to the owned guest cache after and before SHA256 verification against Cargo.lock. No network or version change. Record oauth-cached-crate-reuse-20261106.log.
- First candidate app-server compilation found a missing Debug bound on the custom listener address. Corrected with address-only Debug, not pending callback data.
- Final tested source snapshot e17d128f56c29904fa258a771870788ae272edbc751dd7a2d0470972a57e693d: codex-rmcp-client full library test target passed 270 tests, zero failures, one existing ignored test, 59.27 seconds. This includes five new socket/timeout/drop tests, strengthened cancellation sockets, all four persistence-arbitration tests and existing enterprise login lifecycle/privacy tests. Log oauth-candidate2-20261106.log; source receipt oauth-candidate2-source-20261106.json. Process 19284 exited zero.
- Windows installed rustfmt 1.99.1 --check and git diff --check passed for the edited source. Only the documented unstable imports-granularity warning appears.

## Pending and blocked
The next unchanged app-server RPC test stopped BEFORE Cargo because the existing guest-isolation preflight detected /mnt/wsl Docker sockets, /mnt/wslg, /tmp/.X11-unix and binfmt_misc mounts. Process 21364 exited 1; oauth-rpc-candidate2-20261106.log. No guard, mount, configuration or restart was changed by this worker. The passing library run is functional fixture evidence, not sandbox-isolation qualification.

Still required: restore the previously authorized isolated build workflow, run the unchanged RPC regression on the final candidate, run relevant clippy, then coordinator's final matched runtime builds/protocol regeneration/full desktop suite/seeded smoke. Windows socket behavior is not yet runtime-tested. Do not mark Story 1.21 or Epic 1 complete from this checkpoint.

## Reproduction
New runners under this directory preserve sanitized guest environment, offline/locked builds, four workers and CARGO_INCREMENTAL=0:
- run-oauth-baseline-20261106.py
- run-oauth-candidate2-20261106.py (freezes/stages source before full rmcp lib tests)
- run-oauth-rpc-candidate2-20261106.py (pins the already-staged final tested snapshot)
No existing source snapshot was edited. The active owned target is /opt/inquello/build/offline-20261105-1752/target in Inquello-Engine as user inquello. Final coordinator gates must match final source, not assume this intermediate snapshot covers later changes.

## Frozen raw source hashes
- perform_oauth_login.rs: f22f5b2ec84a75954e9a537e5ab105ea41b83dc31ba9d11bb8c27437e568e938
- oauth_callback_transport.rs: dc1203e43da04cb06c9ae3e6a00bf82c3b5f59ab58d9404c6d030b3ea1b10e34

The one ignored rmcp case is the existing subprocess helper store_lock_is_released_when_holder_process_exits_child; the parent store-lock test invokes that helper successfully. The aggregate remains reported as 270 passed / 1 ignored, without inflating the tally.
