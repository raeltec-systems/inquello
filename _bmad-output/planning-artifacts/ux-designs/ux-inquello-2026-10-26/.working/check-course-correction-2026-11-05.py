from pathlib import Path
import re,json,subprocess,hashlib,yaml
r=Path("D:/Projects/inquello");b=r/"_bmad-output/planning-artifacts";a=b/"architecture/architecture-inquello-2026-10-26";u=b/"ux-designs/ux-inquello-2026-10-26"
p=u/"EXPERIENCE.md";s=p.read_text(encoding="utf-8")
s=s.replace("Required approval/delegation and version/change impact are visible;","Applicable prior work-programme approval and prompt approval of changes, delegated authority and version/change impact are visible;")
p.write_text(s.rstrip()+"\n",encoding="utf-8")
prd=(b/"prds/prd-inquello-2026-10-26/prd.md").read_text(encoding="utf-8")
d=(u/"DESIGN.md").read_text(encoding="utf-8")
flows=re.findall(r"^### (UJ-\d+)[^\n]*\n(.*?)(?=^### |\Z)",s,re.M|re.S)
expected_uj=set(re.findall(r"\bUJ-\d+\b",prd)); actual_uj={x for x,_ in flows}
expected_fr=set(re.findall(r"^#### (FR-\d+)",prd,re.M))
coverage=(u/".working/experience-coverage.md").read_text(encoding="utf-8")
issues=[]
if actual_uj!=expected_uj:issues.append({"journeys":{"expected":sorted(expected_uj),"actual":sorted(actual_uj)}})
for id,body in flows:
 if not all([re.search(r"^1\. ",body,re.M),"**Climax:**" in body,"**Failure/recovery:**" in body]):issues.append({"incomplete_flow":id})
if len(expected_fr)!=45:issues.append({"source_FR_count":len(expected_fr)})
if "FR-45" not in coverage or "FR-45" not in s:issues.append("FR45 missing")
# Compare actual tokens and imported bytes with unchanged Git HEAD; excludes only non-token frontmatter metadata.
baseline=subprocess.check_output(["git","show","HEAD:"+str((u/"DESIGN.md").relative_to(r)).replace("\\","/")],cwd=r).decode("utf-8")
front=lambda x:yaml.safe_load(x.split("---",2)[1])
curr,old=front(d),front(baseline)
token_unchanged=all(curr[k]==old[k] for k in ["colors","typography","rounded","spacing","components"])
if not token_unchanged:issues.append("token values changed")
imports=[]
baseline_hashes={x["path"]:x["sha256"].lower() for x in json.loads((b/"course-correction-2026-11-05/baseline-sha256.json").read_text(encoding="utf-8-sig"))}
for rel in subprocess.check_output(["git","ls-files",str((u/"imports").relative_to(r)).replace("\\","/")],cwd=r).decode().splitlines():
 before=subprocess.check_output(["git","show","HEAD:"+rel],cwd=r)
 if baseline_hashes.get(rel,hashlib.sha256(before).hexdigest())!=hashlib.sha256((r/rel).read_bytes()).hexdigest():imports.append(rel)
if imports:issues.append({"changed_imports":imports})
result={"status":"pass" if not issues else "fail","expected_PRD_journeys":len(expected_uj),"actual_named_complete_flows":len(flows),"PRD_FR_count":len(expected_fr),"tokens_unchanged":token_unchanged,"changed_imports":imports,"issues":issues,"limits":"Source-derived document checks only; no product test, UI rendering or runtime acceptance. Legacy checker remains unchanged at 22/24 solely due old fixed counts."}
(u/".working/course-correction-checks-2026-11-05.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps(result,indent=2))
