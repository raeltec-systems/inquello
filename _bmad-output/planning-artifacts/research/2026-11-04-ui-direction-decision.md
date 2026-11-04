# UI direction decision (owner, 2026-11-04)

Inputs: `2026-11-04-copilotkit-evaluation.md`, `2026-11-04-ag-ui-evaluation.md`.

- **CopilotKit:** not adopted. Its supported path needs its own HTTP runtime between UI and agent; Inquello's sandboxed renderer reaches main only through named operations, and its tool/approval model cannot express Inquello's status and authority distinctions without replacing nearly every view.
- **AG-UI:** not adopted for the renderer-main or main-engine boundaries. Kept as a candidate egress format for secondary clients (S12), to re-evaluate when CLI/SDK continuation is designed, using the read-only, debug-only projection test and go/no-go criteria in its evaluation.
- **Next UI work (approved, queued after the current engineering round):** close the three gaps that separate Inquello from Codex/ChatGPT:
  1. sanitized markdown rendering of agent messages;
  2. live message text for the open conversation, with stick-to-bottom scrolling;
  3. Codex-style collapsed per-turn activity, headed by the neutral end-of-turn line.

  Also quiet the results section into the transcript. Existing row and paging UI may be replaced.
- **Approved dependencies for `desktop/`:** `react-markdown`, `remark-gfm`, `rehype-sanitize`, and `use-stick-to-bottom` if needed. Each must be checked against the Story 1.12 data-policy rules before landing.
