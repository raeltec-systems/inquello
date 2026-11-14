from pathlib import Path
def edit(f,a,b):
 p=Path(f);s=p.read_text();assert a in s,(f,a);p.write_text(s.replace(a,b,1))
p=Path('desktop/src/renderer/Shell/Shell.tsx');s=p.read_text();a=s.index('    let result: Outcome<TaskPolicyItem>;',s.index('  const loadPolicy ='));b=s.index('  }, []);',a)
s=s[:a]+"""    const current = () => openTask.current === taskId && generation === policyRead.current;
    const read = async (inspectionOnly: boolean): Promise<boolean> => {
      let result: Outcome<TaskPolicyItem>;
      try {
        result = parseOutcome(await api.forTask(inspectionOnly ? { taskId, inspectionOnly: true } : { taskId }), parseTaskPolicy);
      } catch {
        result = { ok: false, code: 'failed', reason: 'The request did not complete.' };
      }
      if (!current()) return false;
      if (result.ok) {
        setTaskPolicy(result.value);
        setPolicyNotice(null);
      } else {
        setTaskPolicy(null);
        setPolicyNotice('The policy could not be read. ' + result.reason);
      }
      return result.ok;
    };
    // Show current policy promptly. Storage preparation is separate and cannot
    // delay the policy's governing rules; unchecked reach is not shown as ready.
    if (await read(true) && current() && permissionsFor.current === taskId) await read(false);
"""+s[b:]
old="      let result: Outcome<TaskPolicyItem>;\n      try {\n        result = parseOutcome(\n          await api.setBroadMode"
new="      const generation = ++policyRead.current;\n      let result: Outcome<TaskPolicyItem>;\n      try {\n        result = parseOutcome(\n          await api.setBroadMode"
assert old in s;s=s.replace(old,new,1)
start=s.index('  const setMode =');end=s.index('  useEffect(() => {',start);chunk=s[start:end];assert 'if (openTask.current !== taskId) return null;' in chunk;s=s[:start]+chunk.replace('if (openTask.current !== taskId) return null;','if (openTask.current !== taskId || generation !== policyRead.current) return null;',1)+s[end:];p.write_text(s)
edit('desktop/src/renderer/Shell/TaskPolicy.tsx',"""          <section className="iq-task-reach" aria-labelledby="iq-task-reach-heading" data-task-reach={policy.taskId}>""","""          {policy.sandbox.status === 'not-checked' ? (
            <p className="iq-task-state-meta" role="status">{policy.sandbox.label}</p>
          ) : <section className="iq-task-reach" aria-labelledby="iq-task-reach-heading" data-task-reach={policy.taskId}>""")
edit('desktop/src/renderer/Shell/TaskPolicy.tsx','          </section>\n          <div className="iq-task-mode"','          </section>}\n          <div className="iq-task-mode"')
print('Separated policy metadata from pending sandbox preparation; stale reads fenced.')

