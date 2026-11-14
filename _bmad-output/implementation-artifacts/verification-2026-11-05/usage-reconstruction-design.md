# Narrow usage observation reconstruction

This is a separately demonstrated observation-race repair, not a proven explanation of final-1. The retained database proves that model selection/settings did commit atomically; the original immediate usage failure code is unavailable.

Keep `invalidate()` as the hard principal/runtime/authority fence. Add `observationsChanged()` for existing main `privateScope=false` completion notifications, whose documented contract is observation refresh only. The hard generation, principal, runtime instance and readiness remain fixed across a read's attempts. Only a successful phase superseded solely by the observation counter may cause one fresh reconstruction of the entire read. Re-inspect current Task/Workspace policy and reread native usage. Never reuse the old payload, retry a native/service error or malformed payload, retry more than once, or replay `set()`.

Deterministic baseline reproducer: start `forTask` with `inspectEnvironment` deferred; route `notifySettledWork`'s existing sandbox-completion `environmentChanged(false)` callback to current production `usage.invalidate()`; release successful inspection. Current implementation returns unavailable and dispatches no native usage read. Expected after repair: callback calls `observationsChanged()`, first observation is discarded, a fresh second inspection succeeds, and exactly one native read publishes.

Add held-native-response variant, repeated observation change bound, hard invalidation/identity/runtime/readiness changes at either phase, denied authority, malformed native response, native error and mutation no-replay regressions. Existing hard-invalidation tests stay unchanged. Execution waits for current-source guest build ownership release.
