import re, sys, pathlib
ROOT = pathlib.Path(r"D:\Projects\inquello\_bmad-output")
PRD  = ROOT/"planning-artifacts/prds/prd-inquello-2026-10-26/prd.md"
EXP  = ROOT/"planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md"
ARCH = ROOT/"planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md"
SPEC = ROOT/"specs/spec-inquello/SPEC.md"
SG   = ROOT/"specs/spec-inquello/scope-and-gates.md"
GLOS = ROOT/"specs/spec-inquello/glossary.md"
D = "decided 2026-10-27"
warn = []

def sub(s, old, new, must=True, label=""):
    if old not in s:
        if must: raise SystemExit(f"MISSING in {label}: {old[:90]}")
        warn.append(f"{label}: {old[:70]}"); return s
    return s.replace(old, new, 1)

# ======================= PRD =======================
p = PRD.read_text(encoding="utf-8")
p = sub(p, "Guest participation by management, clients and evidence providers remains open (OQ-1).",
           f"Guest participation by management, clients and evidence providers is out of V1 scope (OQ-1, {D}: team-only participation).", label="PRD43")
p = sub(p, "- **Assignment:** an optional engagement or organised body of work with objectives, scope, period, participants and outputs. A **Task** is a conversation and its outcome, instructions, progress, delegated work and artifacts; a Task need not belong to an Assignment.",
           f"- **Workspace:** the broader working area for an audit team: its work, available resources, reusable procedures and settings (e.g. \"Acme Internal Audit\"). One Workspace holds several Engagements. **Engagement** ({D}; replaces the earlier term Assignment): a particular audit or advisory engagement with objectives, scope, period, team members and outputs (e.g. \"Procurement Audit — 2026\"). A **Task** is a conversation with Inquello directed towards an outcome, with its instructions, progress and resulting work (e.g. \"Analyse purchase orders for approval exceptions\"); a Task need not belong to an Engagement.", label="PRD63")
p = sub(p, "Practitioners can create and organise Assignments, folders, Tasks and concurrent workstreams, including ad hoc Tasks without an Assignment.",
           "Practitioners can create and organise Engagements, folders, Tasks and concurrent workstreams, including ad hoc Tasks without an Engagement.", label="PRD82")
p = sub(p, "approved reusable knowledge and Assignment/client evidence remain distinguishable; users can identify what may contribute to memory and what retained knowledge may be used; cross-Assignment reuse follows an explicitly selected policy rather than assumed authorisation.",
           f"approved reusable knowledge and Engagement/client evidence remain distinguishable; users can identify what may contribute to memory and what retained knowledge may be used; memory and recall are shared across a Workspace's Engagements and clients and isolated between Workspaces (OQ-3, {D}).", label="PRD266")
p = sub(p, "the cost-policy choice remains OQ-5 rather than an invented default budget.",
           f"cost policy inherits Codex usage handling with no Inquello-specific budget values for first validation (OQ-5, {D}).", label="PRD285")
p = sub(p, "Teams can assign Task and Human Review responsibility with Workspace/Assignment access and attribution.",
           "Teams can assign Task and Human Review responsibility with Workspace/Engagement access and attribution.", label="PRD320")
p = sub(p, "link the same practice workflows to native Assignments, procedures,", "link the same practice workflows to native Engagements, procedures,", label="PRD353")
p = sub(p, "Tasks/Assignments cannot silently change authority;", "Tasks/Engagements cannot silently change authority;", label="PRD369")
p = sub(p, "Applicable accessibility conformance targets remain OQ-8 (FR-2, FR-13, FR-43).",
           "Applicable accessibility conformance targets are set after first validation under OQ-8 (FR-2, FR-13, FR-43).", must=False, label="PRD393")
# §10 gates
p = sub(p, "**[ASSUMPTION AS-2]** Owners below are proposed role assignments for the internal team, not confirmed appointments. Assign named people when the affected work begins. These are downstream gates, not a request to reopen the accepted product breadth or V1/V2 boundary.",
           "**[ASSUMPTION AS-2]** Owners below are proposed role assignments for the internal team, not confirmed appointments. Assign named people when the affected work begins. These are downstream gates, not a request to reopen the accepted product breadth or V1/V2 boundary. Gates marked **Decided 2026-10-27** were settled by the product owner during spec review; the decision text replaces the earlier option list.", label="PRD464")
gates = {
 "1. **OQ-1 — Human and guest collaboration.**": "1. **OQ-1 — Human and guest collaboration. Decided 2026-10-27:** team-only participation. Workspace audit-team and reviewer access with external stakeholder exchange; no guest participation in V1. **Owner:** product lead with audit lead.",
 "2. **OQ-2 — Retained supporting evidence.**": "2. **OQ-2 — Retained supporting evidence. Decided 2026-10-27:** retain references plus the extracts and derivations the analysis relied on, as Codex thread history already does; no full source copies. Under OQ-3, retained extracts are visible across a Workspace's Engagements. **Owner:** audit method owner and organisation data-policy owner.",
 "3. **OQ-3 — Cross-Assignment recall.**": "3. **OQ-3 — Cross-Engagement recall. Decided 2026-10-27:** no isolation between Engagements or clients within a Workspace; isolation between Workspaces. Inquello extends an auditor who already holds knowledge of all their engagements, as existing audit tools do. Not configurable. **Owner:** product lead and data-policy owner.",
 "4. **OQ-4 — Method distribution and review authority.**": "4. **OQ-4 — Method distribution and review authority. Decided 2026-10-27:** inherit Codex mechanisms (Workspace, local and plugin-packaged skills; curated or team plugin marketplaces; MCP configuration; Agent Security managed policy). No managed catalogue or approval workflow for first validation; refine on usage evidence. **Owner:** method owner with audit lead.",
 "5. **OQ-5 — Task/team cost policy.**": "5. **OQ-5 — Task/team cost policy. Decided 2026-10-27:** inherit Codex usage handling (plan/workspace limits, model/reasoning/speed selection, usage inspection, enterprise analytics). No Inquello budget values for first validation; adjust on usage evidence. **Owner:** product lead with team administrator.",
 "6. **OQ-6 — Initial clients, formats and integrations.**": "6. **OQ-6 — Initial clients, formats and integrations. Decided 2026-10-27:** desktop first, mirroring Codex clients; Excel, Word, PowerPoint and CSV; no named external record system for first validation, import/export only. The full target remains unchanged. **Owner:** product lead with integration/architecture lead.",
 "8. **OQ-8 — Operating and accessibility commitments.**": "8. **OQ-8 — Operating and accessibility commitments. Decided 2026-10-27:** single-team scale for first validation with no service promises; workload, availability/support, latency, recovery/loss and accessibility targets are set after first validation. **Owner:** product lead with design/operations leads. **Revisit:** after first validation.",
 "9. **OQ-9 — Processing and provider eligibility.**": "9. **OQ-9 — Processing and provider eligibility. Decided 2026-10-27:** every documented route stays in scope and must be tested; none is excluded or presumed approved. Organisational policy eligibility is verified per route before real data uses that route. **Owner:** organisation policy/security owner with architecture lead.",
 "10. **OQ-10 — Release sequencing.**": "10. **OQ-10 — Release sequencing. Decided 2026-10-27:** sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there with unmet acceptance. No implicit MVP cut. **Owner:** product lead.",
}
for old_head, new_line in gates.items():
    m = re.search(re.escape(old_head) + r"[^\n]*", p)
    if not m: raise SystemExit(f"PRD gate missing: {old_head}")
    p = p[:m.start()] + new_line + p[m.end():]
p = sub(p, "There is no unresolved contradiction in the documented product direction that prevents UX exploration or architecture option analysis. OQ-2/OQ-6/OQ-9 gate affected data/integration designs; OQ-6/OQ-10 gate release-bound stories; OQ-7/OQ-8 gate validation and operating promises. These gates must travel into downstream work rather than being treated as answered because the PRD is complete.",
           "There is no unresolved contradiction in the documented product direction. OQ-1/2/3/4/5/6/8/9/10 were decided on 2026-10-27 and travel downstream as decisions. OQ-7 still gates practitioner validation and benefit claims; OQ-8 commitments are revisited after first validation; OQ-11 and OQ-12 remain open.", label="PRD479")
p = sub(p, "No product audience assumption remains. No default guest, retention, recall, budget, provider, deployment or release choice has been inferred as accepted.",
           "No product audience assumption remains. Guest, retention, recall, Method-distribution, budget, client/format/integration, operating-scale, provider-route and sequencing choices were decided by the product owner on 2026-10-27 (§10); none was inferred.", label="PRD486")
assert "Assignment" not in p.replace("replaces the earlier term Assignment", ""), "Assignment remains in PRD"
PRD.write_text(p, encoding="utf-8")

# ======================= EXPERIENCE =======================
e = EXP.read_text(encoding="utf-8")
e = sub(e, "Keep the source hierarchy: Workspace → optional Assignment → Task.",
           f"Keep the source hierarchy: Workspace → optional Engagement → Task (Engagement replaces Assignment, {D}).", label="EXP27")
e = sub(e, "find accessible Tasks, files and Assignments;", "find accessible Tasks, files and Engagements;", label="EXP35")
e = sub(e, "Workspace/Assignment context and actions", "Workspace/Engagement context and actions", label="EXP92")
e = sub(e, "without creating an Assignment unnecessarily.", "without creating an Engagement unnecessarily.", label="EXP191")
e = sub(e, "S05 organises the optional Assignment and Tasks", "S05 organises the optional Engagement and Tasks", label="EXP201")
e = sub(e, "She reuses the selected Method on another Assignment; S08 identifies permitted memory contribution/use and keeps client evidence separately scoped.",
           "She reuses the selected Method on another Engagement; S08 identifies permitted memory contribution/use; recall is shared within the Workspace and never crosses Workspaces (OQ-3).", label="EXP253")
e = sub(e, "Carry forward the PRD decisions with their owners and gates: **OQ-1** guest/human participation; **OQ-2** retained evidence approach; **OQ-3** cross-Assignment recall; **OQ-4** method distribution/review authority; **OQ-5** task/team cost policy; **OQ-6** clients/formats/integrations; **OQ-7** participants/examples/baselines; **OQ-8** operating/accessibility commitments; **OQ-9** actual processing/service eligibility; **OQ-10** release sequencing; **OQ-11** native-record policy; **OQ-12** final name/design validation.",
           "Carry forward the PRD gates (§10 of the PRD holds the decision text). Decided 2026-10-27: **OQ-1** team-only participation; **OQ-2** retained extracts; **OQ-3** recall shared within a Workspace, isolated between Workspaces; **OQ-4** Codex Method/extension mechanisms; **OQ-5** Codex usage handling; **OQ-6** desktop first mirroring Codex clients, Excel/Word/PowerPoint/CSV, import/export only for first validation; **OQ-8** single-team scale, commitments after first validation; **OQ-9** all documented routes in scope and tested; **OQ-10** sequencing at story breakdown. Still open: **OQ-7** participants/examples/baselines; **OQ-11** native-record policy; **OQ-12** final name/design validation.", label="EXP286")
e = sub(e, "resolve relevant OQ-1/OQ-3/OQ-4/OQ-6 choices where an implementation depends on them.",
           "apply the decided OQ-1/OQ-3/OQ-4/OQ-6 choices (2026-10-27) where an implementation depends on them.", label="EXP294")
assert "Assignment" not in e.replace("Engagement replaces Assignment", ""), "Assignment remains in EXPERIENCE"
EXP.write_text(e, encoding="utf-8")

# ======================= ARCHITECTURE =======================
a = ARCH.read_text(encoding="utf-8")
a = sub(a, "Keep stable Workspace, optional Assignment, Task, Source and Artifact identity", "Keep stable Workspace, optional Engagement, Task, Source and Artifact identity", label="ARCH91")
a = sub(a, "OQ-5/6/8/9 gate enablement and promises.", "OQ-5/6/8/9 are decided (2026-10-27); the missing production route still gates enablement and promises.", label="ARCH184")
a = sub(a, "OQ-1/6/9 gate permissions and integration commitments.", "OQ-1/6/9 are decided (2026-10-27); the missing route still gates permissions and integration commitments.", label="ARCH185")
a = sub(a, "Open choices retain proposed role owners, not named appointments. They permit option analysis while preventing affected commitments. No new product policy is inferred from this contract.",
           "Open choices retain proposed role owners, not named appointments. Rows marked Decided 2026-10-27 record the product owner's decision from spec review; the remaining rows still prevent affected commitments. No new product policy is inferred from this contract.", label="ARCH220")
a = sub(a, "| Gate | Owner; revisit trigger | What remains open |", "| Gate | Owner; revisit trigger | Decision, or what remains open |", label="ARCH222")
rows = {
 "| OQ-1 |": "| OQ-1 | Product lead with audit lead; decided 2026-10-27 | Team-only participation: Workspace audit-team and reviewer access with external exchange; no guest participation in V1. |",
 "| OQ-2 |": "| OQ-2 | Method owner and organisation data-policy owner; decided 2026-10-27 | Retain references plus relied-on extracts/derivations, as Codex thread history does; no full source copies. Storage adoption does not choose retained content. |",
 "| OQ-3 |": "| OQ-3 | Product/data-policy owners; decided 2026-10-27 | Recall shared across a Workspace's Engagements and clients; isolated between Workspaces. Not configurable. |",
 "| OQ-4 |": "| OQ-4 | Method owner with audit lead; decided 2026-10-27 | Inherit Codex mechanisms (Workspace/local/plugin skills, marketplaces, MCP configuration, Agent Security managed policy); no managed catalogue or approval workflow for first validation. |",
 "| OQ-5 |": "| OQ-5 | Product lead/team administrator; decided 2026-10-27 | Inherit Codex usage handling; no Inquello budget values for first validation. |",
 "| OQ-6 |": "| OQ-6 | Product/integration/architecture leads; decided 2026-10-27 | Desktop first mirroring Codex clients; Excel, Word, PowerPoint, CSV; no named record system for first validation, import/export only. Full target unchanged. |",
 "| OQ-8 |": "| OQ-8 | Product/design/operations leads; decided 2026-10-27, revisit after first validation | Single-team scale, no service promises; workload, accessibility, latency, availability, recovery and loss tolerances set after first validation. |",
 "| OQ-9 |": "| OQ-9 | Organisation policy/security owner with architecture lead; decided 2026-10-27 | All documented routes stay in scope and must be tested; none presumed approved. Eligibility verified per route before real data uses it. |",
 "| OQ-10 |": "| OQ-10 | Product lead; decided 2026-10-27 | Sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there; full target unchanged. |",
}
for head, new_row in rows.items():
    m = re.search(r"(?m)^" + re.escape(head) + r"[^\n]*$", a)
    if not m: raise SystemExit(f"ARCH row missing: {head}")
    a = a[:m.start()] + new_row + a[m.end():]
assert "Assignment" not in a, "Assignment remains in ARCH"
ARCH.write_text(a, encoding="utf-8")

# ======================= SPEC re-derive =======================
s = SPEC.read_text(encoding="utf-8")
s = sub(s, "No first increment is selected; deferrals remain unmet scope and cannot establish full parity.",
           "The first increment and deferrals are chosen at story breakdown (OQ-10); deferrals remain unmet scope and cannot establish full parity.", label="SPEC-c1")
s = sub(s, "Preserve gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex scope without silent fallback or presumed service/policy eligibility.",
           "Preserve gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex scope without silent fallback or presumed service/policy eligibility; every documented route is tested, with eligibility verified per route before real data (OQ-9).", label="SPEC-routes")
s = sub(s, "- Collaboration is Workspace audit-team and reviewer access with external exchange; no guest participation in V1.\n",
           "- Collaboration is Workspace audit-team and reviewer access with external exchange; no guest participation in V1.\n"
           "- Retain references plus the extracts and derivations an analysis relied on, as Codex thread history does; never full source copies. Retained extracts are visible across a Workspace's Engagements.\n"
           "- First validation ships the desktop client first, mirroring Codex clients, with Excel, Word, PowerPoint and CSV; no named external record system, import/export only. Operate at single-team scale with no service promises; availability, latency, recovery and accessibility targets follow first validation. The full target is unchanged.\n", label="SPEC-newc")
s = sub(s, "OQ-1/3/4/5 were decided 2026-10-27; see [decided gates](scope-and-gates.md#decided-gates).",
           "OQ-1/2/3/4/5/6/8/9/10 were decided 2026-10-27; see [decided gates](scope-and-gates.md#decided-gates).", label="SPEC-oqintro")
for q in ["- **OQ-2:** Which supporting evidence may be retained?\n",
          "- **OQ-6:** Which clients, format features/versions and integration contracts ship first?\n",
          "- **OQ-8:** What workload, service, recovery and accessibility commitments apply?\n",
          "- **OQ-9:** Which processing/service/authentication routes satisfy actual policy?\n",
          "- **OQ-10:** What is the first increment and which acceptance remains unmet?\n"]:
    s = sub(s, q, "", label="SPEC-oq")
SPEC.write_text(s, encoding="utf-8")

g = SG.read_text(encoding="utf-8")
g = sub(g, "Engagement replaces Assignment; adopted companions that still say Assignment are read as Engagement.",
           "Engagement replaces Assignment; the final PRD, EXPERIENCE and Architecture Spine were updated on 2026-10-27; older scope artifacts that still say Assignment are read as Engagement.", label="SG-vocab")
g = sub(g, "| OQ-5 | Cost policy inherits Codex usage handling: plan/workspace limits, model/reasoning/speed selection, usage inspection, enterprise analytics. No Inquello budget values for first validation; FR-30 configured limits are the inherited limits. |\n",
           "| OQ-5 | Cost policy inherits Codex usage handling: plan/workspace limits, model/reasoning/speed selection, usage inspection, enterprise analytics. No Inquello budget values for first validation; FR-30 configured limits are the inherited limits. |\n"
           "| OQ-2 | Retain references plus relied-on extracts and derivations, as Codex thread history does; no full source copies. Retained extracts are visible across a Workspace's Engagements. |\n"
           "| OQ-6 | Desktop first, mirroring Codex clients; Excel, Word, PowerPoint and CSV; no named external record system for first validation, import/export only. Full target unchanged. |\n"
           "| OQ-8 | Single-team scale for first validation, no service promises; workload, availability, latency, recovery/loss and accessibility targets set after first validation. |\n"
           "| OQ-9 | Every documented processing route stays in scope and must be tested; none excluded or presumed approved. Eligibility verified per route before real data uses it. |\n"
           "| OQ-10 | Sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there with unmet acceptance. |\n", label="SG-decided")
head, tail = g.split("## Open product gates", 1)
for gate in ["OQ-2", "OQ-6", "OQ-8", "OQ-9", "OQ-10"]:
    tail, n = re.subn(r"\n\| " + re.escape(gate) + r" \|[^\n]*", "", tail, count=1)
    if n != 1: raise SystemExit(f"SG open row missing: {gate}")
g = head + "## Open product gates" + tail
g = sub(g, "OQ-2/6/9 gate affected data/integration designs; OQ-6/10 gate release-bound stories; OQ-7/8 gate validation and operating promises. OQ-11 native-record policy does not block V1. Given OQ-3, OQ-2 retained extracts become visible across a Workspace's Engagements.",
           "OQ-7 gates practitioner validation and benefit claims; OQ-11 native-record policy does not block V1; OQ-12 gates public brand commitments. Decided gates bind through the SPEC constraints.", label="SG-para")
g = sub(g, "thresholds await OQ-7/8.", "thresholds await OQ-7; operating commitments follow first validation (OQ-8).", label="SG-thresh")
g = sub(g, "resolve the remaining OQ-6 dependency without narrowing full scope.", "OQ-1/3/4/6 are decided; apply them without narrowing full scope.", must=False, label="SG-asux1")
g = sub(g, "OQ-6/8 choose support/conformance targets.", "OQ-6 is decided; conformance targets follow OQ-8 after first validation.", label="SG-asux2")
g = sub(g, "Before enablement/promises; OQ-6/8/9 (OQ-5 decided).", "Before enablement/promises; OQ-5/6/8/9 decided, production supply still unproven.", label="SG-impl1")
g = sub(g, "Before permissions/integration commitments; OQ-6/9 (OQ-1 decided).", "Before permissions/integration commitments; OQ-1/6/9 decided, route still unproven.", label="SG-impl2")
g = sub(g, "Before route use; OQ-6/9.", "Before route use; OQ-6/9 decided, every route still needs test and eligibility verification.", label="SG-impl3")
g = sub(g, "Before real-data/production promises; OQ-2/8/9.", "Before real-data/production promises; OQ-2/8/9 decided, operating targets follow first validation.", label="SG-impl4")
SG.write_text(g, encoding="utf-8")

gl = GLOS.read_text(encoding="utf-8")
gl = sub(gl, "Adopted companions that still say Assignment are read as Engagement until updated upstream.",
             "The final PRD, EXPERIENCE and Architecture Spine were updated to this vocabulary on 2026-10-27; older scope artifacts that still say Assignment are read as Engagement.", label="GLOS")
GLOS.write_text(gl, encoding="utf-8")

print("OK; warnings:", warn or "none")
