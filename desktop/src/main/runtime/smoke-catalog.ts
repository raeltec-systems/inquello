import fs from 'node:fs';
import path from 'node:path';

/** Fixture-only: use a static bundled catalog rather than remote account discovery.
 * Recomputed for every runtime start; packaged and ordinary launches are unchanged.
 * Missing/invalid fixture data fails closed, never falls back to the network.
 */
export function smokeCatalogArgs(smoke: boolean, isPackaged: boolean, appPath: string): string[] {
  if (!smoke || isPackaged) return [];
  const catalog = path.resolve(appPath, '../engine/codex-rs/models-manager/models.json');
  const parsed: unknown = JSON.parse(fs.readFileSync(catalog, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as {models?: unknown}).models) || (parsed as {models: unknown[]}).models.length === 0) {
    throw new Error('Synthetic smoke requires the bundled static model catalog');
  }
  return ['-c', 'model_catalog_json=' + JSON.stringify(catalog)];
}
