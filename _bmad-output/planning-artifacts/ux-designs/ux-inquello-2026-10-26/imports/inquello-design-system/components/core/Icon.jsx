import React from 'react';
import { ICONS } from './icon-paths.js';
export function Icon({ name, size = 16, strokeWidth = 1.75, color = 'currentColor', title, style }) {
  const inner = ICONS[name] || '';
  return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', role: title ? 'img' : 'presentation', 'aria-label': title, 'aria-hidden': title ? undefined : true, style: { display: 'block', flex: 'none', ...style }, dangerouslySetInnerHTML: { __html: inner } });
}
