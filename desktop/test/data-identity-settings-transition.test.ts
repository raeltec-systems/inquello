/** Actual data-service identity callbacks, isolated from Electron startup. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

function callbacks(signOut: () => Promise<{ok: boolean}>, forgetLocally: () => void) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/main/main.ts'), 'utf8');
  const anchor = source.indexOf('holdsSession: () => identitySession.holdsSession(),');
  if (anchor < 0) throw new Error('Data identity callbacks missing');
  const body = source.slice(anchor, source.indexOf('    providers: {', anchor));
  const signOutSource = body.match(/signOut: (async \(\) => \{[^\r\n]+\}),/)?.[1];
  const forgetSource = body.match(/forgetLocally: (\(\) => \{[^\r\n]+\}),/)?.[1];
  if (!signOutSource || !forgetSource) throw new Error('Data identity callback transition wrappers missing');
  const settled = vi.fn();
  const begin = vi.fn(() => settled);
  const api = new Function('identitySession', 'beginSettingsTransition', `return {signOut:${signOutSource},forgetLocally:${forgetSource}}`)({signOut,forgetLocally}, begin) as {signOut():Promise<{ok:boolean}>;forgetLocally():void};
  return {api,begin,settled};
}

describe('data deletion identity settings transitions', () => {
  it('clears settings before remote revocation and settles only when it completes', async () => {
    let release!: (value:{ok:boolean}) => void;
    const deferred = new Promise<{ok:boolean}>(resolve => {release=resolve;});
    const h = callbacks(() => deferred, () => {});
    const pending = h.api.signOut();
    expect(h.begin).toHaveBeenCalledOnce();
    expect(h.settled).not.toHaveBeenCalled();
    release({ok:true});
    expect(await pending).toEqual({ok:true});
    expect(h.settled).toHaveBeenCalledOnce();
  });
  it('settles failed revocation without masking its rejection', async () => {
    const failure = new Error('synthetic revocation failure');
    const h = callbacks(async () => {throw failure;}, () => {});
    await expect(h.api.signOut()).rejects.toBe(failure);
    expect(h.begin).toHaveBeenCalledOnce();
    expect(h.settled).toHaveBeenCalledOnce();
  });
  it.each([false,true])('fences local forgetting including failure=%s', fail => {
    const failure = new Error('synthetic local failure');
    const h = callbacks(async () => ({ok:true}), () => {
      expect(h.begin).toHaveBeenCalledOnce();
      expect(h.settled).not.toHaveBeenCalled();
      if(fail)throw failure;
    });
    if(fail)expect(() => h.api.forgetLocally()).toThrow(failure);
    else h.api.forgetLocally();
    expect(h.settled).toHaveBeenCalledOnce();
  });
});
