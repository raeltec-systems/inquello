"""Re-derive the complete spec package from the logged base and final amendment.

This is a bmad-spec derivation revision, not an in-place edit of derived documents.
The initial derivation data must still match its acknowledged memlog manifest.
The final support-language amendment and validation verdicts are logged by the
calling bmad-spec run before this script is invoked.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

working = Path(__file__).resolve().parent
module_spec = importlib.util.spec_from_file_location("inquello_spec_base", working / "derive-spec.py")
base = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(base)
receipt = json.loads((working / "derivation-progress.json").read_text(encoding="utf-8"))
expected_manifest = [{"type": kind, "text": text} for kind, text in base.records()]
if receipt["manifest"] != expected_manifest or receipt["appended"] != len(expected_manifest):
    raise SystemExit("Base derivation no longer matches its fully acknowledged decision log.")

def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"Expected one derivation anchor: {old[:85]}")
    return text.replace(old, new, 1)

spec = base.render_spec()
spec = replace_once(spec, "status: draft\n", "status: final\ncreated: 2026-10-27\nupdated: 2026-10-27\n")
spec = replace_once(
    spec,
    "> **Draft contract.** Read this SPEC and every `companions:` file together. The complete scope and adopted decisions are retained; coherence and preservation validation are pending.",
    "> **Canonical contract.** Read this SPEC and every `companions:` file together. The complete scope and adopted decisions are retained; coherence and source-preservation validation passed. Document validation does not establish implementation or runtime acceptance.",
)
companion = base.render_companion()
companion = replace_once(
    companion,
    "Follow the spine's linked evidence before dependent implementation, including experimental/unsupported-production transport limitations.",
    "Follow the spine's linked evidence before dependent implementation. Its recorded upstream warning covers the app-server command and WebSocket transport in the remote Code Mode host context: both are experimental/unsupported for production. Default stdio availability establishes neither blanket production support nor Inquello readiness; verify and harden the selected fork/route before release.",
)
companion = replace_once(
    companion,
    "This draft performs no installation, fork creation, runtime validation, deployment, production approval or story breakdown.",
    "This spec-creation work performs no installation, fork creation, runtime validation, deployment, production approval or story breakdown.",
)

outputs = {"SPEC.md": spec, "scope-and-gates.md": companion}
for filename, content in outputs.items():
    (base.WORKSPACE / filename).write_text(content, encoding="utf-8")
capability_map = [
    {"id": f"CAP-{number}", "phase": phase, "p": p, "fr": [f"FR-{fr_id}" for fr_id in fr]}
    for number, _, phase, p, fr, *_ in base.CAPS
]
(working / "capability-map.json").write_text(json.dumps(capability_map, indent=2) + "\n", encoding="utf-8")
result = {
    "derivation": "final revision from acknowledged base decisions plus logged support-language amendment",
    "status": "final",
    "capabilities": len(capability_map),
    "capability_ids_changed": False,
    "adopted_sources_edited": False,
    "outputs": {name: {"sha256": hashlib.sha256(content.encode("utf-8")).hexdigest()} for name, content in outputs.items()},
}
(working / "derivation-final.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
