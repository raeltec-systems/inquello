# Current upstream documentation check

Checked 26 October 2026. These are read-only observations for coaching, not selected architecture decisions or runtime tests. The current-main observation is recorded in [upstream-current.json](upstream-current.json); it does not select the fork base.

## Client interface and transport

OpenAI describes app-server as the open-source interface for embedding Codex in rich clients, including authentication, history, execution approvals and streamed events. It recommends the SDK for scripted jobs and CI. The documented default transport is JSONL over stdio; TCP WebSocket is experimental and unsupported. The page also describes Unix sockets, disabling local transport, and authentication requirements for remote listeners. This does not make a public network listener a selected or production-ready Inquello route. Version-generated TypeScript/JSON schemas belong to the corresponding Codex build. Source: [Codex App Server](https://learn.chatgpt.com/docs/app-server), sections Protocol and Message schema, accessed 2026-10-26.

Clarified 2026-10-27: the remote Code Mode host section also calls the app-server command and WebSocket transport experimental and unsupported for production. Preserve that section's context alongside the default-stdio protocol description; neither source availability nor stdio establishes blanket production support. Inherited protocol, runtime capability and product deployment eligibility are separate facts. See [remote Code Mode host](https://learn.chatgpt.com/docs/app-server#connect-a-remote-code-mode-host).

## Source availability

The current inventory lists CLI, SDK and app-server sources. It identifies the IDE extension and Codex cloud as not open source. Source: [Open Source](https://learn.chatgpt.com/docs/open-source), accessed 2026-10-26.

The inventory's current SDK link uses `codex-sdk`, while prior pinned research used `sdk/typescript`. Resolve actual paths at the chosen source revision before adopting a build/dependency contract. Neither this inventory nor repository interface declarations establish that every desktop, hosted connector or scheduling backend is available for reuse.
