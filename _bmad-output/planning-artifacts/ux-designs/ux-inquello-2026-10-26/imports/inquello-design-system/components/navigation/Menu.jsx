import React from 'react';
export function Menu({ heading, items, width = 300 }) {
  return React.createElement('div', { role: 'menu', style: { width, background: 'var(--white)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-popover)', padding: 5, display: 'flex', flexDirection: 'column', gap: 1, boxSizing: 'border-box' } },
    heading ? React.createElement('div', { style: { padding: '6px 9px', font: 'var(--type-caption)', color: 'var(--text-faint)' } }, heading) : null,
    items.map((it, i) => React.createElement('div', { key: i, role: 'menuitem', onClick: it.onSelect, style: { display: 'flex', gap: 10, padding: '7px 9px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }, onMouseEnter: e => e.currentTarget.style.background = '#f3f5f8', onMouseLeave: e => e.currentTarget.style.background = 'transparent' },
      React.createElement('span', { style: { width: 12, color: 'var(--blue-600)', font: '12px var(--font-sans)' } }, it.checked ? '✓' : ''),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } }, React.createElement('span', { style: { font: '500 13px/1.4 var(--font-sans)', color: 'var(--text-primary)' } }, it.label), it.description ? React.createElement('span', { style: { font: 'var(--type-caption)', color: 'var(--text-muted)' } }, it.description) : null))));
}
