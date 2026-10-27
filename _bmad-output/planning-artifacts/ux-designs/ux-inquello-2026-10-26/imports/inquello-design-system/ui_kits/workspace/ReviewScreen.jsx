function ReviewScreen({ rows, items, decide, back, notify }) {
  const r1 = items.find(i => i.id === 'R1');
  const decided = r1.status !== 'suggested';
  const [choice, setChoice] = React.useState(decided ? 'open' : 'dup');
  const [reason, setReason] = React.useState('Arden Retail says two invoices were paid; wait for Nordbank before treating it as a duplicate.');
  const changed = !decided && choice !== 'dup';
  const head = ['Row', 'Date', 'Bank', 'Amount', 'Ledger', 'Amount', 'Result'];
  const cols = '44px 56px minmax(0,1.5fr) 84px minmax(0,1.3fr) 84px 150px';
  return <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <Header title="Reconciliation — Sep 2026.xlsx" crumbs="Review · Tom Okafor commented on R1">
      <Button size="sm" icon="external-link" onClick={() => notify('Opened in Excel · changes there come back as v5')}>Open in Excel</Button>
      <IconButton icon="minimize-2" label="Back to thread" onClick={back} />
    </Header>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <section style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 18, background: 'var(--surface-panel)' }}>
        <div style={{ minWidth: 760, background: '#fff', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', fontVariantNumeric: 'tabular-nums', font: 'var(--type-ui)', fontSize: 12.5 }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '6px 10px', background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-default)' }}>{head.map((h, i) => <span key={i} style={{ font: '500 10px var(--font-mono)', letterSpacing: '.04em', color: 'var(--text-faint)', textTransform: 'uppercase', textAlign: i === 3 || i === 5 ? 'right' : 'left', paddingRight: 8 }}>{h}</span>)}</div>
          {rows.map((r, i) => { const hl = r.r1; const res = r.b === '19' ? (decided ? <StatusChip status="open" decidedBy="PR">Open, bank to confirm</StatusChip> : <StatusChip status="suggested">R1 · possible duplicate</StatusChip>) : <span style={{ color: r.k === 'ok' ? 'var(--text-faint)' : 'var(--text-secondary)' }}>{r.res}</span>;
            return <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', background: hl ? 'var(--source-highlight-bg)' : '#fff' }}>
              <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-faint)' }}>{r.b}</span><span style={{ color: 'var(--text-muted)' }}>{r.bd}</span><span style={{ minWidth: 0, paddingRight: 8 }}>{r.bdesc}</span><span style={{ textAlign: 'right', paddingRight: 8 }}>{r.bamt}</span><span style={{ minWidth: 0, paddingRight: 8, color: r.l === '—' ? 'var(--text-faint)' : 'var(--text-primary)' }}><span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-faint)', marginRight: 6 }}>{r.l}</span>{r.ldesc}</span><span style={{ textAlign: 'right', paddingRight: 8 }}>{r.lamt}</span><span>{res}</span></div>; })}
        </div>
      </section>
      <aside style={{ width: 'clamp(300px, 36%, 400px)', flex: 'none', borderLeft: '1px solid var(--border-default)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box' }}>
        <div style={{ flex: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar initials="TO" tone="green" size={22} /><span style={{ font: '500 13px var(--font-sans)' }}>Tom Okafor</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>on R1 · 11:20</span></div><span style={{ font: 'var(--type-body)' }}>Show me why this was classified as a duplicate.</span></div>
          <div style={{ padding: '10px 12px', background: 'var(--ink-50)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar kind="agent" size={20} /><span style={{ font: '500 13px var(--font-sans)' }}>Inquello</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>rows 18 and 19 highlighted</span></div>
            {[['observation', 'Two transfers in from Arden Retail with the same reference, RCP-2291, on 12 and 13 Sep.'], ['calculation', 'Both are 500.00. The ledger has one receipt, JE-4410, against INV-8812.'], ['gap', 'No second Arden invoice in the sales ledger extract, and no bank advice for row 19.'], ['suggestion', 'Treat row 19 as a duplicate bank entry and ask Nordbank to confirm the reversal.']].map(([k, t]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: 8, font: 'var(--type-ui)', color: 'var(--text-secondary)' }}><JudgmentTag kind={k} /><span>{t}</span></div>)}
          </div>
        </div>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Over>Treatment of R1</Over>
          <Choice checked={choice === 'dup'} onChange={() => setChoice('dup')} label="Duplicate bank entry" description="Agent suggestion. Remove 500.00 from the adjusted bank balance." />
          <Choice checked={choice === 'open'} onChange={() => setChoice('open')} label="Open item until Nordbank confirms" description="Keep the 500 in open items; the note says it is unconfirmed." />
          <Choice checked={choice === 'unrec'} onChange={() => setChoice('unrec')} label="Unrecorded receipt" description="Post a second receipt from Arden Retail; needs an invoice." />
          {changed ? <TextField multiline rows={2} label="Reason, saved with the decision" value={reason} onChange={setReason} /> : null}
        </div>
        {changed ? <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Over>Affects 4 outputs</Over>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}><DiffLine kind="del" gutter="F8">Duplicate bank entry</DiffLine><DiffLine kind="add" gutter="F8">Open — bank to confirm</DiffLine><DiffLine kind="change" gutter="B6">Adjusted bank balance · 4,950.00 → 5,450.00</DiffLine><DiffLine kind="change" gutter="¶3">Review note: R1 described as unconfirmed</DiffLine><DiffLine kind="add" gutter="OI">Open items list · R1 · 500.00</DiffLine></div>
          <div style={{ display: 'flex', gap: 6 }}><Button variant="primary" onClick={() => { decide('R1', 'open'); notify('Kept · 4 outputs updated · v4'); }}>Keep</Button><Button variant="ghost" onClick={() => setChoice('dup')}>Revert</Button></div>
        </div> : decided ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', color: 'var(--text-muted)' }}><StatusChip status="open" decidedBy="PR" />Decided by Priya Raman · v4</div> : null}
      </aside>
    </div>
  </main>;
}
Object.assign(window, { ReviewScreen });
