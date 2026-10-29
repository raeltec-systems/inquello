/**
 * The Shell's layout modes (Story 1.16), decided by window width alone.
 *
 * - **full**: the 264px Sidebar, a readable thread and (when open) the 380px
 *   artifact area fit side by side.
 * - **rail**: the Sidebar does not fit, so navigation collapses to the 52px
 *   rail; the thread (and the open artifact, when it still fits) keep their
 *   width.
 * - **single**: the thread and the 380px artifact area do not fit beside the
 *   rail. One work area shows at a time, with an explicit
 *   Conversation/Artifact switch. Only an open artifact can lead here.
 *
 * Widths come from the DESIGN spacing tokens. DESIGN.md (AS-UX2) leaves exact
 * thresholds to downstream design, so the narrowest readable thread is a
 * layout constant here, not a design token. The window minimum is the rail plus
 * that readable thread, so every mode fits without horizontal page overflow.
 */
import { spacing } from '../design/tokens';

const px = (value: string): number => Number.parseFloat(value);

export const SIDEBAR_WIDTH = px(spacing['sidebar-width']);
export const RAIL_WIDTH = px(spacing['rail-width']);
export const HEADER_HEIGHT = px(spacing['header-height']);
export const THREAD_MAX_WIDTH = px(spacing['thread-max-width']);
export const ARTIFACT_MIN_WIDTH = px(spacing['panel-min-width']);
/** The narrowest thread column that still reads as a conversation (thread padding included). */
export const THREAD_MIN_WIDTH = 480;
/** The window's minimum content width: the rail beside a readable thread. */
export const WINDOW_MIN_WIDTH = RAIL_WIDTH + THREAD_MIN_WIDTH;

export type LayoutMode = 'full' | 'rail' | 'single';

/** The width the work area (thread, plus the artifact when open) needs. */
export function workWidth(artifactOpen: boolean): number {
  return THREAD_MIN_WIDTH + (artifactOpen ? ARTIFACT_MIN_WIDTH : 0);
}

/** Whether the thread and the artifact area fit side by side beside the rail at this width. */
export function artifactFits(width: number): boolean {
  return width >= RAIL_WIDTH + workWidth(true);
}

/** The layout mode for a window content width; recalculated on every resize. */
export function layoutMode(width: number, artifactOpen: boolean): LayoutMode {
  if (width >= SIDEBAR_WIDTH + workWidth(artifactOpen)) return 'full';
  if (!artifactOpen || artifactFits(width)) return 'rail';
  return 'single';
}
