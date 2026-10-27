import React from 'react';
export function SegmentedControl({ options, value, onChange }) {
  return React.createElement('div', { role: 'tablist', style: { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--white)', font: 'var(--type-caption)', flex: 'none' } },
    options.map(o => { const on = o.value === value; return React.createElement('button', { key: o.value, type: 'button', role: 'tab', 'aria-selected': on, onClick: () => onChange && onChange(o.value), style: { padding: '4px 9px', border: 'none', background: on ? 'var(--ink-900)' : 'transparent', color: on ? 'var(--white)' : 'var(--text-muted)', fontWeight: on ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap', font: 'inherit' } }, o.label); }));
}
