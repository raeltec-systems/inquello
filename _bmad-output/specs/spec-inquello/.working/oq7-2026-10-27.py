import re, pathlib
ROOT = pathlib.Path(r"D:\Projects\inquello\_bmad-output")
PRD  = ROOT/"planning-artifacts/prds/prd-inquello-2026-10-26/prd.md"
EXP  = ROOT/"planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md"
ARCH = ROOT/"planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md"
SPEC = ROOT/"specs/spec-inquello/SPEC.md"
SG   = ROOT/"specs/spec-inquello/scope-and-gates.md"
DEC = "an internal audit team validates on the task types it picks during validation planning; no numeric thresholds until a baseline exists, measure first"
warn = []
def sub(s, old, new, must=True, label=""):
    if old not in s:
        if must: raise SystemExit(f"MISSING in {label}: {old[:90]}")
        warn.append(label); return s
    return s.replace(old, new, 1)
def swap_line(s, head, new, label):
    m = re.search(r"(?m)^" + re.escape(head) + r"[^\n]*$", s)
    if not m: raise SystemExit(f"line missing: {label}")
    return s[:m.start()] + new + s[m.end():]

# PRD
p = PRD.read_text(encoding="utf-8")
p = swap_line(p, "7. **OQ-7 — Validation participants and quantitative targets.**",
  f"7. **OQ-7 — Validation participants and quantitative targets. Decided 2026-10-27:** {DEC}. Permitted examples and acceptance owners are named at validation planning. **Owner:** audit lead with product lead. **Revisit:** when a baseline exists, to set thresholds.", "PRD-OQ7")
p = sub(p, "OQ-7 still gates practitioner validation and benefit claims; OQ-8 commitments are revisited after first validation; OQ-11 and OQ-12 remain open.",
           "OQ-7 was decided on 2026-10-27 as measure-first; numeric thresholds follow the baseline. OQ-8 commitments are revisited after first validation; OQ-11 and OQ-12 remain open.", label="PRD-479")
p = sub(p, "Targets below describe the intended direction; numerical thresholds require OQ-7 baseline approval.",
           "Targets below describe the intended direction; numerical thresholds are set once the validating internal audit team has a baseline (OQ-7, decided 2026-10-27).", must=False, label="PRD-433")
p = sub(p, "Validate the flows with the selected team under OQ-7.", "Validate the flows with the validating internal audit team (OQ-7, decided 2026-10-27).", must=False, label="PRD-AS1")
PRD.write_text(p, encoding="utf-8")

# EXPERIENCE
e = EXP.read_text(encoding="utf-8")
e = sub(e, "**OQ-10** sequencing at story breakdown. Still open: **OQ-7** participants/examples/baselines; **OQ-11** native-record policy; **OQ-12** final name/design validation.",
           "**OQ-10** sequencing at story breakdown; **OQ-7** an internal audit team validates on task types it picks, thresholds after a baseline. Still open: **OQ-11** native-record policy; **OQ-12** final name/design validation.", label="EXP-286")
EXP.write_text(e, encoding="utf-8")

# ARCH
a = ARCH.read_text(encoding="utf-8")
a = swap_line(a, "| OQ-7 |", f"| OQ-7 | Audit/product leads; decided 2026-10-27, thresholds once a baseline exists | An internal audit team validates on task types it picks during validation planning; no numeric thresholds until a baseline exists. |", "ARCH-OQ7")
ARCH.write_text(a, encoding="utf-8")

# SPEC
s = SPEC.read_text(encoding="utf-8")
s = sub(s, "OQ-1/2/3/4/5/6/8/9/10 were decided 2026-10-27;", "OQ-1 to OQ-10 were decided 2026-10-27;", label="SPEC-intro")
s = sub(s, "- **OQ-7:** Who validates which examples against which baselines and thresholds?\n", "", label="SPEC-OQ7")
s = sub(s, "Compare matched practitioner task classes through human acceptance for total effort, traceability, cost and recovery within approved bounds;",
           "An internal audit team validates on task types it picks during validation planning, comparing matched task classes through human acceptance for total effort, traceability, cost and recovery;", label="SPEC-success")
s = sub(s, "No runtime acceptance is claimed yet; numerical targets remain gated.", "No runtime acceptance is claimed yet; numerical thresholds follow the first baseline.", label="SPEC-success2")
SPEC.write_text(s, encoding="utf-8")

# scope-and-gates
g = SG.read_text(encoding="utf-8")
g = sub(g, "| OQ-10 | Sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there with unmet acceptance. |\n",
           "| OQ-10 | Sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there with unmet acceptance. |\n"
           f"| OQ-7 | An internal audit team validates on the task types it picks during validation planning; no numeric thresholds until a baseline exists, measure first. Examples and acceptance owners named at validation planning. |\n", label="SG-decided")
head, tail = g.split("## Open product gates", 1)
tail, n = re.subn(r"\n\| OQ-7 \|[^\n]*", "", tail, count=1)
if n != 1: raise SystemExit("SG open OQ-7 row missing")
g = head + "## Open product gates" + tail
g = sub(g, "OQ-7 gates practitioner validation and benefit claims; OQ-11 native-record policy does not block V1; OQ-12 gates public brand commitments.",
           "OQ-11 native-record policy does not block V1; OQ-12 gates public brand commitments. Numeric thresholds follow the validating team's baseline (OQ-7).", label="SG-para")
g = sub(g, "thresholds await OQ-7; operating commitments follow first validation (OQ-8).", "thresholds follow the validating team's baseline (OQ-7); operating commitments follow first validation (OQ-8).", label="SG-thresh")
g = sub(g, "| AS-1 | Journey personas/scenarios are illustrative, not observed practitioner sessions. | Audit lead with product lead under OQ-7 | Validate the flows with the selected team before practitioner-validation or benefit claims. |",
           "| AS-1 | Journey personas/scenarios are illustrative, not observed practitioner sessions. | Audit lead with product lead | Validate the flows with the validating internal audit team (OQ-7) before practitioner-validation or benefit claims. |", label="SG-AS1")
SG.write_text(g, encoding="utf-8")
print("OK; warnings:", warn or "none")
