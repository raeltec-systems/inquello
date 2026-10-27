import React from 'react';
const J = { calculation: ['ƒ', 'Calculation', 'var(--judgment-calculation)', true], observation: ['◦', 'Observation', 'var(--judgment-observation)', false], suggestion: ['', 'Suggestion', 'var(--judgment-suggestion)', false], decision: ['', 'Decision', 'var(--judgment-decision)', false], gap: ['–', 'Gap', 'var(--judgment-gap)', false] };
export function JudgmentTag({ kind = 'observation', children, uppercase = true }) {
  const [mark, label, color, mono] = J[kind] || J.observation;
  const glyph = kind === 'suggestion' ? React.createElement('span', { style: { width: 10, height: 8, border: '1px dashed var(--blue-600)', boxSizing: 'border-box' } }) : kind === 'decision' ? React.createElement('span', { style: { width: 9, height: 9, borderRadius: '50%', background: 'var(--green-600)' } }) : React.createElement('span', { style: { font: (mono ? '500 11px var(--font-mono)' : '600 12px var(--font-sans)') } }, mark);
  return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, color, font: uppercase ? '500 10px var(--font-mono)' : '400 11px var(--font-sans)', letterSpacing: uppercase ? '.03em' : 0, textTransform: uppercase ? 'uppercase' : 'none' } }, glyph, children || label);
}
