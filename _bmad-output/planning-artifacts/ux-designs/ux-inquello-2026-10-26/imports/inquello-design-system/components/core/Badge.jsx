import React from 'react';
const T = { attention: ['var(--amber-500)', 'var(--white)'], neutral: ['var(--ink-150)', 'var(--text-secondary)'], accent: ['var(--blue-600)', 'var(--white)'] };
export function Badge({ tone = 'attention', children }) {
  const [bg, fg] = T[tone] || T.attention;
  return React.createElement('span', { style: { font: '500 11px/16px var(--font-sans)', background: bg, color: fg, borderRadius: 8, padding: '0 6px', display: 'inline-block', minWidth: 4, textAlign: 'center' } }, children);
}
