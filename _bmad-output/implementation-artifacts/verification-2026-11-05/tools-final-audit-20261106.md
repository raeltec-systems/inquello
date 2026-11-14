# Tools Settings and callback continuation audit

Sources were frozen by the implementation workers on 2026-11-06. Parent inspected the full tracked diff and new Settings tests and OAuth transport module directly. No blind/review subagents were used.

## Observed scope
- Ordinary Settings now reaches Tools and connections for the exact selected Workspace. Null, inaccessible and loading states do not select another Workspace. Identity transition removes prior management before rereading.
- Provider account remains separate from Inquello identity and current per-Task model. Integration configuration readiness does not claim private-Task invocation; configured MCP/apps/plugins stay disabled by existing private-Task guards.
- New native transport owns the listener and accepted streams. Cancellation wakes reads/writes, graceful shutdown waits connection completion, and callback delivery follows response flush. Existing credential-save/cancel arbitration is unchanged. No dependency, lockfile or public protocol change.
- Synthetic provider-independence coverage uses a new canonical CODEX_HOME-keyed native keyring entry only. Fixture-only plugin disablement prevents fake-login startup downloads. Cleanup retains its locator if credential deletion fails; no real credential or user profile is used.

## Verification boundaries
Focused desktop tests: 149 passed; production desktop build passed. Candidate Linux rmcp library: 270 passed, 1 existing ignored. Original app-server OAuth cancellation RPC reproduced failing on pre-edit source; candidate RPC still pending at this audit point. Full current-source Windows builds, desktop suite, seeded smoke and actual screenshot inspection remain mandatory before push.

The high-risk invariants are listener/accepted-socket closure before terminal return, no late token persistence after winning cancellation, preserving an already-started write as Completed, and exact Workspace/principal scoping. Bounded cancellation and credential-arbitration tests provide relevant implementation evidence; they are not formal proofs. Full model checking is not added for this focused transport replacement. Remaining real-provider/browser, OS-runtime and constructor-interruption boundaries are explicitly listed in oauth-callback-coverage-20261106.md.

## Guest initialization outcome
The unchanged isolation guard rejected ambient WSL/Docker/GUI mounts before candidate RPC started. Owner approved rerunning the existing initializer for Inquello-Engine only. The manual invocation exited 1 because its unmount overlapped the guest's asynchronous boot initializer. Subsequent read-only polling observed boot completion and an empty forbidden-mount list, with the existing VM boot ID unchanged. No WSL-wide restart, Docker stop, guard bypass or configuration edit was performed. Future test invocation must wait for boot initialization then enforce the original guard in the same guest process.

## Matched Windows checkpoint
- Native rmcp library: 263 passed, 0 failed, 1 existing ignored; tools-windows-rmcp-20261106.log. The same new callback tests and all four credential-arbitration tests passed.
- Original untouched OAuth cancellation RPC: 1 passed, 0 failed (7.74 seconds); tools-windows-rpc-20261106.log.
- Standard CLI and app-server build passed; tools-windows-build-20261106.log. Existing Windows ExecLookup dead-code warning remains; no new suppression was introduced.
- Engine-only repair plus FORK-CUT explanation committed locally as c79147358c (not pushed). Genuine generate-protocol produced 816 unchanged schema files and forkTreeHash51fff9c6403eac0f801018153ac1927514bbd3f7. No hand-stamping. tools-protocol-generation-20261106.log.
- Current production desktop build passed; tools-desktop-build-matched-20261106.log.
- Matched real-runtime Tools integration: 4 passed/0 skipped, including actual config management/restart and isolated native-keyring provider independence. desktop-full-docker-tools-matched-20261106.log. This narrowed run is not the aggregate desktop suite or live provider acceptance.
