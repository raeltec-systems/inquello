/**
 * The local data inventory: every file the desktop holds in its governed
 * roots, classified against the data-policy register.
 *
 * The roots are userData, the runtime home (`<userData>/runtime-home`, the
 * runtime's `CODEX_HOME`) and the logs directory. A file belongs to the most
 * specific root that contains it, so files under the runtime home are matched
 * only against runtime-home categories even though the runtime home sits
 * inside userData. Symbolic links are listed as files and never followed.
 * Empty directories hold nothing and are not listed.
 */
import fs from 'node:fs';
import path from 'node:path';

import { classify, type DataPolicy, type DataRoot, type HeldFiles } from './policy';

/** The runtime home's directory name under userData. */
export const RUNTIME_HOME_DIR = 'runtime-home';

export function runtimeHomeDir(userDataDir: string): string {
  return path.join(userDataDir, RUNTIME_HOME_DIR);
}

export interface GovernedRoots {
  'user-data': string;
  'runtime-home': string;
  logs: string;
}

export function governedRoots(userDataDir: string, logsDir: string): GovernedRoots {
  return { 'user-data': userDataDir, 'runtime-home': runtimeHomeDir(userDataDir), logs: logsDir };
}

export interface HeldFile {
  root: DataRoot;
  /** Path below the root, with `/` separators. */
  rel: string;
  abs: string;
  size: number;
  /** The governing category id, or null when unclassified. */
  category: string | null;
}

export interface Inventory extends HeldFiles {
  files: HeldFile[];
  /** Per category id: how many files and bytes are held. */
  held: Record<string, { files: number; bytes: number }>;
}

/** `true` when `child` is `parent` or inside it. */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export const toPosix = (rel: string): string => rel.split(path.sep).join('/');

/** Every file under `dir`, skipping `skip` subtrees. Missing directories hold nothing. */
function walk(dir: string, skip: readonly string[], out: Array<{ abs: string; size: number }>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') return;
    throw error;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (skip.some((other) => path.resolve(other) === path.resolve(abs))) continue;
    if (entry.isDirectory()) {
      walk(abs, skip, out);
    } else {
      let size = 0;
      try {
        size = fs.lstatSync(abs).size;
      } catch {
        continue; // Removed while walking.
      }
      out.push({ abs, size });
    }
  }
}

/** Lists and classifies every file in the governed roots. */
export function takeInventory(policy: DataPolicy, roots: GovernedRoots): Inventory {
  // Most specific first, so a nested root claims its own files.
  const order = (Object.keys(roots) as DataRoot[]).sort((a, b) => path.resolve(roots[b]).length - path.resolve(roots[a]).length);
  const files: HeldFile[] = [];
  const walked = new Set<string>();
  for (const root of order) {
    const dir = path.resolve(roots[root]);
    if (walked.has(dir)) continue;
    walked.add(dir);
    // Nested roots are walked on their own.
    const nested = order.filter((other) => other !== root && isInside(dir, roots[other]) && path.resolve(roots[other]) !== dir).map((other) => roots[other]);
    const found: Array<{ abs: string; size: number }> = [];
    walk(dir, nested, found);
    for (const { abs, size } of found) {
      const rel = toPosix(path.relative(dir, abs));
      const category = classify(policy, root, rel);
      files.push({ root, rel, abs, size, category: category?.id ?? null });
    }
  }
  files.sort((a, b) => (a.root === b.root ? a.rel.localeCompare(b.rel) : a.root.localeCompare(b.root)));
  const held: Inventory['held'] = Object.fromEntries(policy.categories.map((category) => [category.id, { files: 0, bytes: 0 }]));
  const unclassified: string[] = [];
  const disabledHeld: Array<{ category: string; path: string }> = [];
  for (const file of files) {
    const label = `${file.root}:${file.rel}`;
    if (!file.category) {
      unclassified.push(label);
      continue;
    }
    const counts = held[file.category]!;
    counts.files += 1;
    counts.bytes += file.size;
    if (!policy.categories.find((category) => category.id === file.category)!.enabled) disabledHeld.push({ category: file.category, path: label });
  }
  return { files, held, unclassified, disabledHeld };
}
