import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { verifySelection, required } = require('../scripts/run-lifecycle-native.cjs') as {
  verifySelection: (output: string) => Set<string>; required: string[];
};
describe('native lifecycle acceptance selection', () => {
  it('rejects an empty or platform-gated test crate', () => {
    expect(() => verifySelection('0 tests, 0 benchmarks\n')).toThrow('not selected');
  });
  it('requires every maintained case on both provider bindings', () => {
    expect(required).toHaveLength(36);
    expect(() => verifySelection(required.slice(1).map(name => `${name}: test`).join('\n'))).toThrow(required[0]);
    expect(verifySelection(required.map(name => `${name}: test`).join('\r\n')).size).toBe(36);
  });
});
