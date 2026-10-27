import React from 'react';
const K = { add: ['+', 'var(--diff-add-bg)', 'var(--diff-add-fg)'], del: ['−', 'var(--diff-del-bg)', 'var(--diff-del-fg)'], change: ['~', 'var(--blue-50)', 'var(--text-primary)'], context: [' ', 'var(--white)', 'var(--text-secondary)'] };
export function DiffLine({ kind = 'add', gutter, children }) {
  const [sign, bg, fg] = K[kind] || K.context;
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: (gutter != null ? '40px ' : '') + '14px minmax(0,1fr)', alignItems: 'baseline', padding: '5px 10px 5px 0', background: bg, color: fg, font: '400 12.5px/1.5 var(--font-sans)' } },
    gutter != null ? React.createElement('span', { style: { font: '400 11px var(--font-mono)', color: 'var(--text-faint)', textAlign: 'right', paddingRight: 6 } }, gutter) : null,
    React.createElement('span', { style: { font: '500 12px var(--font-mono)', paddingLeft: gutter != null ? 0 : 10 } }, sign),
    React.createElement('span', { style: { minWidth: 0 } }, children));
}
