import React from 'react';
export function Switch({ checked, onChange, label }) {
  return React.createElement('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', font: 'var(--type-caption)', color: 'var(--text-secondary)' }, onClick: () => onChange && onChange(!checked) },
    React.createElement('span', { role: 'switch', 'aria-checked': !!checked, style: { width: 28, height: 16, borderRadius: 8, background: checked ? 'var(--blue-600)' : 'var(--ink-300)', position: 'relative', flex: 'none', transition: 'background var(--duration-fast)' } },
      React.createElement('span', { style: { position: 'absolute', top: 2, left: checked ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'var(--white)', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left var(--duration-fast) var(--ease-standard)' } })),
    label);
}
