/**
 * Sender trust for renderer operations (AD-5).
 *
 * A call is trusted only when all three hold: it comes from a `webContents`
 * main created and still tracks, from that contents' main frame, and from a
 * frame whose current URL is on the app origin. Identity alone would admit a
 * tracked window that navigated away; origin alone would admit an embedded or
 * foreign frame that happens to load app content.
 *
 * Pure: no Electron imports, so it is testable without a running app.
 */
import { isAppUrl } from './policy';

/** What main knows about the frame that sent an invoke. */
export interface SenderFrameInfo {
  /** `event.sender.id`. */
  webContentsId: number;
  /** True only when the sending frame is `event.sender.mainFrame`. */
  isMainFrame: boolean;
  /** `event.senderFrame.url`; empty when the frame is gone. */
  url: string;
}

export function isTrustedSender(frame: SenderFrameInfo, trustedWebContentsIds: ReadonlySet<number>): boolean {
  return trustedWebContentsIds.has(frame.webContentsId) && frame.isMainFrame && isAppUrl(frame.url);
}

/** Minimal frame shape shared by Electron's `WebFrameMain` and test fakes. */
export interface FrameLike {
  readonly url: string;
  readonly frameTreeNodeId: number;
  readonly parent: unknown;
}

/** Minimal invoke-event shape shared by Electron's `IpcMainInvokeEvent` and test fakes. */
export interface InvokeEventLike {
  readonly sender: { readonly id: number; readonly mainFrame: FrameLike };
  readonly senderFrame: FrameLike | null;
}

/** Describes an invoke event's sender for `isTrustedSender`. */
export function describeSender(event: InvokeEventLike): SenderFrameInfo {
  const frame = event.senderFrame;
  const main = event.sender.mainFrame;
  const isMainFrame =
    frame !== null && frame.parent === null && (frame === main || frame.frameTreeNodeId === main.frameTreeNodeId);
  return { webContentsId: event.sender.id, isMainFrame, url: frame?.url ?? '' };
}
