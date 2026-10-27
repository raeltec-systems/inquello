import React from 'react';
import { Button } from '../core/Button.jsx';
export function ApprovalCard({ context, children, quote, approveLabel = 'Approve', altLabel, dismissLabel, onApprove, onAlt, onDismiss, note }) {
  return React.createElement('div', { style: { border: '1px solid var(--approval-border)', background: 'var(--approval-bg)', borderRadius: 'var(--radius-card)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 } },
    React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, React.createElement('span', { style: { font: 'var(--type-label)', letterSpacing: 'var(--tracking-label)', color: 'var(--amber-700)', textTransform: 'uppercase' } }, 'Approval needed'), context ? React.createElement('span', { style: { font: 'var(--type-caption)', color: 'var(--text-faint)' } }, context) : null),
    React.createElement('div', { style: { font: '400 13.5px/1.5 var(--font-sans)' } }, children),
    quote ? React.createElement('div', { style: { font: '400 12.5px/1.5 var(--font-sans)', color: 'var(--text-muted)', background: 'var(--white)', border: '1px solid #efe3c4', borderRadius: 'var(--radius-md)', padding: '8px 10px' } }, quote) : null,
    React.createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
      React.createElement(Button, { variant: 'primary', kbd: '⏎', onClick: onApprove }, approveLabel),
      altLabel ? React.createElement(Button, { onClick: onAlt }, altLabel) : null,
      dismissLabel ? React.createElement(Button, { variant: 'ghost', onClick: onDismiss }, dismissLabel) : null),
    note ? React.createElement('div', { style: { font: '400 11.5px var(--font-sans)', color: 'var(--text-faint)' } }, note) : null);
}
