"""Re-derive acknowledged spec baseline from appended owner-approved amendment."""
import json, hashlib, re
from pathlib import Path
w=Path(__file__).resolve().parent.parent
baseline=json.loads((w/".working/derivation-input-2026-11-05.json").read_text(encoding="utf-8"))
amend=json.loads((w/".working/derivation-amendment-2026-11-05.json").read_text(encoding="utf-8"))
log=(w/".memlog.md").read_text(encoding="utf-8")
for kind, claim in amend["records"]:
    assert claim in log, "Unacknowledged amendment: "+claim[:80]
outputs=dict(baseline)
for name, changes in amend["replacements"].items():
    for change in changes:
        assert outputs[name].count(change["old"])==1, "Nonunique derivation anchor "+name+": "+change["old"][:80]
        outputs[name]=outputs[name].replace(change["old"],change["new"],1)
for name, suffix in amend["appends"].items(): outputs[name]+=suffix
outputs.update(amend["newfiles"])
ids=re.findall(r"^- \*\*CAP-(\d+)\*\*",outputs["SPEC.md"],re.M)
assert len(ids)==26 and set(map(int,ids))==set(range(1,27))
assert outputs["SPEC.md"].count("**intent:**")==26
assert outputs["SPEC.md"].count("**success:**")==26
for name,body in outputs.items(): (w/name).write_text(body,encoding="utf-8")
result={"status":"derived-from-acknowledged-log","capabilities":26,"new_id":"CAP-26","previous_ids_preserved":True,"outputs":{n:hashlib.sha256(v.encode()).hexdigest() for n,v in outputs.items()}}
(w/".working/derivation-2026-11-05.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,indent=2))
