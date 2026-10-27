import React from 'react';
const T = { blue: ['var(--blue-150)', 'var(--blue-600)'], green: ['#e6efe9', 'var(--green-600)'], amber: ['#efe9e1', '#8a5a2b'], decided: ['var(--green-600)', 'var(--white)'] };
export function Avatar({ kind = 'person', initials, tone = 'blue', size = 24, label }) {
  if (kind === 'agent') return React.createElement('img', { src: (window.INQUELLO_ASSET_BASE || '') + 'assets/logo/inquello-symbol.svg', alt: label || 'Inquello', style: { height: Math.round(size * 0.8), width: 'auto', display: 'block' } });
  const [bg, fg] = T[tone] || T.blue;
  return React.createElement('span', { title: label, style: { width: size, height: size, borderRadius: '50%', background: bg, color: fg, font: '600 ' + Math.round(size * 0.4) + 'px/' + size + 'px var(--font-sans)', textAlign: 'center', flex: 'none', display: 'inline-block' } }, initials);
}
