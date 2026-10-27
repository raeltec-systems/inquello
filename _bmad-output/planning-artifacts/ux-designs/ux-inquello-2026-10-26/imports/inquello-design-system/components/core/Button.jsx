import React from 'react';
import { Icon } from './Icon.jsx';
const V = {
  primary: { background: 'var(--action-primary-bg)', color: 'var(--action-primary-fg)', border: '1px solid var(--action-primary-bg)' },
  secondary: { background: 'var(--action-secondary-bg)', color: 'var(--text-primary)', border: '1px solid var(--action-secondary-border)' },
  quiet: { background: 'var(--action-quiet-bg)', color: 'var(--text-primary)', border: '1px solid transparent' },
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' },
};
const HOVER = { primary: 'var(--action-primary-bg-hover)', secondary: 'var(--ink-75)', quiet: 'var(--surface-hover)', ghost: 'var(--ink-75)' };
const H = { sm: 'var(--control-sm)', md: 'var(--control-md)', lg: 'var(--control-lg)' };
export function Button({ variant = 'secondary', size = 'md', icon, kbd, disabled, truncate, onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  const v = V[variant] || V.secondary;
  return React.createElement('button', { type: 'button', disabled, onClick, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false),
    style: { ...v, background: hover && !disabled ? HOVER[variant] : v.background, height: H[size], padding: size === 'lg' ? '0 14px' : '0 10px', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--weight-medium) ' + (size === 'lg' ? '13px' : '12.5px') + '/1 var(--font-sans)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap', flex: 'none', transition: 'background var(--duration-fast) var(--ease-standard)', ...style } },
    icon ? React.createElement(Icon, { name: icon, size: 14 }) : null, truncate ? React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } }, children) : children,
    kbd ? React.createElement('span', { style: { font: '400 10.5px var(--font-mono)', opacity: 0.6 } }, kbd) : null);
}
