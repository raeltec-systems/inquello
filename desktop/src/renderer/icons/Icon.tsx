/**
 * `Icon`: one of the 40 Lucide outline icons, drawn with React elements.
 *
 * - Without `label` the icon is decorative: `aria-hidden="true"` and no role.
 * - With `label` it is informative: `role="img"` and `aria-label`.
 * - Defaults follow DESIGN.md `components.Icon`: 16px, 1.75 stroke,
 *   `currentColor`, 24×24 viewBox, round caps and joins.
 *
 * An unknown name is a type error; at runtime it renders nothing and warns
 * once per name.
 */
import { createElement, type CSSProperties, type ReactElement } from 'react';

import { icon as iconTokens } from '../design/tokens';
import { ICON_PATHS, type IconName } from './icon-paths';

export type { IconName } from './icon-paths';

export const ICON_DEFAULT_SIZE = Number.parseFloat(iconTokens.size);
export const ICON_DEFAULT_STROKE_WIDTH = Number.parseFloat(iconTokens.strokeWidth);

export interface IconProps {
  name: IconName;
  /** Pixel size: 16 by default, 14 in dense rows, 18 in the rail. */
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Accessible name. Omit only when the icon is decorative. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const warnedNames = new Set<string>();

export function Icon({
  name,
  size = ICON_DEFAULT_SIZE,
  strokeWidth = ICON_DEFAULT_STROKE_WIDTH,
  color = 'currentColor',
  label,
  className,
  style,
}: IconProps): ReactElement | null {
  const elements = Object.hasOwn(ICON_PATHS, name) ? ICON_PATHS[name] : undefined;
  if (!elements) {
    if (!warnedNames.has(name)) {
      warnedNames.add(name);
      console.warn(`Icon: unknown icon name ${JSON.stringify(name)}; nothing rendered.`);
    }
    return null;
  }
  const labelled = label !== undefined && label !== '';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className}
      style={{ display: 'block', flex: 'none', ...style }}
      {...(labelled ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {elements.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes }))}
    </svg>
  );
}
