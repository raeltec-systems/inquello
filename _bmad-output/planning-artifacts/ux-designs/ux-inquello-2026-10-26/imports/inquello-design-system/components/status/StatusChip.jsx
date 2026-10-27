import React from 'react';
const S = {
  suggested: ['Suggested', 'var(--white)', 'var(--status-suggested-fg)', '1px dashed var(--status-suggested-border)'],
  investigating: ['Investigating', 'var(--status-investigating-bg)', 'var(--status-investigating-fg)', '1px solid var(--status-investigating-bg)'],
  open: ['Open', 'var(--white)', 'var(--status-open-fg)', '1px solid var(--status-open-border)'],
  evidence: ['Needs evidence', 'var(--status-evidence-bg)', 'var(--status-evidence-fg)', '1px solid var(--status-evidence-border)'],
  waiting: ['Awaiting client', 'var(--white)', 'var(--status-evidence-fg)', '1px solid var(--status-evidence-border)'],
  accepted: ['Accepted', 'var(--status-accepted-bg)', 'var(--status-accepted-fg)', '1px solid var(--status-accepted-border)'],
  explained: ['Explained', 'var(--status-accepted-bg)', 'var(--status-accepted-fg)', '1px solid var(--status-accepted-border)'],
};
export function StatusChip({ status = 'open', decidedBy, children }) {
  const [label, bg, fg, bd] = S[status] || S.open;
  return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
    React.createElement('span', { style: { font: '400 11px/1.4 var(--font-sans)', padding: '1px 6px', borderRadius: 'var(--radius-chip)', background: bg, color: fg, border: bd, whiteSpace: 'nowrap' } }, children || label),
    decidedBy ? React.createElement('span', { title: 'Decided by a person', style: { width: 16, height: 16, borderRadius: '50%', background: 'var(--green-600)', color: 'var(--white)', font: '600 8px/16px var(--font-sans)', textAlign: 'center' } }, decidedBy) : null);
}
