function Workbook({ sheet, setSheet, items, onItem }) {
  const cell = { padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)' };
  const sum = [['Balance per bank, 30 Sep', '4,750.00', 1], ['Less duplicate bank entry · R1', '(500.00)'], ['Add receipt not yet on statement · R4', '700.00'], ['Adjusted bank balance', '4,950.00', 1], ['Balance per ledger, 30 Sep', '4,600.00', 1], ['Add receipt not in ledger · R3', '300.00'], ['Add payment difference · R2', '50.00'], ['Adjusted ledger balance', '4,950.00', 1], ['Unreconciled difference', '0.00', 1]];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, overflow: 'auto', flex: 1, minHeight: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 'none' }}><FileChip type="xls" variant="tag" /><span style={{ font: '500 13px var(--font-sans)', whiteSpace: 'nowrap' }}>Reconciliation — Sep 2026.xlsx</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>v3 · draft copy</span><div style={{ flex: 1 }} /><SegmentedControl value={sheet} onChange={setSheet} options={[{ value: 'summary', label: 'Summary' }, { value: 'items', label: 'Reconciling items' }]} /></div>
    <div style={{ flex: 'none', border: '1px solid var(--border-default)', borderRadius: 8, overflowX: 'auto', overflowY: 'hidden', font: 'var(--type-ui)', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}><div style={{ minWidth: 440 }}>
      {sheet === 'summary' ? sum.map(([a, b, bold], i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px', ...cell, fontWeight: bold ? 600 : 400, background: i === 8 ? 'var(--surface-panel)' : '#fff' }}><span style={{ paddingLeft: bold ? 0 : 14 }}>{a}</span><span style={{ textAlign: 'right' }}>{b}</span></div>)
        : <>{<div style={{ display: 'grid', gridTemplateColumns: '30px minmax(150px,1fr) 72px 124px', ...cell, background: 'var(--surface-panel)' }}>{['#', 'Item', 'Amount', 'Status'].map((t, i) => <span key={t} style={{ font: '500 10px var(--font-mono)', letterSpacing: '.04em', color: 'var(--text-faint)', textTransform: 'uppercase', textAlign: i === 2 ? 'right' : 'left', paddingLeft: i === 3 ? 12 : 0 }}>{t}</span>)}</div>}
          {items.map(it => <div key={it.id} onClick={() => onItem(it.id)} style={{ display: 'grid', gridTemplateColumns: '30px minmax(150px,1fr) 72px 124px', alignItems: 'center', ...cell, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--row-selected-bg)'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-faint)' }}>{it.id}</span><span style={{ minWidth: 0 }}>{it.label}</span><span style={{ textAlign: 'right' }}>{it.amt}</span><span style={{ paddingLeft: 12 }}><StatusChip status={it.status} decidedBy={it.decidedBy} /></span></div>)}</>}
    </div></div>
    <div style={{ display: 'flex', gap: '6px 16px', flexWrap: 'wrap', flex: 'none', font: 'var(--type-caption)', color: 'var(--text-muted)' }}><JudgmentTag kind="suggestion" uppercase={false}>Agent suggestion</JudgmentTag><JudgmentTag kind="decision" uppercase={false}>Decided by a person</JudgmentTag><JudgmentTag kind="gap" uppercase={false}>Needs evidence</JudgmentTag></div>
  </div>;
}
function ActiveScreen({ items, onItem, running, setRunning, approved, setApproved, notify }) {
  const [panel, setPanel] = React.useState(true);
  const [tab, setTab] = React.useState('preview');
  const [sheet, setSheet] = React.useState('items');
  const [text, setText] = React.useState('');
  const steps = [['done', 'Read the statement and ledger'], ['done', 'Match transactions', '14 of 18'], [running ? 'running' : 'done', 'Investigate reconciling items', running ? '3 done · 1 needs you' : ''], [running ? 'running' : 'done', 'Build the reconciliation workbook'], ['pending', 'Draft the review note'], ['pending', 'Check totals and cross-references']];
  const specs = [['git-compare', 'R1'], ['search', 'R2'], ['file-text', 'R3'], ['clock', 'R4']];
  return <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <Header title="Reconcile bank to ledger" crumbs="Meridian Freight · FY26 / Cash — September 2026">
      <Button variant="quiet" size="sm" icon="git-compare" onClick={() => { setPanel(true); setTab('changes'); }}>Changes 2</Button>
      <Button size="sm" icon="external-link" onClick={() => notify('Opened Reconciliation — Sep 2026.xlsx in Excel')}>Open in Excel</Button>
      <IconButton icon="panel-right" label="Toggle side panel" active={panel} onClick={() => setPanel(p => !p)} />
    </Header>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <section style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px 12px' }}>
          <div style={{ maxWidth: 'var(--thread-max-width)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: 'var(--surface-subtle)', borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, font: 'var(--type-body)' }}>Compare the bank statement with the cash ledger, investigate the differences, and prepare a reconciliation workbook and a short review note.<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><FileChip type="pdf" name="Bank statement Sep 2026.pdf" /><FileChip type="xls" name="Cash ledger Sep 2026.xlsx" /></div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-caption)', color: 'var(--text-muted)' }}><Avatar kind="agent" size={20} /><span style={{ font: '500 13px var(--font-sans)', color: 'var(--text-primary)' }}>Inquello</span><span>{running ? 'Working for 2m 48s · step 3 of 6' : 'Worked for 6m 05s · 6 steps · 4 specialists'}</span></div>
              <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>I'm following /CR-03 Cash reconciliation v3. The bank shows 4,750.00 and the ledger 4,600.00, a difference of 150.00. Four items explain it. None of them is a finding yet; each needs your call.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{steps.map(([s, l, m]) => <PlanStep key={l} state={s} label={l} meta={m} />)}</div>
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}><Over>Specialists · 4 in parallel</Over><span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)' }}>Click an item to review it</span></div>
                {items.map((it, i) => <div key={it.id} onClick={() => onItem(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', font: 'var(--type-ui)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <Icon name={specs[i][0]} size={14} color="var(--text-muted)" /><span style={{ font: '500 13px var(--font-sans)', whiteSpace: 'nowrap' }}>{it.who} · {it.id}</span><span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span><StatusChip status={it.status} decidedBy={it.decidedBy} /></div>)}
              </div>
              {approved ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', color: 'var(--text-muted)' }}><Icon name="send" size={14} />Request sent to Anna Kowalski through the client portal<StatusChip status="waiting" /></div>
                : <ApprovalCard context="Subsequent clearance · R4" quote="“Please upload the October 2026 statement for Nordbank ••4471 so we can confirm items clearing after 30 September.”" approveLabel="Send request" altLabel="Upload it myself" dismissLabel="Leave R4 open" note="Contacting the client always asks first" onApprove={() => { setApproved(true); notify('Request sent to Anna Kowalski through the client portal'); }}>The October statement isn't in this workspace, and I need it to confirm the Harbour Foods receipt cleared. May I ask Meridian for it through the client portal?</ApprovalCard>}
            </div>
          </div>
        </div>
        <div style={{ padding: '8px 24px 18px' }}><div style={{ maxWidth: 'var(--thread-max-width)', margin: '0 auto' }}><Composer value={text} setValue={setText} placeholder="Steer, ask a follow-up, or @ a file" running={running} onStop={() => { setRunning(false); notify('Paused after the current step'); }} onSend={() => { setText(''); setRunning(true); }} /></div></div>
      </section>
      {panel ? <aside style={{ width: 'clamp(340px, 44%, var(--panel-default-width))', flex: 'none', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 'var(--panel-tabs-height)', flex: 'none', display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--border-default)', gap: 6 }}><Tabs value={tab} onChange={setTab} tabs={[{ value: 'changes', label: 'Changes', count: 2 }, { value: 'preview', label: 'Preview' }, { value: 'summary', label: 'Summary' }]} /><div style={{ flex: 1 }} /><IconButton icon="maximize-2" label="Expand" size={26} onClick={() => onItem('R1')} /></div>
        {tab === 'preview' ? <Workbook sheet={sheet} setSheet={setSheet} items={items} onItem={onItem} />
          : tab === 'changes' ? <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}><div style={{ font: '500 13px var(--font-sans)' }}>Reconciliation — Sep 2026.xlsx <span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)' }}>draft copy · 2 changes</span></div><div style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}><DiffLine kind="add" gutter="A4">R1 · Duplicate bank entry · (500.00)</DiffLine><DiffLine kind="add" gutter="A7">R4 · Receipt not yet on statement · 700.00</DiffLine><DiffLine kind="context" gutter="B12">Unreconciled difference · 0.00</DiffLine></div><div style={{ display: 'flex', gap: 6 }}><Button variant="primary" onClick={() => notify('Kept · 2 changes saved to v3')}>Keep</Button><Button variant="ghost">Revert</Button></div></div>
          : <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, font: 'var(--type-ui)' }}><Over>Outstanding</Over><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><JudgmentTag kind="gap" />R4 needs the October statement</div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><JudgmentTag kind="suggestion" />R1 treatment waits for review</div><Over>Outputs</Over><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ display: 'flex', gap: 8 }}><FileChip type="xls" variant="tag" />Reconciliation — Sep 2026.xlsx</span><span style={{ display: 'flex', gap: 8 }}><FileChip type="doc" variant="tag" />Review note — Cash.docx</span></div></div>}
      </aside> : null}
    </div>
  </main>;
}
Object.assign(window, { Workbook, ActiveScreen });
