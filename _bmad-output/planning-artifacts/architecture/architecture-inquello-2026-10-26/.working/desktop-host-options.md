# Desktop host options — bounded coaching evidence

Checked 2026-10-26. This comparison preserves the adopted Codex runtime/app-server boundary. It selects no host, service topology or implementation version. No installation, imported-code execution or installed-app inspection was performed.

## What can be inherited

The public [Codex README at the observed current commit](https://github.com/openai/codex/blob/efab30992b28bb8fc5064dbac9c12090b8818e98/README.md) distinguishes the CLI repository from the desktop application. Neither this source nor the reviewed [official desktop introduction](https://openai.com/index/introducing-the-codex-app/) establishes its UI framework. This bounded check therefore cannot substantiate “Codex desktop uses Electron” or identify reusable desktop UI source. Community diagnostics and job advertisements were excluded as proof. The verified runtime inheritance remains in [upstream-architecture.md](upstream-architecture.md).

Both options can host a React/TypeScript UI and communicate with the inherited Rust app-server over stdio. These are supported integration possibilities inferred from the documented APIs, not implementations tested here.

## Current stable releases

Official repository release metadata reports [Electron 45.0.0](https://github.com/electron/electron/releases/tag/v45.0.0), published October 21, with Chromium 156.0.8078.48, Node 24.22.0 and V8 15.6. Tauri publishes separate packages: [core 2.12.5](https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.12.5) and [CLI 2.12.4](https://github.com/tauri-apps/tauri/releases/tag/tauri-cli-v2.12.4), also October 21. Alpha releases were excluded. These observations are not version selections.

## Integration comparison

| Concern | Electron | Tauri |
| --- | --- | --- |
| UI and packaging | Web UI in a Chromium renderer; privileged main process has Node APIs. Bundle the Rust executable alongside application resources. [Process model](https://www.electronjs.org/docs/latest/tutorial/process-model) | Static React/TypeScript assets are supported; Vite is an official frontend option. A Rust host bundles the native sidecar through `externalBin`, with a binary for each target triple. [Frontend](https://v2.tauri.app/start/frontend/), [sidecars](https://v2.tauri.app/develop/sidecar/) |
| Rust stdio integration | A narrow preload/IPC bridge can request a main-owned `child_process.spawn` with piped stdin/stdout. `utilityProcess.fork` starts a Node script, not the Rust executable directly. [Node API](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options), [utility process](https://www.electronjs.org/docs/latest/api/utility-process) | Rust can spawn the sidecar, receive stdout events and write child stdin. The frontend need not receive unrestricted shell access. [Sidecar API](https://v2.tauri.app/develop/sidecar/) |
| Browser consistency | Bundled Chromium provides a controlled renderer version per application release; updates remain a shipping responsibility. [Security](https://www.electronjs.org/docs/latest/tutorial/security) | Windows uses WebView2; macOS uses WKWebView; Linux uses WebKitGTK. Engine/version differences enlarge the rendering test matrix. [WebViews](https://v2.tauri.app/reference/webview-versions/) |
| Privilege boundary | Apply context isolation, renderer sandboxing and validated IPC; keep document content away from privileged APIs. [Security](https://www.electronjs.org/docs/latest/tutorial/security) | Capabilities constrain frontend access to native commands per window/webview; they do not establish a blanket sandbox for arbitrary native code. [Capabilities](https://v2.tauri.app/security/capabilities/) |

## Validation and coaching implication

Neither host replaces Codex execution policy or Inquello authority checks. Review bridge commands, sidecar arguments, credentials and lifecycle recovery separately from renderer isolation.

Accessibility remains an application obligation: test keyboard/focus, screen readers, zoom, contrast and dense artifact interactions on every supported OS. Electron exposes Chromium accessibility support, but this is not a conformance claim. Tauri's system-engine matrix also needs explicit coverage. [Electron accessibility](https://www.electronjs.org/docs/latest/tutorial/accessibility)

The remaining choice is controlled Chromium/Node packaging versus a Rust host with system WebViews. Neither choice requires a new shared service or supplies execution while the user's computer is off. There is no host recommendation in this note.
