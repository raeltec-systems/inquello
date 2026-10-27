import React from 'react';
import { Icon } from './Icon.jsx';
export function IconButton({ icon, label, variant = 'ghost', size = 28, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  const round = variant === 'send' || variant === 'stop';
  const bg = variant === 'send' || variant === 'stop' ? 'var(--action-primary-bg)' : active ? 'var(--action-quiet-bg)' : hover ? 'var(--surface-hover)' : variant === 'outline' ? 'var(--white)' : 'transparent';
  return React.createElement('button', { type: 'button', 'aria-label': label, title: label, onClick, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false),
    style: { width: size, height: size, borderRadius: round ? '50%' : 'var(--radius-md)', border: variant === 'outline' ? '1px solid var(--border-strong)' : '1px solid transparent', background: bg, color: round ? 'var(--white)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' } },
    variant === 'stop' ? React.createElement('span', { style: { width: 9, height: 9, background: 'var(--white)', borderRadius: 2 } }) : React.createElement(Icon, { name: variant === 'send' ? 'arrow-up' : icon, size: Math.round(size * 0.55) }));
}
