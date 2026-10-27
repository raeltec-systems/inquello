import re, pathlib
ROOT = pathlib.Path(r"D:\Projects\inquello\_bmad-output")
PRD  = ROOT/"planning-artifacts/prds/prd-inquello-2026-10-26/prd.md"
EXP  = ROOT/"planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md"
ARCH = ROOT/"planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md"
SPEC = ROOT/"specs/spec-inquello/SPEC.md"
SG   = ROOT/"specs/spec-inquello/scope-and-gates.md"
OQ13 = "the agent browser and agent sandbox are local in V1 (Codex desktop built-in browser profile, Computer Use, OS sandbox enforcement); a hosted browser or hosted sandbox is deferred to V2 and must be revisited there"
OQ14 = "Inquello owns identity and authorisation through its own auth module covering Workspace membership, audit-team roles, Engagement membership and the differing internal-audit and external-audit models; inference-provider sign-in (ChatGPT subscription, Claude, Azure, Bedrock, Vertex) is separate and only selects and authorises the inference route"
def sub(s, old, new, label):
    if old not in s: raise SystemExit(f"MISSING in {label}: {old[:90]}")
    return s.replace(old, new, 1)
def after_line(s, head, new_lines, label):
    m = re.search(r"(?m)^" + re.escape(head) + r"[^\n]*$", s)
    if not m: raise SystemExit(f"line missing: {label}")
    return s[:m.end()] + "\n" + new_lines + s[m.end():]

# PRD
p = PRD.read_text(encoding="utf-8")
p = after_line(p, "12. **OQ-12 — Final name and design direction.**",
  f"13. **OQ-13 — Hosted agent browser and sandbox. Added and decided 2026-10-27:** {OQ13}. **Owner:** product lead with architecture lead. **Revisit:** at V2 planning, explicitly.\n"
  f"14. **OQ-14 — Identity and authorisation. Added and decided 2026-10-27:** {OQ14}. Claude as a direct route is not in the documented Codex route list; the architecture update confirms how it is reached. **Owner:** product lead with architecture and security leads. **Revisit:** architecture update must define the module and where it runs.", "PRD-12")
p = sub(p, "OQ-8 commitments are revisited after first validation; OQ-11 and OQ-12 remain open.",
           "OQ-8 commitments are revisited after first validation; OQ-11 and OQ-12 remain open. OQ-13 and OQ-14 were added and decided on 2026-10-27; OQ-13 carries an explicit V2 revisit.", "PRD-479")
PRD.write_text(p, encoding="utf-8")

# EXPERIENCE
e = EXP.read_text(encoding="utf-8")
e = sub(e, "Still open: **OQ-11** native-record policy; **OQ-12** final name/design validation.",
           "Added and decided 2026-10-27: **OQ-13** local agent browser/sandbox in V1, hosted revisit in V2; **OQ-14** Inquello identity module separate from inference-provider sign-in. Still open: **OQ-11** native-record policy; **OQ-12** final name/design validation.", "EXP-286")
EXP.write_text(e, encoding="utf-8")

# ARCH
a = ARCH.read_text(encoding="utf-8")
a = after_line(a, "| OQ-12 |",
  f"| OQ-13 | Product lead with architecture lead; decided 2026-10-27, revisit at V2 planning | Agent browser and sandbox are local in V1 (built-in browser profile, Computer Use, OS sandbox); hosted browser/sandbox deferred to V2. |\n"
  f"| OQ-14 | Product lead with architecture and security leads; decided 2026-10-27, module design pending | Inquello owns identity/authorisation via its own auth module (Workspace membership, audit-team roles, Engagement membership, internal vs external audit models). Provider sign-in only selects the inference route. Supersedes reliance on trusted host/policy context for identity; where the module runs is decided in the hosting update. Claude route reachability to be confirmed. |", "ARCH-12")
ARCH.write_text(a, encoding="utf-8")

# SPEC
s = SPEC.read_text(encoding="utf-8")
s = sub(s, "No Inquello-specific catalogue, approval workflow or budget values for first validation; add only on usage evidence.\n",
           "No Inquello-specific catalogue, approval workflow or budget values for first validation; add only on usage evidence.\n"
           "- Inquello owns identity and authorisation through its own auth module: Workspace membership, audit-team roles, Engagement membership and the differing internal-audit and external-audit models. Inference-provider sign-in (ChatGPT subscription, Claude, Azure, Bedrock, Vertex) only selects and authorises the inference route and never stands in for Inquello identity (OQ-14).\n"
           "- V1 agent browser and sandbox are local: the built-in browser profile, Computer Use and OS sandbox enforcement inherited from Codex (OQ-13).\n", "SPEC-constraints")
s = sub(s, "- Presuming continuous two-way synchronisation or a guest portal as accepted baseline;",
           "- A hosted agent browser or hosted sandbox in V1. **Revisit in V2** (OQ-13).\n- Presuming continuous two-way synchronisation or a guest portal as accepted baseline;", "SPEC-nongoal")
s = sub(s, "OQ-1 to OQ-10 were decided 2026-10-27;", "OQ-1 to OQ-10, OQ-13 and OQ-14 were decided 2026-10-27;", "SPEC-intro")
SPEC.write_text(s, encoding="utf-8")

# scope-and-gates
g = SG.read_text(encoding="utf-8")
g = after_line(g, "| OQ-7 | An internal audit team validates",
  f"| OQ-13 | Added 2026-10-27. {OQ13[0].upper() + OQ13[1:]}. **V2 revisit marker.** |\n"
  f"| OQ-14 | Added 2026-10-27. {OQ14[0].upper() + OQ14[1:]}. Module design and hosting are decided in the architecture update; Claude route reachability to be confirmed there. |", "SG-decided")
SG.write_text(g, encoding="utf-8")
print("OK")
