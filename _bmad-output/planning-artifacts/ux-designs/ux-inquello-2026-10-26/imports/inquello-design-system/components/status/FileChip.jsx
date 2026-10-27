import React from 'react';
const T = { pdf: ['PDF', 'var(--file-pdf)'], xls: ['XLS', 'var(--file-xls)'], doc: ['DOC', 'var(--file-doc)'], folder: ['DIR', 'var(--file-folder)'] };
export function FileChip({ type = 'xls', name, onRemove, variant = 'chip' }) {
  const [ext, color] = T[type] || T.xls;
  const tag = React.createElement('span', { style: { font: '500 9px/1 var(--font-mono)', color } }, ext);
  if (variant === 'tag') return tag;
  return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, font: '400 12px/1.4 var(--font-sans)', padding: onRemove ? '2px 4px 2px 8px' : '2px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--ink-50)', color: 'var(--text-primary)', whiteSpace: 'nowrap' } },
    tag, name, onRemove ? React.createElement('span', { role: 'button', 'aria-label': 'Remove ' + name, onClick: onRemove, style: { cursor: 'pointer', color: 'var(--text-faint)', padding: '0 4px' } }, '×') : null);
}
