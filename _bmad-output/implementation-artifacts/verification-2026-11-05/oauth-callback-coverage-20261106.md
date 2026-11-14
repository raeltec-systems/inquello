# OAuth callback repair test coverage

Final scoped patch: oauth-callback-final-scoped-20261106.patch (30,467 bytes; SHA256 522eaac9b91004a9573754055c3830020884820b8325b32dcc7714751bae8773). Includes the entire new transport module and the tracked login-file diff against HEAD. Created without staging, committing or modifying source. The exporter verified both raw file hashes against the passing snapshot.

Full relevant test names (38) are in oauth-callback-covered-test-names-20261106.txt, extracted from the actual passing native log. All 270 rmcp library tests passed, with one existing subprocess helper ignored at top level and run by its parent test. The full log is oauth-candidate2-20261106.log.

## New and strengthened outcomes
- perform_oauth_login::callback_transport::tests::callback_response_is_delivered_and_keep_alive_is_closed_before_result: a wrong callback path returns 400 without consuming the result; valid callback without a request Connection: close returns the complete body and EOF; the result is success; a subsequent callback returns 410; shutdown makes a fresh TCP connect fail.
- perform_oauth_login::callback_transport::tests::cancellation_closes_listener_idle_and_partial_connections_and_releases_port: four independent iterations open idle and partial-header clients, serve an independent invalid request, cancel, await closure, require EOF/reset on both clients, refuse a new TCP connection, close the callback result channel, and immediately rebind the same port.
- perform_oauth_login::callback_transport::tests::cancellation_wakes_a_proven_accepted_partial_reader: explicitly accepts the server socket and reads the partial GET bytes through the cancellation-aware stream, then cancellation makes the remaining read fail within two seconds and closes the client socket.
- perform_oauth_login::callback_transport::tests::provider_error_response_is_delivered_before_terminal_result: provider error returns its complete 400 response and error result, followed by bounded closure.
- perform_oauth_login::tests::timeout_and_dropped_flow_close_actual_callback_listener: real isolated OAuth metadata fixture; both dropping a prepared flow and callback timeout close the listener; fresh connects fail and immediate same-port rebind succeeds.
- perform_oauth_login::tests::cancelled_oauth_login_closes_callback_and_never_persists (strengthened): isolated real OAuth flow cancellation plus idle/partial sockets; completion fails, actual listener and clients close, and no stored OAuth credentials exist.

## Unchanged regression protection
All four oauth_login_cancellation tests passed: cancellation prevents late credential persistence; pending callback wait wakes; an already-started credential write wins and cancellation reports Completed; failed/completed writes are not falsely reported Cancelled.
Existing enterprise_oauth_login tests passed: loopback restriction, callback/SDK log privacy, public API storage/privacy, failed-persistence fencing and cross-process logout invalidation.
Existing perform_oauth_login tests passed: success persistence including issuer without refresh token; issuer validation before exchange; callback parser/path/ID binding; supplied HTTP client routing; scopes and redirect preservation; portless loopback redirect.
Existing pasted callback validation/redaction tests also passed.

## Explicit exclusions and pending gates
- Original app-server RPC test suite::v2::mcp_server_status::oauth_cancel_rpc_selects_exact_attempt_and_prevents_late_token_persistence reproduced failing BEFORE the fix and is untouched. Passing AFTER evidence is pending because guest-isolation preflight blocked the next run before Cargo. Helper tests are not represented as RPC-boundary proof.
- No runtime Windows socket test, real browser OAuth provider, external grant, paid call or real credentials.
- No clippy completion or final matched Windows/Linux runtime binary, generated-protocol, full desktop integration or seeded-smoke claim.
- The socket tests are bounded functional regressions, not a formal proof or sandbox-isolation certification. They cover a representative accepted partial reader, idle/partial HTTP clients, keep-alive, duplicate callbacks, success/error, cancellation, timeout and drop. Constructor interruption during delayed registration is not independently injected by a new test; listener ownership before spawn is synchronous and remains stack-owned.
- Baseline RPC failure establishes a late callback deadline failure, not independently whether its connection was reused versus newly accepted. New tests separately assert post-repair fresh-listener refusal and established-client closure.
