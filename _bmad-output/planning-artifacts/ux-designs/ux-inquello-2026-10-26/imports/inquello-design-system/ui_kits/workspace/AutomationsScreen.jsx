function AutomationsScreen({ autos, notify }) {
  const [sel, setSel] = React.useState('rate');
  const [on, setOn] = React.useState(true);
  const a = autos.find(x => x.id === sel);
  const checks = [['accepted', 'Credit committee approval', 'Minutes of 14 Oct approve 19.5% for Kijani Growth Loan'], ['accepted', 'Change ticket CHG-2231', 'Rate table updated by core banking team, 24 Oct'], ['evidence', 'Second approver sign-off', 'Policy CP-04 needs a second approver; none found'], ['open', 'Customer notice, 30 days', 'Draft notice ready; send date not confirmed']];
  return <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <Header title="Automations" crumbs="Recurring and event-triggered work across workspaces"><Button size="sm" icon="plus">New automation</Button></Header>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <section style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 18 }}>
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          {autos.map((x, i) => <div key={x.id} onClick={() => setSel(x.id)} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', padding: '10px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', background: sel === x.id ? 'var(--row-selected-bg)' : '#fff', cursor: 'pointer' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 220px' }}><span style={{ font: '500 13px var(--font-sans)' }}>{x.name}</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{x.ws} · {x.trig}</span></div>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)', whiteSpace: 'nowrap', flex: 'none' }}>{x.last}</span>
            <span style={{ flex: 'none' }}>{x.kind === 'attn' ? <StatusChip status="evidence">{x.status}</StatusChip> : <StatusChip status="accepted">{x.status}</StatusChip>}</span></div>)}
        </div>
      </section>
      <aside style={{ width: 'clamp(320px, 40%, 440px)', flex: 'none', borderLeft: '1px solid var(--border-default)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ font: 'var(--type-title)' }}>{a.name}</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{a.ws} · {a.trig}</span></div><Switch checked={on} onChange={setOn} label={on ? 'On' : 'Off'} /></div>
        {sel === 'rate' ? <>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar kind="agent" size={16} /><span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Run by Inquello · 25 Oct, 16:20</span></div><span style={{ font: 'var(--type-ui)' }}>Kijani Growth Loan rate changed from 18.0% to 19.5%, effective 1 Nov. I checked approvals and related controls and prepared a review package.</span></div>
          <Over>Checks</Over>
          {checks.map(([s, t, d]) => <div key={t} style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 10, font: 'var(--type-ui)' }}><div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 500 }}>{t}</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{d}</span></div><StatusChip status={s} /></div>)}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Button variant="primary" icon="eye">Open review package</Button><Button onClick={() => notify('Asked Kijani credit team for the second approval')}>Request approval evidence</Button></div>
        </> : <div style={{ font: 'var(--type-ui)', color: 'var(--text-muted)' }}>Last run {a.last} · {a.status}. Nothing needs you.</div>}
      </aside>
    </div>
  </main>;
}
Object.assign(window, { AutomationsScreen });
