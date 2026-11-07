/**
 * The system browser: the only module allowed to use Electron `shell`.
 *
 * Sign-in opens the issuer's authorization URL in the user's default browser
 * through `shell.openExternal`; there is no embedded login window. Only
 * `https:` URLs are opened. Tests and the smoke run inject another
 * `BrowserOpener` instead.
 */
import { shell } from 'electron';

/** Opens an authorization URL; resolves once the hand-off happened. */
export type BrowserOpener = (url: string) => Promise<void>;

export const openSystemBrowser: BrowserOpener = async (url) => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('only https URLs are opened in the system browser');
  await shell.openExternal(parsed.toString(), { activate: true });
};
