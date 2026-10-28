/**
 * Reimport: restores an export's included categories.
 *
 * - The manifest is read strictly. Every file it lists must belong, under the
 *   current register, to the category it is listed under, and that category
 *   must be enabled, exported and free of credentials. Nothing else can be
 *   written, so an export cannot plant a file in another category.
 * - Every digest is verified before anything is written; one mismatch refuses
 *   the whole import.
 * - The runtime home must be empty: it may hold no file of a category the
 *   export restores there, and no unclassified file. Rebuildable runtime state
 *   and runtime logs, which the runtime writes on every start, do not count.
 * - Nothing is overwritten. A file whose target already exists, or that could
 *   not be copied intact, is listed as not restored.
 *
 * The caller (main) runs this only while no Task runs and with the runtime
 * stopped, then restarts the runtime.
 */
import fs from 'node:fs';
import path from 'node:path';

import { copyWithDigest, digestFile, exportedFilePath, MANIFEST_FILE, MANIFEST_FORMAT, type ExportManifest, type ManifestFile, type ManifestOmission } from './export';
import { takeInventory, type GovernedRoots } from './inventory';
import { categoryById, classify, DATA_ROOTS, type DataPolicy, type DataRoot } from './policy';

export class ImportError extends Error {
  override name = 'ImportError';
}

export interface ImportOptions {
  policy: DataPolicy;
  roots: GovernedRoots;
  /** The export directory the user chose. */
  source: string;
}

export interface ImportResult {
  restored: Array<{ category: string; label: string; files: number }>;
  notRestored: Array<{ category: string; path: string; reason: string }>;
  /** What the export itself omitted, as its manifest declares. */
  omissions: ManifestOmission[];
  createdAt: string;
}

const SHA256 = /^[0-9a-f]{64}$/;

function bad(message: string): never {
  throw new ImportError(`the export manifest is not valid: ${message}`);
}

function safeRel(rel: unknown): string {
  if (typeof rel !== 'string' || rel === '' || rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) bad(`unsafe path ${JSON.stringify(rel)}`);
  if (rel.split('/').some((part) => part === '' || part === '.' || part === '..')) bad(`unsafe path ${JSON.stringify(rel)}`);
  if (/^[A-Za-z]:/.test(rel)) bad(`unsafe path ${JSON.stringify(rel)}`);
  return rel;
}

/** Reads and checks the manifest's shape. */
export function readManifest(source: string): ExportManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(source, MANIFEST_FILE), 'utf8'));
  } catch {
    throw new ImportError('the chosen folder holds no readable Inquello export manifest');
  }
  if (typeof raw !== 'object' || raw === null) bad('not an object');
  const manifest = raw as Record<string, unknown>;
  if (manifest.format !== MANIFEST_FORMAT || manifest.version !== 1) bad('unknown format or version');
  if (typeof manifest.createdAt !== 'string' || !Array.isArray(manifest.included) || !Array.isArray(manifest.omissions)) bad('missing fields');
  const seen = new Set<string>();
  for (const entry of manifest.included as unknown[]) {
    if (typeof entry !== 'object' || entry === null) bad('included entry is not an object');
    const { category, label, files } = entry as Record<string, unknown>;
    if (typeof category !== 'string' || typeof label !== 'string' || !Array.isArray(files)) bad('included entry is incomplete');
    for (const file of files as unknown[]) {
      if (typeof file !== 'object' || file === null) bad('file entry is not an object');
      const { root, path: rel, size, sha256 } = file as Record<string, unknown>;
      if (typeof root !== 'string' || !(DATA_ROOTS as readonly string[]).includes(root)) bad(`unknown root ${JSON.stringify(root)}`);
      safeRel(rel);
      if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) bad('file size is not valid');
      if (typeof sha256 !== 'string' || !SHA256.test(sha256)) bad('file digest is not valid');
      const key = `${root}:${rel as string}`;
      if (seen.has(key)) bad(`duplicate file ${key}`);
      seen.add(key);
    }
  }
  for (const omission of manifest.omissions as unknown[]) {
    if (typeof omission !== 'object' || omission === null) bad('omission is not an object');
    const { category, label, reason, files } = omission as Record<string, unknown>;
    if ((category !== null && typeof category !== 'string') || typeof label !== 'string' || typeof reason !== 'string' || typeof files !== 'number') bad('omission is incomplete');
  }
  return raw as ExportManifest;
}

export async function importData(options: ImportOptions): Promise<ImportResult> {
  const { policy, roots } = options;
  const source = path.resolve(options.source);
  const manifest = readManifest(source);

  // 1. Every listed file must belong to an importable category under this register.
  for (const entry of manifest.included) {
    const category = categoryById(policy, entry.category);
    if (!category || !category.enabled || category.credentials || category.export.mode !== 'included') {
      throw new ImportError(`the export includes ${JSON.stringify(entry.category)}, which this data policy does not allow importing`);
    }
    for (const file of entry.files) {
      if (classify(policy, file.root, file.path)?.id !== category.id) {
        throw new ImportError(`${file.root}:${file.path} does not belong to ${category.label} under this data policy`);
      }
    }
  }

  // 2. Verify every digest before writing anything.
  for (const entry of manifest.included) {
    for (const file of entry.files) {
      let actual: { size: number; sha256: string };
      try {
        actual = await digestFile(exportedFilePath(source, file.root, file.path));
      } catch {
        throw new ImportError(`${file.root}:${file.path} is missing from the export`);
      }
      if (actual.sha256 !== file.sha256 || actual.size !== file.size) {
        throw new ImportError(`${file.root}:${file.path} does not match its digest; the export was changed or damaged`);
      }
    }
  }

  // 3. The runtime home must be empty of anything the import restores, and of unclassified files.
  const restoring = new Set(manifest.included.filter((entry) => entry.files.some((file) => file.root === 'runtime-home')).map((entry) => entry.category));
  const inventory = takeInventory(policy, roots);
  const occupied = inventory.files.filter((file) => file.root === 'runtime-home' && (file.category === null || restoring.has(file.category)));
  if (occupied.length > 0) {
    throw new ImportError(`the runtime home already holds data (${occupied.length} file(s), for example ${occupied[0]!.rel}); import restores only into an empty runtime home`);
  }

  // 4. Restore without overwriting.
  const restored: ImportResult['restored'] = [];
  const notRestored: ImportResult['notRestored'] = [];
  for (const entry of manifest.included) {
    let count = 0;
    for (const file of entry.files) {
      const outcome = await restoreFile(source, roots, file);
      if (outcome === null) count += 1;
      else notRestored.push({ category: entry.category, path: `${file.root}:${file.path}`, reason: outcome });
    }
    restored.push({ category: entry.category, label: entry.label, files: count });
  }
  return { restored, notRestored, omissions: manifest.omissions, createdAt: manifest.createdAt };
}

/** Restores one file; returns null on success or the reason it was not restored. */
async function restoreFile(source: string, roots: GovernedRoots, file: ManifestFile): Promise<string | null> {
  const rootDir = path.resolve(roots[file.root as DataRoot]);
  const target = path.join(rootDir, ...file.path.split('/'));
  if (fs.existsSync(target)) return 'A file already exists there; it was not overwritten';
  const temp = `${target}.import-${process.pid}.tmp`;
  try {
    const copied = await copyWithDigest(exportedFilePath(source, file.root, file.path), temp);
    if (copied.sha256 !== file.sha256 || copied.size !== file.size) {
      fs.rmSync(temp, { force: true });
      return 'The copy did not match its digest';
    }
    if (fs.existsSync(target)) {
      fs.rmSync(temp, { force: true });
      return 'A file already exists there; it was not overwritten';
    }
    fs.renameSync(temp, target);
    return null;
  } catch (error) {
    fs.rmSync(temp, { force: true });
    return `It could not be written (${(error as NodeJS.ErrnoException).code ?? 'error'})`;
  }
}
