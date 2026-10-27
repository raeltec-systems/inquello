import React from 'react';
export function TextField({ multiline, rows = 2, value, onChange, placeholder, label, style }) {
  const base = { border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '7px 9px', font: 'var(--weight-regular) 12.5px/1.45 var(--font-sans)', outline: 'none', resize: 'vertical', background: 'var(--white)', width: '100%', boxSizing: 'border-box', ...style };
  const el = React.createElement(multiline ? 'textarea' : 'input', { value, onChange: e => onChange && onChange(e.target.value), placeholder, rows: multiline ? rows : undefined, style: base, onFocus: e => { e.target.style.boxShadow = 'var(--focus-ring)'; e.target.style.borderColor = 'var(--blue-600)'; }, onBlur: e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border-strong)'; } });
  if (!label) return el;
  return React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 4 } }, React.createElement('span', { style: { font: 'var(--type-caption)', color: 'var(--text-muted)' } }, label), el);
}
