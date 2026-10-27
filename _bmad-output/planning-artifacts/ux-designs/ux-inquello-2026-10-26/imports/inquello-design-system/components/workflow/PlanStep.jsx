import React from 'react';
export function PlanStep({ state = 'pending', label, meta }) {
  const box = state === 'done' ? { background: 'var(--green-600)', border: 'none' } : state === 'running' ? { background: 'var(--blue-150)', border: '1.5px solid var(--blue-600)' } : { background: 'var(--white)', border: '1.5px solid var(--ink-300)' };
  return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, font: 'var(--type-ui)', color: state === 'done' ? 'var(--text-faint)' : 'var(--text-primary)', fontWeight: state === 'running' ? 500 : 400 } },
    React.createElement('span', { style: { width: 14, height: 14, borderRadius: 4, boxSizing: 'border-box', flex: 'none', color: 'var(--white)', fontSize: 9, lineHeight: '14px', textAlign: 'center', ...box } }, state === 'done' ? '✓' : ''),
    React.createElement('span', { style: { flex: 1 } }, label), meta ? React.createElement('span', { style: { font: '400 11.5px var(--font-sans)', color: 'var(--text-faint)', whiteSpace: 'nowrap' } }, meta) : null);
}
