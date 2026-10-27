import re, pathlib
ROOT = pathlib.Path(r"D:\Projects\inquello\_bmad-output")
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

# ======================= ARCHITECTURE =======================
a = ARCH.read_text(encoding="utf-8")
a = sub(a, "Keep stable Workspace, optional Assignment, Task, Source and Artifact identity", "Keep stable Workspace, optional Engagement, Task, Source and Artifact identity", label="ARCH91")
a = sub(a, "no silent case-to-team promotion or cross-Assignment reuse.", f"no silent case-to-team promotion; recall is shared within a Workspace and isolated between Workspaces (OQ-3, {D}).", label="ARCH115")
a = sub(a, "Tasks/Assignments cannot silently change authority;", "Tasks/Engagements cannot silently change authority;", label="ARCH133")
a = sub(a, "OQ-5/6/8/9 gate enablement and promises.", "OQ-5/6/8/9 are decided (2026-10-27); the missing production route still gates enablement and promises.", label="ARCH184")
a = sub(a, "OQ-1/6/9 gate permissions and integration commitments.", "OQ-1/6/9 are decided (2026-10-27); the missing route still gates permissions and integration commitments.", label="ARCH185")
a = sub(a, "Open choices retain proposed role owners, not named appointments. They permit option analysis while preventing affected commitments. No new product policy is inferred from this contract.",
           "Open choices retain proposed role owners, not named appointments. Rows marked decided 2026-10-27 record the product owner's decision from spec review; the remaining rows still prevent affected commitments. No new product policy is inferred from this contract.", label="ARCH220")
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
