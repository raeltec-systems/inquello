import React from 'react';
export function Tabs({ tabs, value, onChange }) {
  return React.createElement('div', { role: 'tablist', style: { display: 'flex', gap: 2, alignItems: 'center' } },
    tabs.map(t => { const on = t.value === value; return React.createElement('button', { key: t.value, type: 'button', role: 'tab', 'aria-selected': on, onClick: () => onChange && onChange(t.value), style: { padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--action-quiet-bg)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-muted)', font: (on ? 500 : 400) + ' 12.5px/1.2 var(--font-sans)', cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' } }, t.label, t.count != null ? React.createElement('span', { style: { font: '400 11px var(--font-mono)', color: 'var(--text-faint)' } }, t.count) : null); }));
}
