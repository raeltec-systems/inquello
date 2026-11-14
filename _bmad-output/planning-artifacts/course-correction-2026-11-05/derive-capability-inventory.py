"""Planning inventory derived from existing catalog plus bounded source audit; no code edits."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[3]
plan = root / "_bmad-output/planning-artifacts"
source = root / "engine/codex-rs/inquello-domain/register/inventory-map.json"
items = json.loads(source.read_text(encoding="utf-8"))["items"]
overlays = json.loads((Path(__file__).parent / "capability-audit-overlays.json").read_text(encoding="utf-8"))
default = ["Not separately source-audited in this pass; catalog commitment retained", "Inquello invocation and acceptance not independently established", "Inspect inherited path, then expose/adapt and qualify; do not assume a rebuild", "Determine exact dependency before enablement", "Catalog only"]
rows = []
for item in items:
    values = overlays.get(item["id"], default)
    rows.append(dict(id=item["id"], title=item["title"], inherited=values[0], integration=values[1], next_work=values[2], external_dependency=values[3], evidence=values[4], story_ids=[s["story"] for s in item["stories"]], disposition="Retained compatible V1 goal, subject to existing phase and current audit-applicability rules", acceptance="No new runtime verification performed; consult exact current story evidence"))
extra = dict(id="DELTA-GCP", title="Named GCP / Vertex provider delta", inherited="GCP provider constructor and auth route present; Responses wire protocol", integration="Exact provider/model API and Inquello route not independently qualified", next_work="Qualify exact supported API/model route and policy; do not infer arbitrary native API compatibility", external_dependency="GCP service/auth/policy", evidence="P", story_ids=["9.7"], disposition="Retained named route; current epic Story 9.7 is the GCP/Vertex supplier/verification contract", acceptance="No new runtime verification")
rows.append(extra)
assert len([r for r in rows if r["id"].startswith("C")]) == 79
assert len([r for r in rows if r["id"].startswith("E")]) == 20
payload = dict(date="2026-11-05", source_head="c407483170e93ad9bea0f2d1c36e9d32693b0c44", status="planning inventory; bounded source inspection, not feature acceptance", source_catalog=str(source.relative_to(root)).replace("\\","/"), catalog_rows=99, extra_routes=1, rows=rows)
(plan / "capability-reuse-inventory-2026-11-05.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
out = """---
title: "Compatible Codex capability reuse inventory"
updated: "2026-11-05"
status: planning-baseline-source-checks-incomplete
source_head: c407483170e93ad9bea0f2d1c36e9d32693b0c44
---
# Reuse, expose or adapt, then qualify

## Approved rule
Retain every compatible Codex capability and documented model route. First reuse the existing implementation; expose or adapt it through Inquello's private Task, identity, permissions, evidence and audit experience; then qualify the exact supported platform/provider/service path. A future story is not evidence of absent code. An inherited handler, feature flag or configuration screen is not evidence that the current Task can invoke it or that a service is supplied.

The complete internal-audit V1 journey and a supported recurring check remain required. External-audit-specific workflows/standards, multi-client switching, complex large-team capacity features, a new broad integration marketplace, custom every-system connectors and automatic all-history migration are outside this V1. These exclusions do not remove inherited compatible plugins/MCP/skills, route choices or security/isolation obligations. Native authoritative audit records remain V2; external-authority V1 and the desktop-first Excel/Word/PowerPoint/CSV import/export baseline remain.

## Evidence and limits
- **I**: [Inherited core audit](course-correction-2026-11-05/inherited-core-audit.md), exact source paths/lines and original subtree comparison.
- **D**: [Desktop wiring audit](course-correction-2026-11-05/desktop-capability-wiring-audit.md), UI/IPC/native call chains and enforced private restrictions.
- **P**: [Public fork boundary audit](course-correction-2026-11-05/public-fork-boundary-audit.md), separate applications/hosted services, scheduling and provider boundaries.
- Catalog: [Original detailed mirror](../../docs/CODEX_AUDITOR_FEATURE_MIRROR.md) and engine register inventory-map.json at the recorded head; all 79 C IDs and 20 expanded E IDs are retained below, plus the named GCP delta. The original 270 subfeatures and 93 proposed enhancements retain their original applicability/status; this ledger does not promote proposed enhancements.
- Story references below reproduce the existing register at the recorded head and are traceability pointers, not completion claims. Current [epics](epics.md) and the November scope/traceability reconciliation govern later dependency additions. No engine register was edited during planning.
- Source verification is bounded. Rows marked catalog-only are explicitly unverified, not absent. The next owner is the implementing story's engineering owner under Israel's product direction; complete its source/API/config/patch/UI/native/service/test ledger before capability enablement.
- No runtime tests or live calls were run for this inventory. Existing authored work and historical test evidence remain separate. No claim of full proprietary application/service parity, automatic entitlement or present all-feature usability.

## Per-feature inventory
Each row states inheritance, effective integration, remaining work, service boundary and evidence separately. The [JSON companion](capability-reuse-inventory-2026-11-05.json) retains machine-readable fields and acceptance limits.

| ID / capability | Inherited implementation | Current Inquello integration | Remaining reuse / adaptation / qualification | External dependency | Evidence / stories |
|---|---|---|---|---|---|
"""
def esc(s): return s.replace("|", "/").replace("\n", " ")
for r in rows:
    out += "| " + " | ".join(map(esc, [r["id"]+" "+r["title"],r["inherited"],r["integration"],r["next_work"],r["external_dependency"],r["evidence"]+"; "+", ".join(r["story_ids"])])) + " |\n"
out += """
## Per-feature completion evidence
Before a row can be called usable, attach the exact inherited source/API and fork patch, effective config, Inquello UI/IPC/native invocation, current identity/grants and data flow, external service/entitlement if needed, positive and negative tests, interruption/recovery and usable audit output. Preserve existing approval, revocation, sandbox, no-fallback and effect-reconciliation boundaries. Unknowns become explicit prerequisite work, not silent feature cuts.

Private Task startup currently restricts tools to exec_command, inquello_progress and request_user_input and disables several inherited features/endpoints. Exposing more capabilities requires bound authority integration, not bypassing the generic-operation guard. Scheduling primitives exist but do not prove recurrence after app shutdown, host sleep or missed runs. Provider constructors do not prove every native API, model or hosted feature is compatible.

Full V1 completion requires accepted compatible obligations plus the approved audit journey; an early engineering checkpoint or partial qualified set is not full parity. If an item cannot be made compatible or depends on unavailable service supply, report the exact blocker and obtain a scope/sequence decision rather than silently reclassifying it.
"""
(plan / "capability-reuse-inventory-2026-11-05.md").write_text(out, encoding="utf-8")
print(json.dumps({"catalog_C":79,"expanded_E":20,"extra_routes":1,"source_overlays":len(overlays),"catalog_only":sum(r["evidence"]=="Catalog only" for r in rows),"files":["capability-reuse-inventory-2026-11-05.md","capability-reuse-inventory-2026-11-05.json"]}))
