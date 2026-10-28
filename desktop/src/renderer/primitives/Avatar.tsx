/**
 * `Avatar`: who a row, message or decision belongs to (DESIGN.md
 * `components.Avatar`).
 *
 * - A person is an initials disc. `name`, the full readable identity, is
 *   required and is the accessible name; the initials are supplementary and
 *   hidden from assistive technology.
 * - The agent is the Inquello symbol, never a face or disc. At a rendered
 *   symbol height of 20px or less (`size × components.Avatar.agentScale`) it
 *   uses the small symbol asset. The symbol image is decorative inside a
 *   labelled wrapper.
 * - `decided` is a visual treatment only (green disc, white initials). It
 *   requires the recorded identity of the decision, and it never announces or
 *   implies approval: the accessible name stays the person's name.
 */
import type { ReactElement } from 'react';

import symbolUrl from '../design/assets/logo/inquello-symbol.svg';
import smallSymbolUrl from '../design/assets/logo/inquello-symbol-small.svg';
import { components, spacing } from '../design/tokens';

/** Rendered sizes, each a DESIGN spacing token (20, 24 and 32px). */
export type AvatarSize = 20 | 24 | 32;
/**
 * Person tones. Each keeps the brand foreground of the source tone (blue-600,
 * green-600, amber-700) on the nearest approved pale palette colour that keeps
 * 4.5:1 text contrast.
 */
export type AvatarTone = 'blue' | 'green' | 'amber';

export const AVATAR_DEFAULT_SIZE = Number.parseFloat(components.Avatar.size) as AvatarSize;
export const AVATAR_AGENT_SCALE = Number.parseFloat(components.Avatar.agentScale);
/** DESIGN.md: select the small symbol asset at a rendered height of 20px or less. */
export const SMALL_SYMBOL_MAX_HEIGHT = Number.parseFloat(spacing['5']);
export const DEFAULT_AGENT_NAME = 'Inquello agent';

/** A recorded decision: who decided, as stored. A local decoration alone never proves one. */
export interface AvatarDecision {
  recordedIdentity: string;
}

interface CommonProps {
  size?: AvatarSize;
  className?: string;
}

export interface PersonAvatarProps extends CommonProps {
  kind?: 'person';
  /** The full readable identity; the accessible name. */
  name: string;
  /** Supplementary visible initials. */
  initials: string;
  tone?: AvatarTone;
  /** Shows the decided treatment; needs the recorded identity. Visual only. */
  decided?: AvatarDecision;
}

export interface AgentAvatarProps extends CommonProps {
  kind: 'agent';
  /** Accessible name; defaults to `DEFAULT_AGENT_NAME`. */
  name?: string;
}

export type AvatarProps = PersonAvatarProps | AgentAvatarProps;

/** Which symbol asset an agent avatar of this size uses. */
export function agentSymbolFor(size: AvatarSize): 'small' | 'regular' {
  return size * AVATAR_AGENT_SCALE <= SMALL_SYMBOL_MAX_HEIGHT ? 'small' : 'regular';
}

export function Avatar(props: AvatarProps): ReactElement {
  const size = props.size ?? AVATAR_DEFAULT_SIZE;
  if (props.kind === 'agent') {
    const symbol = agentSymbolFor(size);
    return (
      <span
        role="img"
        aria-label={props.name ?? DEFAULT_AGENT_NAME}
        className={['iq-avatar', 'iq-avatar--agent', `iq-avatar--${size}`, props.className].filter(Boolean).join(' ')}
        data-symbol={symbol}
      >
        <img className="iq-avatar-symbol" src={symbol === 'small' ? smallSymbolUrl : symbolUrl} alt="" aria-hidden="true" />
      </span>
    );
  }
  const { name, initials, tone = 'blue', decided, className } = props;
  const recorded = decided !== undefined && decided.recordedIdentity.trim() !== '';
  if (decided !== undefined && !recorded) {
    console.warn(`Avatar: "decided" for ${JSON.stringify(name)} has no recorded identity; the decided treatment is not shown.`);
  }
  const classes = ['iq-avatar', 'iq-avatar--person', `iq-avatar--${size}`, recorded ? 'iq-avatar--decided' : `iq-avatar--${tone}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span role="img" aria-label={name} className={classes}>
      <span className="iq-avatar-initials" aria-hidden="true">
        {initials}
      </span>
    </span>
  );
}
