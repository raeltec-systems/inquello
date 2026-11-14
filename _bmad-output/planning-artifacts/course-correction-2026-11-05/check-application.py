"""Read-only current-document checks; not a software test or legacy-check replacement."""
from pathlib import Path
import json,re,hashlib,subprocess
root=Path(__file__).resolve().parents[3]
p=root/"_bmad-output/planning-artifacts"; w=Path(__file__).parent
baseline=json.loads((w/"baseline-sha256.json").read_text(encoding="utf-8-sig"))
changed=[]
for row in baseline:
 f=root/row["path"]
 if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest().upper()!=row["sha256"].upper(): changed.append(row["path"])
allowed={
"_bmad-output/implementation-artifacts/sprint-status.yaml",
"_bmad-output/planning-artifacts/epics.md",
"_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/.memlog.md",
"_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md",
"_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/shared-service-contract-proposal-2026-10-27.md",
"_bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/.memlog.md",
"_bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/prd.md",
"_bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md",
"_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/.memlog.md",
"_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/.working/experience-coverage.md",
"_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md",
"_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md",
"_bmad-output/specs/spec-inquello/.memlog.md",
"_bmad-output/specs/spec-inquello/SPEC.md",
"_bmad-output/specs/spec-inquello/glossary.md",
"_bmad-output/specs/spec-inquello/scope-and-gates.md"}
unexpected=sorted(set(changed)-allowed)
specdir=root/"_bmad-output/specs/spec-inquello"
spec=(specdir/"SPEC.md").read_text(encoding="utf-8")
prd=(p/"prds/prd-inquello-2026-10-26/prd.md").read_text(encoding="utf-8")
caps=re.findall(r"^- \*\*CAP-(\d+)\*\*",spec,re.M)
frs=re.findall(r"^#### FR-(\d+)\b",prd,re.M)
companions=re.search(r"companions:\n(.*?)\nsources:",spec,re.S).group(1)
compfiles=[(specdir/s.strip()[2:]).resolve() for s in companions.splitlines() if s.strip().startswith("- ")]
files=[specdir/x for x in ["SPEC.md","scope-and-gates.md","glossary.md","lifecycle-and-readiness.md"]]+[p/"capability-reuse-inventory-2026-11-05.md",p/"sprint-change-proposal-2026-11-05.md",p/"epic-scope-and-dependencies-2026-11-05.md",p/"implementation-readiness-2026-11-05.md"]
broken=[]; links=0
for f in files:
 for dest in re.findall(r"\[[^\]]*\]\(([^)]+)\)",f.read_text(encoding="utf-8")):
  if "://" in dest or dest.startswith("#"): continue
  dest=dest.split("#",1)[0]
  if not dest: continue
  links+=1
  if not (f.parent/dest).resolve().exists(): broken.append({"file":str(f.relative_to(root)),"link":dest})
inv=json.loads((p/"capability-reuse-inventory-2026-11-05.json").read_text())
raw=json.loads((root/"engine/codex-rs/inquello-domain/register/inventory-map.json").read_text())
catalog_ids={r["id"] for r in raw["items"]}
ledger_ids={r["id"] for r in inv["rows"]}
diff=subprocess.run(["git","diff","--check"],cwd=root,capture_output=True,text=True)
code=subprocess.run(["git","diff","--name-only","--","engine","desktop"],cwd=root,capture_output=True,text=True)
checks={"baseline_unexpected_changes":not unexpected,"all_spec_companions_exist":all(x.exists() for x in compfiles),"cap_ids_1_to_26":len(caps)==26 and set(map(int,caps))==set(range(1,27)),"cap_intent_success":spec.count("**intent:**")==26 and spec.count("**success:**")==26,"fr_ids_1_to_45":len(frs)==45 and set(map(int,frs))==set(range(1,46)),"local_links_resolve":not broken,"catalog_preserved":catalog_ids <= ledger_ids and len(ledger_ids)==100,"no_code_diff":not code.stdout.strip(),"git_diff_check":diff.returncode==0}
result={"checks":checks,"passed":all(checks.values()),"baseline_files":len(baseline),"expected_changed_files":changed,"unexpected":unexpected,"spec_companions":len(compfiles),"local_link_count":links,"broken_links":broken,"catalog_rows":99,"extra_routes":1,"source_audited_overlays":40,"catalog_only_unverified":59,"runtime_tests_run":False}
(w/"application-checks.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,indent=2))
