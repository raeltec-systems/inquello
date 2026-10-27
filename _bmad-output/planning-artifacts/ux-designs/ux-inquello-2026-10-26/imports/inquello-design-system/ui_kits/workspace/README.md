# Workspace UI kit

A condensed, click-through recreation of the Inquello workspace from the Inquello design prototype, built from the design-system components.

Screens (switch from the sidebar):
- **New thread** — symbol, composer with files in context, procedure /CR-03 applied, workspace files to add. Send opens Active work.
- **Reconcile bank to ledger** (active work) — thread with plan steps, four parallel specialists, an approval request for R4, and the side panel (Changes · Preview · Summary) with the emerging workbook.
- **Inbox** (review) — expanded sheet with rows 18–19 highlighted, Tom Okafor's question, Inquello's reasoning tagged by judgment type, revising R1's treatment, the four affected outputs, Keep → toast and the decision marker.
- **Automations** — recurring and event-triggered work; the Kijani Microfinance rate-change run with a missing second approval.

Files: `Shell.jsx` (Sidebar, Header, Composer), `StartScreen.jsx`, `ActiveScreen.jsx` (+ Workbook), `ReviewScreen.jsx`, `AutomationsScreen.jsx`, `data.js` (scenario figures). Collapse the sidebar with the panel icon; the symbol re-opens it.
