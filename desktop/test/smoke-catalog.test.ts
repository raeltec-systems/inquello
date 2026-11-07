import fs from 'node:fs';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {smokeCatalogArgs} from '../src/main/runtime/smoke-catalog';

afterEach(() => vi.restoreAllMocks());
describe('synthetic smoke static model discovery', () => {
  it('does not alter ordinary or packaged runtime arguments', () => {
    const read = vi.spyOn(fs, 'readFileSync');
    expect(smokeCatalogArgs(false, false, '/fixture/desktop')).toEqual([]);
    expect(smokeCatalogArgs(true, true, '/fixture/desktop')).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
  it('uses the supported static catalog override on every fixture start', () => {
    const bundled = fs.readFileSync(path.resolve(import.meta.dirname, '../../engine/codex-rs/models-manager/models.json'), 'utf8');
    const read = vi.spyOn(fs, 'readFileSync').mockReturnValue(bundled);
    const appPath = path.resolve('fixture with spaces', 'desktop');
    const catalog = path.resolve(appPath, '../engine/codex-rs/models-manager/models.json');
    const expected = ['-c', 'model_catalog_json=' + JSON.stringify(catalog)];
    expect(smokeCatalogArgs(true, false, appPath)).toEqual(expected);
    expect(smokeCatalogArgs(true, false, appPath)).toEqual(expected);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledWith(catalog, 'utf8');
  });
  it('refuses missing fixture data rather than enabling remote discovery', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('missing fixture'); });
    expect(() => smokeCatalogArgs(true, false, '/fixture/desktop')).toThrow();
  });
  it('refuses malformed or wrong-shape catalogs', () => {
    const read = vi.spyOn(fs, 'readFileSync');
    for (const value of ['invalid', 'null', '{}', '{"models":{}}', '{"models":[]}']) {
      read.mockReturnValue(value);
      expect(() => smokeCatalogArgs(true, false, '/fixture/desktop')).toThrow();
    }
  });
});
