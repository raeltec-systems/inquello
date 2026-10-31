/**
 * Delete by category.
 *
 * The caller (main) stops the runtime first and restarts it afterwards, and
 * signs out through the Story 1.10 flow before the identity session is
 * removed. This module removes the files each chosen category holds, prunes
 * directories it emptied, and reports what was removed and what was retained.
 *
 * The Chromium profile is never unlinked under the running browser engine:
 * it is cleared through Electron (`clearBrowserProfile`), and the files the
 * engine keeps open are reported as remaining.
 *
 * Exported copies are never deleted. The report lists every copy the export
 * journal knows of (read before anything is removed) as outside Inquello's
 * control. No hold, legal hold or record lifecycle exists here.
 */
import fs from 'node:fs';
import path from 'node:path';

import { takeInventory, type GovernedRoots } from './inventory';
import type { JournalEntry } from './journal';
import { categoryById, isStoreCategory, type DataPolicy } from './policy';

export const CHROMIUM_PROFILE = 'chromium-profile';

export class DeleteError extends Error {
  override name = 'DeleteError';
}

export interface CategoryRemoval {
  category: string;
  label: string;
  filesRemoved: number;
  /** Files of this category still present afterwards (for example ones another process holds open). */
  filesRemaining: number;
  note?: string;
}

export interface CategoryRetained {
  category: string;
  label: string;
  files: number;
}

export interface SurvivingExport extends JournalEntry {
  outsideInquelloControl: true;
}

export interface DeleteReport {
  removed: CategoryRemoval[];
  retained: CategoryRetained[];
  survivingExports: SurvivingExport[];
}

export interface DeleteOptions {
  policy: DataPolicy;
  roots: GovernedRoots;
  categories: readonly string[];
  /** The export journal's entries, read before anything is removed. */
  journalEntries: readonly JournalEntry[];
  /** Main-owned recovery fences must outlive incomplete category deletion. */
  protectedPaths?:ReadonlySet<string>;
  /** Clears Chromium storage and caches through Electron. */
  clearBrowserProfile?: () => Promise<void>;
  /** Extra text per category (main adds the identity revocation outcome). */
  notes?: Readonly<Record<string, string>>;
}

/** Removes empty directories from `dir` up to, but not including, `stop`. */
function pruneEmpty(dir: string, stop: string): void {
  let current = path.resolve(dir);
  const root = path.resolve(stop);
  while (current !== root && current.startsWith(root + path.sep)) {
    try {
      fs.rmdirSync(current);
    } catch {
      return; // Not empty, or already gone.
    }
    current = path.dirname(current);
  }
}

/** Removes `dir` and every directory below it that holds no file; symlinks are never followed. */
function pruneEmptyTree(dir: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) if (entry.isDirectory()) pruneEmptyTree(path.join(dir, entry.name));
  try {
    fs.rmdirSync(dir);
  } catch {
    // Not empty: it still holds a file.
  }
}

/** The directory tree a glob such as `tasks/**` covers, or null for any other glob. */
function globDirectory(glob: string): string | null {
  if (!glob.endsWith('/**')) return null;
  const parts = glob.split('/');
  const fixed: string[] = [];
  for (const part of parts.slice(0, -1)) {
    if (/[*?[\]{}]/.test(part)) break;
    fixed.push(part);
  }
  return fixed.length > 0 ? fixed.join('/') : null;
}

export function validateDeletion(policy: DataPolicy, categories: readonly string[]): void {
  if (categories.length === 0) throw new DeleteError('no category was chosen');
  for (const id of categories) {
    const category = categoryById(policy, id);
    if (!category) throw new DeleteError(`unknown category ${JSON.stringify(id)}`);
    if (!category.enabled) throw new DeleteError(`${category.label} is disabled and holds nothing to delete`);
    if (isStoreCategory(category)) throw new DeleteError(`${category.label} is held in the OS credential store; remove it in Providers`);
  }
}

export async function deleteCategories(options: DeleteOptions): Promise<DeleteReport> {
  const { policy, roots } = options;
  validateDeletion(policy, options.categories);
  const chosen = new Set(options.categories);
  const survivingExports: SurvivingExport[] = options.journalEntries.map((entry) => ({ ...entry, categories: [...entry.categories], outsideInquelloControl: true }));

  const before = takeInventory(policy, roots);
  const removedCounts = new Map<string, number>();
  if (chosen.has(CHROMIUM_PROFILE)) await options.clearBrowserProfile?.();
  for (const file of before.files) {
    if (options.protectedPaths?.has(path.resolve(file.abs)) || !file.category || !chosen.has(file.category) || file.category === CHROMIUM_PROFILE) continue;
    try {
      fs.rmSync(file.abs, { force: true });
      removedCounts.set(file.category, (removedCounts.get(file.category) ?? 0) + 1);
      pruneEmpty(path.dirname(file.abs), roots[file.root]);
    } catch {
      // Counted as remaining below.
    }
  }
  // Directories a chosen category held and now leaves empty (for example an
  // unused Task folder and its Output folder) are removed too.
  for (const id of chosen) {
    const category = categoryById(policy, id);
    if (!category || id === CHROMIUM_PROFILE || isStoreCategory(category)) continue;
    const location = category.location as { root: keyof GovernedRoots; globs: readonly string[] };
    for (const glob of location.globs) {
      const dir = globDirectory(glob);
      if (dir) pruneEmptyTree(path.join(roots[location.root], dir));
    }
  }
  const after = takeInventory(policy, roots);
  if (chosen.has(CHROMIUM_PROFILE)) {
    removedCounts.set(CHROMIUM_PROFILE, Math.max(0, before.held[CHROMIUM_PROFILE]!.files - after.held[CHROMIUM_PROFILE]!.files));
  }

  const removed: CategoryRemoval[] = [];
  const retained: CategoryRetained[] = [];
  for (const category of policy.categories) {
    if (!category.enabled) continue;
    if (chosen.has(category.id)) {
      const entry: CategoryRemoval = {
        category: category.id,
        label: category.label,
        filesRemoved: removedCounts.get(category.id) ?? 0,
        filesRemaining: after.held[category.id]!.files,
      };
      const notes: string[] = [];
      if (category.id === CHROMIUM_PROFILE) notes.push('Storage and caches were cleared through Electron; files the browser engine holds open stay and are recreated while Inquello runs.');
      if (options.notes?.[category.id]) notes.push(options.notes[category.id]!);
      if (notes.length > 0) entry.note = notes.join(' ');
      removed.push(entry);
    } else {
      retained.push({ category: category.id, label: category.label, files: after.held[category.id]!.files });
    }
  }
  return { removed, retained, survivingExports };
}
