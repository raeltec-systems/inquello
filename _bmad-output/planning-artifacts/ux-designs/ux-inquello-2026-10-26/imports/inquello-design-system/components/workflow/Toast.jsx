import React from 'react';
export function Toast({ children, visible = true }) {
  if (!visible) return null;
  return React.createElement('div', { role: 'status', style: { display: 'inline-block', alignSelf: 'flex-start', background: 'var(--ink-900)', color: 'var(--white)', padding: '8px 14px', borderRadius: 'var(--radius-md)', font: '400 12.5px/1.4 var(--font-sans)', boxShadow: 'var(--shadow-toast)', whiteSpace: 'nowrap' } }, children);
}
