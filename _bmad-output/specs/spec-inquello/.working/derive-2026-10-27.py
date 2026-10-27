import re, sys, pathlib
W = pathlib.Path(sys.argv[1])
spec = (W/"SPEC.md").read_text(encoding="utf-8")
sg   = (W/"scope-and-gates.md").read_text(encoding="utf-8")

def sub(s, old, new, count=1):
    assert old in s, f"missing: {old[:70]}"
    return s.replace(old, new, count)

# ---------- SPEC.md ----------
spec = sub(spec, "companions:\n  - scope-and-gates.md\n", "companions:\n  - scope-and-gates.md\n  - glossary.md\n")
spec = sub(spec, "it does not narrow the eventual audience or mandate an engagement for ad hoc work.",
                 "it does not narrow the eventual audience or mandate an Engagement for ad hoc Tasks. Vocabulary: [glossary](glossary.md).")
spec = sub(spec, "Organise, find and resume Assignments, folders, Tasks and concurrent work, including ad hoc Tasks.",
                 "Organise, find and resume Engagements, folders, Tasks and concurrent work, including ad hoc Tasks outside any Engagement.")
spec = sub(spec, "supplied client/period/Workspace and attention states remain visible without mandatory engagement fields.",
                 "supplied client/period/Workspace and attention states remain visible without mandatory Engagement fields.")
spec = sub(spec, "Link practice workflows to native Assignments, procedures,", "Link practice workflows to native Engagements, procedures,")
spec = sub(spec, "Tasks/Assignments never silently switch authority;", "Tasks/Engagements never silently switch authority;")
spec = sub(spec, "preferences, reusable knowledge and client evidence remain distinct under selected capture/use/revocation policy.",
                 "preferences, reusable knowledge and client evidence remain distinct under selected capture/use/revocation policy; recall never crosses Workspaces.")
spec = sub(spec, "- Maintain separate Method authority, task-specific departures, memory contribution/use and activity recall. No silent client-evidence sharing, case-to-team promotion or cross-Assignment reuse; actual policy determines distribution, retention and review rights.",
                 "- Maintain separate Method authority, task-specific departures, memory contribution/use and activity recall. Memory and recall are shared across a Workspace's Engagements and clients and isolated between Workspaces; no silent case-to-team Method promotion. Actual policy determines distribution, retention and review rights.")
new_constraints = """- Collaboration is Workspace audit-team and reviewer access with external exchange; no guest participation in V1.
- Method distribution, extension management and usage control inherit Codex mechanisms (Workspace/local/plugin skills, plugin marketplaces, MCP configuration, Agent Security managed policy; plan/workspace usage limits, model/reasoning/speed selection, usage inspection, enterprise analytics). No Inquello-specific catalogue, approval workflow or budget values for first validation; add only on usage evidence.

## Non-goals
"""
spec = sub(spec, "\n## Non-goals\n", "\n" + new_constraints)
spec = sub(spec, "- A universal audit methodology, mandatory engagement/control/deficiency model, sampling rule, review hierarchy or workflow state machine.",
                 "- A universal audit methodology, mandatory Engagement membership for Tasks, mandatory control/deficiency model, sampling rule, review hierarchy or workflow state machine.")
spec = sub(spec, "ordinary engagement planning/follow-up remain V1.", "ordinary Engagement planning/follow-up remain V1.")
spec = sub(spec, "Existing decision gates, not blockers to adopting this contract; owners and exact triggers are in [scope and gates](scope-and-gates.md#open-product-gates).",
                 "Existing decision gates, not blockers to adopting this contract; owners and exact triggers are in [scope and gates](scope-and-gates.md#open-product-gates). OQ-1/3/4/5 were decided 2026-10-27; see [decided gates](scope-and-gates.md#decided-gates).")
for q in ["- **OQ-1:** Which private/team/guest participation model applies?\n",
          "- **OQ-3:** What cross-Assignment/client recall is authorised?\n",
          "- **OQ-4:** How are Methods distributed and human review rights assigned?\n",
          "- **OQ-5:** Which task/team budgets, values and stop rules apply?\n"]:
    spec = sub(spec, q, "")
assert "Assignment" not in spec, "Assignment remains in SPEC"
(W/"SPEC.md").write_text(spec, encoding="utf-8")

# ---------- scope-and-gates.md ----------
sg = sub(sg, "Final UX and selected visual kit supersede earlier pending-UX wording.",
             "Vocabulary decided 2026-10-27 ([glossary](glossary.md)): Engagement replaces Assignment; adopted companions that still say Assignment are read as Engagement. Final UX and selected visual kit supersede earlier pending-UX wording.")
sg = sub(sg, "## Open product gates\n\nOwners are inherited proposed roles, not appointments (AS-2). Existing recommendations remain recommendations. A gate blocks its dependent commitment; independent contract/fixture work can continue. Final UX/architecture adoption answers only their explicit choices.\n",
"""## Decided gates

Decided by the product owner on 2026-10-27; recorded in the spec memlog. Adopted PRD text that still lists these as open is superseded here.

| Gate | Decision |
|---|---|
| OQ-1 | Team-only participation: Workspace audit-team and reviewer access with external exchange; no guest participation in V1. |
| OQ-3 | No memory isolation between Engagements or clients within a Workspace; isolation between Workspaces. Inquello extends an auditor who already holds knowledge of all their engagements. Not configurable. |
| OQ-4 | Method distribution inherits Codex mechanisms: Workspace, local and plugin-packaged skills, curated or team marketplaces, MCP configuration, Agent Security managed policy. No managed catalogue or approval workflow for first validation. |
| OQ-5 | Cost policy inherits Codex usage handling: plan/workspace limits, model/reasoning/speed selection, usage inspection, enterprise analytics. No Inquello budget values for first validation; FR-30 configured limits are the inherited limits. |

## Open product gates

Owners are inherited proposed roles, not appointments (AS-2). Existing recommendations remain recommendations. A gate blocks its dependent commitment; independent contract/fixture work can continue. Final UX/architecture adoption answers only their explicit choices.
""")
head, tail = sg.split("## Open product gates", 1)
for gate in ["OQ-1", "OQ-3", "OQ-4", "OQ-5"]:
    tail, n = re.subn(r"\n\| " + re.escape(gate) + r" \|[^\n]*", "", tail, count=1)
    assert n == 1, f"row not removed: {gate}"
sg = head + "## Open product gates" + tail
sg = sub(sg, "OQ-2/6/9 gate affected data/integration designs; OQ-6/10 gate release-bound stories; OQ-7/8 gate validation and operating promises. OQ-11 native-record policy does not block V1.",
             "OQ-2/6/9 gate affected data/integration designs; OQ-6/10 gate release-bound stories; OQ-7/8 gate validation and operating promises. OQ-11 native-record policy does not block V1. Given OQ-3, OQ-2 retained extracts become visible across a Workspace's Engagements.")
sg = sub(sg, "resolve relevant OQ-1/3/4/6 dependencies", "resolve the remaining OQ-6 dependency")
sg = sub(sg, "Before permissions/integration commitments; OQ-1/6/9.", "Before permissions/integration commitments; OQ-6/9 (OQ-1 decided).")
sg = sub(sg, "Before enablement/promises; OQ-5/6/8/9.", "Before enablement/promises; OQ-6/8/9 (OQ-5 decided).")
leftover = sg.replace("Engagement replaces Assignment", "").replace("still say Assignment", "")
assert "Assignment" not in leftover, "Assignment remains in scope-and-gates"
(W/"scope-and-gates.md").write_text(sg, encoding="utf-8")

# ---------- glossary.md ----------
(W/"glossary.md").write_text("""# Inquello glossary

Decided 2026-10-27. Overrides the PRD §3 **Assignment** entry; every other PRD §3 term stands. Adopted companions that still say Assignment are read as Engagement until updated upstream.

| Term | Meaning | Example |
|---|---|---|
| **Workspace** | The broader working area for an audit team: its work, available resources, reusable procedures and settings. | "Acme Internal Audit" |
| **Engagement** | A particular audit or advisory engagement with objectives, scope, period, team members and outputs. | "Procurement Audit — 2026" |
| **Task** | A conversation with Inquello directed towards an outcome, with its instructions, progress and resulting work. | "Analyse purchase orders for approval exceptions." |

One Workspace contains several Engagements (Procurement, Payroll, IT Access), each supported by multiple Tasks. A Task may be ad hoc, outside any Engagement (explain a policy, analyse a spreadsheet). The Engagement supplies shared audit context: objectives, scope, relevant evidence and related work. The Workspace supplies team context. Memory and recall are shared across a Workspace's Engagements and isolated between Workspaces (OQ-3). In V1 this organisation sits alongside the team's external authoritative audit-record system.
""", encoding="utf-8")
print("derived OK")
