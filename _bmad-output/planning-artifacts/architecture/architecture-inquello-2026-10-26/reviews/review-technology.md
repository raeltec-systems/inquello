# Technology and source evidence review

Reviewed 2026-10-27 by the independent configured `bmad-architecture` technology reviewer.

**Verdict: the architecture direction passes this lens, with one nonblocking evidence addition to the existing persistence implementation gate.** No critical or high finding. The adopted choices remain unchanged. No installation, checkout, build, runtime test, service entitlement or production suitability was established by this review.

## Reviewed snapshot

The review covered the architecture spine, relevant memlog entries, the upstream source map, current documentation note, technology evidence and release/source evidence JSONs. The spine, memlog and source notes were read-only. This report is the only file written by this reviewer.

| Local input | SHA-256 at review |
| --- | --- |
| `ARCHITECTURE-SPINE.md` | `1ab973bf8336883c72f9dd74cb04c59a5e602220c0cc0bea50246c8880c82d02` |
| `.memlog.md` | `fa13816c5376a31323208375410fd66ec0faffc1fee517f7f00fc17e68cec6cb` |
| `.working/technology-evidence.md` | `de94195d742b0ab1baeea852246bfbd1de6c4c9633947465d1cfc6e817af765b` |
| `.working/upstream-architecture.md` | `153b9a3ff2e27eeef042375f339e9a67516c47a155db6c9aaf46b6525f29db9c` |
| `.working/current-docs.md` | `131fb1d36bf5a7d988622ea44a8ef0869b18391f6e28f602906702500fbca010` |

Source evidence remains split between research pin `970111f6cb62cc02fe36a82ea7d71b37a2889c97` and previously observed main `efab30992b28bb8fc5064dbac9c12090b8818e98`. Neither is the selected delivery fork cut. This pass re-fetched bounded files at those exact revisions; it did not reinterpret either as a newly chosen or freshly observed main head.

## Finding T1 — carry the verified SQLite corruption-fix requirement into the persistence gate

**Severity:** medium evidence omission; nonblocking for this architecture contract because no domain driver/runtime is selected and implementation is already gated.

**Locations:** Stack paragraph at spine line 161; Implementation seed gate at line 236; `.working/technology-evidence.md`, Rust/domain-persistence section.

**Evidence:** the observed-main state crate does more than describe a metadata mirror. Its lines 7–10 assert `libsqlite3_sys::SQLITE_VERSION_NUMBER >= 3_051_003` with a WAL-reset corruption-fix explanation. The fetched Git blob is `5c5ecad54b1f7f480502c7cd1f0359324698553c`. [Observed-main state crate](https://github.com/openai/codex/blob/efab30992b28bb8fc5064dbac9c12090b8818e98/codex-rs/state/src/lib.rs#L7-L10)

SQLite confirms a rare corruption race affecting WAL databases when multiple connections in separate threads/processes write or checkpoint concurrently. SQLite 3.51.3 and later contain the fix; documented backports include 3.44.6 and 3.50.7. [SQLite WAL-reset bug](https://www.sqlite.org/wal.html#walreset), [SQLite 3.51.3 release](https://www.sqlite.org/releaselog/3_51_3.html)

**Why it matters:** a separately selected domain driver may bundle or dynamically load a different SQLite library. The upstream crate assertion verifies that crate's linked library, not every possible independent driver. A single logical mutation owner does not, by itself, establish a single physical connection or eliminate checkpoint races. No unsafe implementation currently exists; the omission is a concrete known compatibility fact that can be carried forward without choosing a driver or journal mode.

**Disposition:** autofix the evidence note and existing persistence gate; no new AD or user choice is needed.

**Recommended concise wording:** “Verify the domain store's resolved SQLite runtime includes the WAL-reset corruption fix (3.51.3+ or a documented fixed backport); the inspected upstream state crate's check does not verify a separately linked driver.”

## Fresh version checks

Official GitHub release metadata was re-read through the connected GitHub tool on 2026-10-27. Electron, React and current TypeScript releases were non-draft and non-prerelease. The inherited compiler is intentionally different from current TypeScript.

| Technology | Verified fact | Assessment |
| --- | --- | --- |
| Electron | Latest release endpoint returned `v45.0.0`, published 2026-10-21; release notes identify Chromium 156.0.8078.48, Node 24.22.0 and V8 15.6. [Release](https://github.com/electron/electron/releases/tag/v45.0.0), [metadata](https://api.github.com/repos/electron/electron/releases/latest) | The seed is current as checked. Bundled Node is not a claim about a separately installed development runtime. |
| React | Latest release endpoint returned `v19.3.1`, published 2026-10-14. [Release](https://github.com/react/react/releases/tag/v19.3.1), [metadata](https://api.github.com/repos/react/react/releases/latest) | Seed confirmed. React documents TypeScript/JSX and separate React/DOM types; no bundler, type-package or complete desktop toolchain compatibility is inferred. [React TypeScript guide](https://react.dev/learn/typescript) |
| TypeScript current | Latest release endpoint returned `v7.0.2`, published 2026-08-20. Microsoft describes TypeScript 7 as the native port, without the old programmatic compiler API, and documents a TypeScript 6 compatibility package. [Release](https://github.com/microsoft/TypeScript/releases/tag/v7.0.2), [announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) | Correctly retained as current-release evidence, not silently substituted into the inherited toolchain. |
| TypeScript seed | Research-pin lockfile resolves the SDK importer to `5.9.2`; `ts-jest@29.4.4` declares TypeScript `>=4.3 <6`; the parser declares `>=4.8.4 <6.0.0`. [Importer](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/pnpm-lock.yaml#L37-L86), [ts-jest](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/pnpm-lock.yaml#L2428-L2440), [parser](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/pnpm-lock.yaml#L873-L878) | Retaining 5.9.2 is grounded in resolved source and declared peer bounds. The spine correctly reserves the new desktop toolchain's validation. Lockfile Git blob: `63078c5ed5e52b21b52cd50d2a320b37d3b0919e`. |
| Rust | Observed-main toolchain declares `1.99.1`; workspace package declares edition `2024`. [Toolchain](https://github.com/openai/codex/blob/efab30992b28bb8fc5064dbac9c12090b8818e98/codex-rs/rust-toolchain.toml), [workspace](https://github.com/openai/codex/blob/efab30992b28bb8fc5064dbac9c12090b8818e98/codex-rs/Cargo.toml#L169-L176) | Accurate inherited declaration, not a claim about installed or newest Rust. Toolchain blob: `d73899d67f8cef30354ae0b4f65576f425349927`; workspace blob: `134c3f920b5eb81d7c610cd09fbee1f282aa6291`. |
| pnpm | Research-pin root manifest selects `pnpm@10.34.5` with integrity metadata, pnpm engine `>=10.34.5`, Node engine `>=22`. [Manifest](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/package.json#L33-L38) | Accurate inherited package-manager seed. It is not represented as the latest pnpm release. Manifest blob: `1a3194ed233ccf1982afad88b89737c116e1bc61`. |
| SQLite | Official guidance identifies local application/device data as a fit. Exact domain driver/runtime remains open. [SQLite use guidance](https://sqlite.org/whentouse.html) | Fit supports adopted local working metadata, not central collaboration or writable replicas. Apply T1 at the existing gate. |

## Decision and boundary verification

| Decisions | Source/reality check | Result |
| --- | --- | --- |
| AD-1 | Official inventory identifies public CLI, SDK and app-server source; it marks IDE extension and cloud as not open source. [Open-source inventory](https://learn.chatgpt.com/docs/open-source) | Correctly distinguishes reusable public components from hosted/service entitlement and unestablished desktop source. No private desktop code assumption. |
| AD-2 | Re-fetched research-pin `core-api` facade and extension exports establish real in-process seams. [Facade](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core-api/src/lib.rs#L1-L110), [extension API](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/extension-api/src/lib.rs#L55-L135) | Separate Inquello modules are structurally plausible. The source does not prove every invariant can be enforced through an unmodified extension or guarantee stable Rust APIs; those choices remain gated. |
| AD-3/5 | Current Electron guidance recommends context isolation, renderer sandboxing, sender validation and constrained navigation/API exposure. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) | The stated narrow renderer/preload/main boundary follows real supported mechanisms. Runtime message validation and Rust agent permissions remain separate obligations. |
| AD-4/7 | Re-fetched observed-main workspace includes core, core-api, app-server, extensions, rollout, state and thread-store. ThreadStore separates canonical JSONL history from explicit metadata mutation and local SQLite indexing. [Workspace](https://github.com/openai/codex/blob/efab30992b28bb8fc5064dbac9c12090b8818e98/codex-rs/Cargo.toml#L1-L176), [ThreadStore](https://github.com/openai/codex/blob/efab30992b28bb8fc5064dbac9c12090b8818e98/codex-rs/thread-store/README.md#L3-L35) | Shared Rust modules and separate domain metadata do not contradict upstream responsibilities. The spine correctly declines cross-store atomicity, a native formal ledger or implicit synchronisation. ThreadStore blob: `c6a51d3c8b62c8c3acb99671b99d8a819323d112`. |
| AD-6/8–14 | The memlog traces these to adopted boundaries and governing product/UX requirements. Their rules are implementation obligations, not assertions that an upstream package already supplies them. | No unsupported technology guarantee found. Route eligibility, complete scheduling, team coordination, formal authority and recovery remain visibly distinct from engine/runtime primitives. Requirement completeness is covered by the separate reconciliation/rubric lenses. |

Current app-server documentation identifies stdio as the default JSONL transport and ties generated schemas to the generating Codex version. Its remote Code Mode host section also warns that the command and WebSocket transport are experimental and unsupported for production. The corrected spine preserves this context and derives no blanket production guarantee from stdio. Outbound Code Mode host selection and inbound client listener selection are separate settings. No remote route was selected here. [App-server protocol, schema and remote host documentation](https://learn.chatgpt.com/docs/app-server)

Electron's utility process API still does not support writable child stdin. The evidence note correctly avoids treating `utilityProcess.fork` as a direct replacement for the Rust stdio child. [Electron utility process](https://www.electronjs.org/docs/latest/api/utility-process)

## Existing gates that should remain explicit

1. **Selected fork and generated protocol:** choose the actual delivery revision and verify the exposed seams, compiler/dependency resolution and generated client schemas together. The SDK's documented current path differs from the older research pin; that discrepancy is recorded rather than silently merged.
2. **Desktop packaging and supported platforms:** Electron 45's release notes remove several sandboxed-preload globals/modules, change ASAR file-descriptor behavior and identify only 64-bit builds. These are implementation checks under OQ-6/Implementation seed, not proof that the adopted stack is incompatible. Keep the Rust executable's packaging/lifecycle checks concrete when selecting the packager. [Electron 45 release notes](https://github.com/electron/electron/releases/tag/v45.0.0)
3. **Service and workflow supply:** public runtime source, inference-provider support, local storage and queue/heartbeat mechanisms establish neither hosted backend access nor a complete scheduler, team permission service or cross-host continuity. The spine already names those V1 gaps and owners. No scope reduction is recommended.

The review requires no change to AD-1–4, the selected seed versions or the source/hosted-service distinctions. T1 adds a verified fact to an existing implementation gate; all other reviewed technology claims are appropriately bounded by the available evidence.

## T1 closure — targeted verification, 2026-10-27

**Disposition: closed. Technology review passes with no remaining corrective findings from this lens.**

Verified only the T1 additions, without repeating source research or runtime checks. Spine line 163 now requires the domain store's actual resolved SQLite runtime to contain the WAL-reset corruption fix, permits a documented fixed backport, and distinguishes that check from the upstream crate's assertion. Technology-evidence line 37 records the exact observed-main source and official SQLite explanation, the independent-driver limit, and the implementation gate. The additions do not choose a driver, change an adopted decision or claim a successful build. Implementation must still satisfy the gate.

| Rechecked input | SHA-256 at closure |
| --- | --- |
| `ARCHITECTURE-SPINE.md` | `53c139f127d87a440bfb3ef97ac9aade9d4fcfb7973b50f10daa8084c89f772b` |
| `.working/technology-evidence.md` | `44da314013f95a45911e4c7a4e8ef750b8e00d2d42f30cc48ed9a33cd4dd2c8b` |

The spine and memlog remained read-only to this reviewer. Only this closure note was appended to the review report.
