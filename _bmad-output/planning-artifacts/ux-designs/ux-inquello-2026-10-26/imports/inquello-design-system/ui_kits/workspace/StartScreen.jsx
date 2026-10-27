function StartScreen({ onStart }) {
  const [text, setText] = React.useState('Compare the bank statement with the cash ledger, investigate the differences, and prepare a reconciliation workbook and a short review note.');
  const [files, setFiles] = React.useState([{ type: 'pdf', name: 'Bank statement Sep 2026.pdf' }, { type: 'xls', name: 'Cash ledger Sep 2026.xlsx' }]);
  const [proc, setProc] = React.useState(true);
  const pool = [{ type: 'xls', name: 'Sales ledger extract Sep 2026.xlsx' }, { type: 'doc', name: 'Prior year review note — Cash.docx' }, { type: 'pdf', name: 'Nordbank confirmation 2025.pdf' }];
  const add = f => setFiles(fs => fs.some(x => x.name === f.name) ? fs : [...fs, f]);
  return <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <Header title="New thread" crumbs="Meridian Freight · FY26" />
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '72px 24px 48px' }}>
      <div style={{ width: '100%', maxWidth: 'var(--thread-max-width)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 6 }}><img src={LOGO + 'inquello-symbol.svg'} alt="" style={{ height: 40 }} /><span style={{ font: 'var(--type-display)', letterSpacing: 'var(--tracking-display)', textAlign: 'center', textWrap: 'balance' }}>What should we work on?</span></div>
        <Composer value={text} setValue={setText} files={files} onRemove={n => setFiles(fs => fs.filter(f => f.name !== n))} onSend={onStart} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
          <Icon name="list-checks" color="var(--text-secondary)" />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ font: '500 12.5px var(--font-mono)' }}>/CR-03 Cash reconciliation v3</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Steps 1–6 · match on amount, dates within 3 days, reference where present</span></div>
          <Switch checked={proc} onChange={setProc} label={proc ? 'Applied' : 'Not applied'} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Over>From this workspace</Over>
          {pool.map(f => <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', font: 'var(--type-ui)' }}><FileChip type={f.type} variant="tag" /><span style={{ flex: 1 }}>{f.name}</span><Button variant="ghost" size="sm" icon={files.some(x => x.name === f.name) ? 'check' : 'plus'} onClick={() => add(f)}>{files.some(x => x.name === f.name) ? 'Added' : 'Add'}</Button></div>)}
        </div>
      </div>
    </div>
  </main>;
}
Object.assign(window, { StartScreen });
