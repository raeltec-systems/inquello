// Regression: a large attached file made `validateTransfer` throw "Maximum call
// stack size exceeded" (its base64 check was a regular expression), so Task start
// refused the material. Found by the owner on 2026-11-12 with a real CSV.
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateTransfer, type Entry } from '../src/main/runtime/wsl-tasks';

function file(path: string, data: Buffer): Entry {
  return { path, kind: 'file', data: data.toString('base64'), sha256: crypto.createHash('sha256').update(data).digest('hex') } as Entry;
}

describe('transfer validation of large files', () => {
  it('accepts a 24 MiB file', () => {
    const data = Buffer.alloc(24 * 1024 ** 2, 'invoice,amount,date\n');
    expect(() => validateTransfer([{ path: 'attached', kind: 'directory' } as Entry, file('attached/large.csv', data)])).not.toThrow();
  });

  it('still refuses data that is not canonical base64', () => {
    const good = file('a.csv', Buffer.from('a,b\n1,2\n')) as Entry & { data: string };
    for (const data of [good.data + '=', good.data.slice(1), good.data.replace(/.$/, '!'), 'YQ', 'Y Q==']) {
      expect(() => validateTransfer([{ ...good, data } as Entry])).toThrow(/Invalid transfer encoding|digest/);
    }
  });

  it('still refuses a digest mismatch', () => {
    const entry = file('a.csv', Buffer.from('a,b\n1,2\n'));
    expect(() => validateTransfer([{ ...entry, sha256: '0'.repeat(64) } as Entry])).toThrow(/digest/);
  });
});
