const LOGO = '../../assets/logo/';
function NavRow({ icon, label, kbd, badge, on, onClick, indent = 0, muted }) {
  return <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', paddingLeft: 8 + indent, borderRadius: 6, cursor: 'pointer', background: on ? 'var(--surface-selected)' : 'transparent', font: 'var(--type-ui)', color: muted ? 'var(--text-muted)' : 'var(--text-primary)', minWidth: 0 }}
    onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--surface-hover)'; }} onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
    {icon ? <Icon name={icon} size={16} color="var(--text-secondary)" /> : null}
    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    {badge ? <Badge>{badge}</Badge> : null}
    {kbd ? <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-faint)' }}>{kbd}</span> : null}
  </div>;
}
function Sidebar({ screen, go, collapsed, setCollapsed, running }) {
  if (collapsed) return <aside style={{ width: 'var(--rail-width)', flex: 'none', background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 0 10px' }}>
    <img src={LOGO + 'inquello-symbol.svg'} alt="Inquello, expand sidebar" title="Expand sidebar" onClick={() => setCollapsed(false)} style={{ height: 23, marginBottom: 12, cursor: 'pointer' }} />
    <IconButton icon="plus" label="New thread" active={screen === 'start'} onClick={() => go('start')} />
    <IconButton icon="search" label="Search" />
    <IconButton icon="inbox" label="Inbox" active={screen === 'review'} onClick={() => go('review')} />
    <IconButton icon="zap" label="Automations" active={screen === 'automations'} onClick={() => go('automations')} />
    <div style={{ marginTop: 'auto' }}><Avatar initials="PR" size={26} label="Priya Raman" /></div>
  </aside>;
  return <aside style={{ width: 'var(--sidebar-width)', flex: 'none', background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 14, padding: 10, boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 0 8px' }}><img src={LOGO + 'inquello-lockup.svg'} alt="Inquello" style={{ height: 20, display: 'block' }} /><div style={{ flex: 1 }} /><IconButton icon="panel-left" label="Collapse sidebar" size={26} onClick={() => setCollapsed(true)} /></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <NavRow icon="plus" label="New thread" kbd="⌘N" on={screen === 'start'} onClick={() => go('start')} />
      <NavRow icon="search" label="Search" kbd="⌘K" />
      <NavRow icon="inbox" label="Inbox" badge="2" on={screen === 'review'} onClick={() => go('review')} />
      <NavRow icon="zap" label="Automations" on={screen === 'automations'} onClick={() => go('automations')} />
      <NavRow icon="layers" label="Skills & procedures" />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--tracking-label)', color: 'var(--text-faint)', textTransform: 'uppercase', padding: '0 8px 6px' }}>Workspaces</span>
      <NavRow icon="folder" label="Meridian Freight · FY26" />
      <NavRow label="Cash — September 2026" indent={26} muted />
      <NavRow label={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{running ? <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--blue-600)', borderRightColor: 'transparent', animation: 'iq-spin var(--spin-duration) linear infinite', flex: 'none' }} /> : null}Reconcile bank to ledger</span>} indent={38} on={screen === 'active'} onClick={() => go('active')} />
      <NavRow label="Revenue cut-off testing" indent={38} muted />
      <NavRow icon="folder" label="Kijani Microfinance" />
    </div>
    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '8px' }}>
      <Avatar initials="PR" size={28} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ font: '500 13px/1.3 var(--font-sans)' }}>Priya Raman</span><span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Northgate Assurance</span></div>
      <IconButton icon="settings" label="Settings" size={26} />
    </div>
  </aside>;
}
function Header({ title, crumbs, children }) {
  return <header style={{ height: 'var(--header-height)', flex: 'none', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 18px', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 }}>
      <span style={{ font: 'var(--type-title)', whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumbs}</span>
    </div>{children}
  </header>;
}
function Composer({ value, setValue, files, onRemove, onSend, running, onStop, placeholder }) {
  return <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-composer)', boxShadow: 'var(--shadow-composer)', background: '#fff', padding: '10px 10px 8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    {files && files.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{files.map(f => <FileChip key={f.name} type={f.type} name={f.name} onRemove={onRemove ? () => onRemove(f.name) : undefined} />)}</div> : null}
    <textarea value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} rows={2} style={{ border: 'none', outline: 'none', resize: 'none', font: 'var(--type-body)', padding: 0, background: 'transparent' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <IconButton icon="paperclip" label="Add files" size={26} />
        <Button variant="ghost" size="sm" icon="folder" truncate style={{ flex: '0 1 auto', minWidth: 0 }}>Meridian Freight</Button>
        <Button variant="ghost" size="sm" icon="shield-check" truncate style={{ flex: '0 1 auto', minWidth: 0 }}>Draft copy</Button>
        <Button variant="ghost" size="sm" truncate style={{ flex: '0 1 auto', minWidth: 0 }}>Thorough</Button>
      </div>
      {running ? <IconButton variant="stop" label="Stop (Esc)" size={30} onClick={onStop} /> : <IconButton variant="send" label="Send" size={30} onClick={onSend} />}
    </div>
  </div>;
}
const Over = ({ children, color }) => <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--tracking-label)', color: color || 'var(--text-faint)', textTransform: 'uppercase' }}>{children}</span>;
Object.assign(window, { NavRow, Sidebar, Header, Composer, Over, LOGO });
