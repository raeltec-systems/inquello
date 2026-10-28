/**
 * Export: a plain directory (no archive) holding a copy of every category the
 * register marks `included`, plus `manifest.json`.
 *
 * The manifest names the included categories with a SHA-256 and size for
 * every file, the explicit omissions with their reasons (excluded categories,
 * and any unclassified file), the attribution (the principal's display name
 * and issuer label when signed in, the app and runtime versions) and the fixed
 * notice that an export transfers no permissions and is not an accepted audit
 * record. A category that holds credentials can never be `included` (the
 * register refuses it), so credentials never leave.
 *
 * Every export is recorded in the export journal. Any write failure removes
 * the partial export and leaves the journal unchanged.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { takeInventory, type GovernedRoots, type HeldFile } from './inventory';
import type { ExportJournal } from './journal';
import type { DataPolicy, DataRoot } from './policy';

export const MANIFEST_FILE = 'manifest.json';
export const FILES_DIR = 'files';
export const MANIFEST_FORMAT = 'inquello-local-data-export';
const CHUNK = 1024 * 1024;

export interface Attribution {
  /** The signed-in principal, or null when signed out. */
  principal: { displayName: string; issuerLabel: string } | null;
  appVersion: string;
  runtimeVersion: string;
}

export interface ManifestFile {
  root: DataRoot;
  /** Path below the root, with `/` separators. */
  path: string;
  size: number;
  sha256: string;
}

export interface ManifestCategory {
  category: string;
  label: string;
  files: ManifestFile[];
}

export interface ManifestOmission {
  /** The omitted category, or null for files that match no category. */
  category: string | null;
  label: string;
  reason: string;
  /** How many held files the omission covers at export time. */
  files: number;
}

export interface ExportManifest {
  format: typeof MANIFEST_FORMAT;
  version: 1;
  createdAt: string;
  notice: string;
  policyOwner: string;
  attribution: Attribution;
  included: ManifestCategory[];
  omissions: ManifestOmission[];
}

export interface ExportOptions {
  policy: DataPolicy;
  roots: GovernedRoots;
  /** The directory the user chose. It must not exist yet, or be empty. */
  destination: string;
  attribution: Attribution;
  journal: ExportJournal;
  now?: () => Date;
}

export interface ExportResult {
  path: string;
  manifest: ExportManifest;
}

export class ExportError extends Error {
  override name = 'ExportError';
}

/** Copies `source` to a new file `target` (mode 0600), hashing the bytes copied. */
export async function copyWithDigest(source: string, target: string): Promise<{ size: number; sha256: string }> {
  await fs.promises.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const hash = createHash('sha256');
  const input = await fs.promises.open(source, 'r');
  try {
    const output = await fs.promises.open(target, 'wx', 0o600);
    try {
      const buffer = Buffer.allocUnsafe(CHUNK);
      let size = 0;
      for (;;) {
        const { bytesRead } = await input.read(buffer, 0, CHUNK, null);
        if (bytesRead === 0) break;
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        await output.write(chunk);
        size += bytesRead;
      }
      await output.sync();
      return { size, sha256: hash.digest('hex') };
    } finally {
      await output.close();
    }
  } finally {
    await input.close();
  }
}

/** The SHA-256 and size of a file. */
export async function digestFile(file: string): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256');
  const input = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(CHUNK);
    let size = 0;
    for (;;) {
      const { bytesRead } = await input.read(buffer, 0, CHUNK, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      size += bytesRead;
    }
    return { size, sha256: hash.digest('hex') };
  } finally {
    await input.close();
  }
}

/** Where an exported file sits inside the export directory. */
export function exportedFilePath(exportDir: string, root: DataRoot, rel: string): string {
  return path.join(exportDir, FILES_DIR, root, ...rel.split('/'));
}

/** Prepares the destination; returns whether this call created it. */
function claimDestination(destination: string): boolean {
  try {
    fs.mkdirSync(destination, { mode: 0o700 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new ExportError(`the export folder could not be created: ${(error as Error).message}`);
  }
  const stat = fs.statSync(destination);
  if (!stat.isDirectory() || fs.readdirSync(destination).length > 0) throw new ExportError('the chosen export folder already exists and is not empty');
  return false;
}

function removePartial(destination: string, created: boolean): void {
  if (created) {
    fs.rmSync(destination, { recursive: true, force: true, maxRetries: 3 });
    return;
  }
  for (const entry of fs.readdirSync(destination)) fs.rmSync(path.join(destination, entry), { recursive: true, force: true, maxRetries: 3 });
}

export async function exportData(options: ExportOptions): Promise<ExportResult> {
  const { policy, roots, attribution } = options;
  const destination = path.resolve(options.destination);
  for (const root of Object.values(roots)) {
    const rel = path.relative(path.resolve(root), destination);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new ExportError('the export folder must be outside Inquello’s own data folders');
  }
  const inventory = takeInventory(policy, roots);
  const byCategory = new Map<string, HeldFile[]>();
  for (const file of inventory.files) {
    if (!file.category) continue;
    byCategory.set(file.category, [...(byCategory.get(file.category) ?? []), file]);
  }

  const created = claimDestination(destination);
  try {
    const included: ManifestCategory[] = [];
    const omissions: ManifestOmission[] = [];
    for (const category of policy.categories) {
      const held = byCategory.get(category.id) ?? [];
      if (category.export.mode === 'included' && category.enabled && !category.credentials) {
        const files: ManifestFile[] = [];
        for (const file of held) {
          let copied: { size: number; sha256: string };
          try {
            copied = await copyWithDigest(file.abs, exportedFilePath(destination, file.root, file.rel));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !fs.existsSync(file.abs)) continue; // Removed since the inventory.
            throw error;
          }
          files.push({ root: file.root, path: file.rel, ...copied });
        }
        included.push({ category: category.id, label: category.label, files });
      } else {
        const reason =
          category.export.mode === 'excluded'
            ? category.export.reason
            : category.export.mode === 'unknown'
              ? 'Its export rule is unknown, so it is not exported'
              : 'It is disabled and never written';
        omissions.push({ category: category.id, label: category.label, reason, files: held.length });
      }
    }
    if (inventory.unclassified.length > 0) {
      omissions.push({
        category: null,
        label: 'Unclassified files',
        reason: 'They match no category in the local data policy, so nothing allows exporting them',
        files: inventory.unclassified.length,
      });
    }
    const manifest: ExportManifest = {
      format: MANIFEST_FORMAT,
      version: 1,
      createdAt: (options.now ?? (() => new Date()))().toISOString(),
      notice: policy.notice,
      policyOwner: policy.policy_owner,
      attribution: {
        principal: attribution.principal ? { displayName: attribution.principal.displayName, issuerLabel: attribution.principal.issuerLabel } : null,
        appVersion: attribution.appVersion,
        runtimeVersion: attribution.runtimeVersion,
      },
      included,
      omissions,
    };
    await fs.promises.writeFile(path.join(destination, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    options.journal.append({ path: destination, exportedAt: manifest.createdAt, categories: included.map((entry) => entry.category) });
    return { path: destination, manifest };
  } catch (error) {
    removePartial(destination, created);
    if (error instanceof ExportError) throw error;
    throw new ExportError(`the export could not be written: ${(error as Error).message}`);
  }
}
