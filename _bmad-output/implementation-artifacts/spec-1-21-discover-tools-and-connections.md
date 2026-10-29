---
title: 'Story 1.21: Discover current tools and connection states honestly'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-13-keep-provider-credentials-separate.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-18-inspect-effective-managed-policy.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-19-bound-tool-reads-writes-network.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-20-authorize-specific-actions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** S07 shows policy and sandbox reach, but not which tools, apps, MCP servers and plugins exist. It does not show whether each is installed, enabled and callable now, or why not. Users cannot manage them, so missing access looks like missing functionality (FR-21, C33–C36, OQ-4, UX-DR40).

**Approach:**
- Build an honest capability inventory in S07 from the runtime's own state: `plugin/list|installed|read`, `app/list|read`, `mcpServerStatus/list`, `skills/list`, built-in tools and `account/read`.
- Each entry is combined with the Story 1.18 effective policy, so it shows:
  - its source and version;
  - its dependencies;
  - its effective permission;
  - whether it is installed, enabled and callable, with the reason when it is not;
  - the next action.
- Add full management through the runtime's existing methods: install and uninstall plugins, enable and disable, add and remove MCP servers, and start or cancel connection sign-ins. Every change is gated by Workspace policy.
- Show the provider session separately from the Inquello identity.

**Owner decisions (2026-10-29):**
- **Scope:** full management. Install plugins, add MCP servers and start connection sign-ins from S07, as well as discovery and enable/disable.
- **Marketplace sync:** leave the runtime's automatic curated-marketplace sync on. S07 lists marketplace plugins as available and shows their policy state.

## Boundaries & Constraints

**Always:**
- **Inventory entry:** `{kind: built_in | app | mcp_server | plugin | skill, id, display_name, source (marketplace name, URL or local), version, dependencies (required apps or MCP servers, connections), installed, enabled, callable_now, reason_not_callable?, effective_permission, next_action?}`.
  - "Callable now" is true only when all of these hold:
    - it is installed;
    - it is enabled;
    - the Workspace policy allows that kind (`tools` for MCP and apps, `extensions` for plugins and skills);
    - its required connections are authenticated;
    - for remote endpoints, the host is on `allowed_domains`.
  - Reasons are specific, for example "Blocked by Workspace policy (extensions not allowed)", "Needs connection: GitHub (not signed in)", "Connection expired — sign in again", or "Host api.example.com is not on this Workspace's allowed list".
- **No credentials on install:** installing a plugin grants no connector credentials. Its dependent apps and MCP servers show "Not connected" until the user connects each one.
- **Expired or revoked connections:** shown as such, with one applicable next action ("Sign in again" or "Remove"). The runtime never silently falls back to another connection or route.
- **Management:** every action goes through main's validated preload operations to the runtime's own methods, and is refused when the effective policy disallows it, with the rule named. The actions are:
  - plugin install and uninstall (`plugin/install|uninstall`);
  - enable and disable (config writes through the runtime's writer);
  - MCP server add and remove (`config/batchWrite` plus `config/mcpServer/reload`);
  - MCP OAuth sign-in (`mcpServer/oauth/login`) and app connection sign-in.

  Each change shows its result from the runtime's actual state after a re-read, never an optimistic success.
- **Local MCP servers (stdio):**
  - They run a program on this device outside the Task sandbox.
  - They can be added only when a new Workspace policy field `execution.allow_local_mcp_servers` is true (default false).
  - Before adding one, the user confirms text that states it runs outside the Task sandbox.
  - Remote MCP servers are subject to `allowed_domains`.
- **Credentials:**
  - MCP and app connection credentials stay in the runtime's own credential store (keyring), never in Inquello's stores, logs or renderer.
  - The Story 1.13 provider-environment stripping still applies.
- **Provider session (AC 1.21.4):**
  - S07 shows the provider sign-in (from `account/read`) in a separate block from the Inquello identity: provider, account type, effective route and its capability limits.
  - A provider sign-in or sign-out changes no Workspace, Engagement, membership, review or policy state; this is verified by a test.
- **Refresh:** S07 updates from the runtime's change notifications (`app/list/updated`, `skills/changed`, `mcpServer/startupStatus/updated`, `mcpServerStatus`), with an explicit Refresh button as well. A stale list is labelled with its time.
- **Accessibility:**
  - The inventory is a table or list with headings by kind.
  - States are shown as text, not colour alone.
  - Actions are buttons that name their target ("Install Linear plugin").

**Never:**
- No credentials outside the runtime's credential store.
- No silent fallback between connections or routes.
- No running stdio MCP servers unless the policy allows them.
- No model runs (Story 1.25).
- No new dependencies.
- No change to the runtime's marketplace sync.
- No Inquello identity or permission changes from provider sign-in.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default policy | Marketplace synced, extensions not allowed | Plugins listed "Available — blocked by Workspace policy (extensions not allowed)"; install refused with rule named | N/A |
| Built-ins | Any | Built-in tools listed with their Story 1.19 reach; callable state follows the sandbox probe | N/A |
| Install allowed | Policy allows extensions; user installs plugin | Installed (re-read); dependencies "Not connected"; no credentials granted | Runtime error shown verbatim-safe |
| Needs connection | Plugin tool depends on an unauthenticated app | "Needs connection: <app> (not signed in)"; next action "Connect" | N/A |
| Expired | Connection expired or revoked | "Connection expired — sign in again"; no fallback | N/A |
| Remote MCP blocked | Host not on `allowed_domains` | Add refused, or listed not callable, with host named | N/A |
| Local MCP | Policy disallows local servers | Add refused with rule named | N/A |
| Local MCP allowed | Policy allows; user confirms outside-sandbox text | Added; listed "Runs on this device outside the Task sandbox" | Without confirmation: refused |
| Disable | User disables an enabled MCP server | Not callable after re-read; reason "Disabled by you" | N/A |
| Provider sign-in | Codex or ChatGPT sign-in completes | Separate provider block; Workspace and membership state unchanged | N/A |
| Sign-in cancelled | User cancels an OAuth login | Not connected; nothing stored | N/A |
| Runtime unavailable | Runtime stopped | Inventory "Unavailable — runtime not running"; no stale data as current | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/execution_policy/section.rs` -- the `allow_local_mcp_servers` field and its validation, plus the service wire.
- `desktop/src/main/` -- a new `capabilities/` mediator: inventory assembly, management operations, notification handling and policy gating.
- `desktop/src/main/security/operations.ts` and `preload` -- the operations.
- `desktop/src/renderer/Capabilities.tsx` (S07) -- inventory UI, management controls, provider block.
- `desktop/src/main/smoke-probe.ts` -- a `capabilities` report.

## Tasks & Acceptance

**Execution:**
- [ ] Policy field (domain, service wire, fixtures), with tests.
- [ ] Main capabilities mediator: inventory, callable rules, management through runtime methods with policy gating, and a re-read after each change.
- [ ] S07 inventory and management UI, the provider block, and jsdom tests for every matrix row.
- [ ] Integration tests against the real runtime:
  - the inventory lists;
  - a policy refusal;
  - an MCP server add and remove, using a local fixture HTTP server or a policy-permitted stdio fixture inside the test;
  - an enable and disable round trip;
  - a provider sign-in leaves Workspace state unchanged.
- [ ] Smoke `capabilities` report, with the default seed:
  - the inventory renders by kind;
  - built-in tools are listed;
  - marketplace plugins (if synced) show as blocked by policy, with the rule named;
  - plugin install is refused with the rule named;
  - the provider block is separate from the Inquello identity.
- [ ] `sprint-status.yaml` (1-21).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `capabilities` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): `inquello-domain` and `inquello-service` tests (with the database URL), clippy; the two builds run separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol` (if the engine changed), `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
