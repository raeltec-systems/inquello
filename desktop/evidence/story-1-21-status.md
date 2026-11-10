# Story 1.21 — local implementation status

Baseline: `3c7b4e9931e14ebb692f3f93f55fa396cf2941f4`.

Implemented: runtime-backed S07 capability inventory and management, default-deny local MCP policy, exact-source runtime admission, cancellable runtime-owned OAuth, hosted-app browser handoff, safe configuration persistence, and isolated regression tests. Two independent three-layer review rounds were triaged and corrected.

## Final executed verification

- Desktop build and TypeScript: passed.
- Focused desktop checks: 473 tests passed across 9 files.
- Full suite: failed; 981 passed, 3 failed, 5 skipped (35 files passed, 11 failed, 1 skipped). Eight integration collections lack the runtime; design/reference icons and logo are absent; schema assertions lack Git metadata and the complete generated tree (48 present versus 816 recorded). Failures are not counted as passes.
- Five missing font warnings mean visual/native rendering is not certified.

## Required completion gates

Rust compilation/tests/clippy/fmt, matching runtime builds, actual generated protocol/schema/stamp, real-runtime integration, isolated database topology, and seeded Windows/keyring smoke remain unrun or blocked. Protocol generation is required build work, not an optional check. Use the exact sequence in FORK-CUT.md and run guarded_mcp_rpcs, oauth_cancel_rpc and plugin_install_rpc native regressions. Do not hand-edit generated artifacts.

Hosted-app metadata does not establish authenticated connection identity; UI reports unknown/not callable rather than guessing. If pending MCP cleanup cannot be confirmed during provider logout, runtime stops and instructs restart/retry; provider credentials are explicitly not claimed removed. Runtime cancellation does not revoke provider-hosted browser authorization.

Story remains in progress, not release-certified. No real credentials or external authorization grants were used in testing. Earlier R4 Windows active-ancestor-swap and R9 real-runtime recovery limits remain; R5–R8/R10 remain outside this change.
