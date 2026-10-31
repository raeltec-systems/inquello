/**
 * The export journal: `<userData>/data/export-journal.json`.
 *
 * Every export is recorded with its path, time and categories, so a later
 * deletion can name the copies that survive outside Inquello's control. The
 * journal never deletes or touches an exported copy. Writes are atomic
 * (temporary file, then rename) with mode 0600.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const JOURNAL_DIR = 'data';
export const JOURNAL_FILE = 'export-journal.json';

export interface JournalEntry {
  /** The export directory, as chosen by the user. */
  path: string;
  /** Presentation ownership only; never recovery authority. */
  ownerPrincipalId?:string;
  /** ISO-8601 time the export finished. */
  exportedAt: string;
  /** Category ids the export includes. */
  categories: string[];

}

export function journalPath(userDataDir: string): string {
  return path.join(userDataDir, JOURNAL_DIR, JOURNAL_FILE);
}

function isEntry(value: unknown): value is JournalEntry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.path === 'string' &&
    (record.ownerPrincipalId===undefined||(typeof record.ownerPrincipalId==='string'&&/^[0-9a-f-]{36}$/.test(record.ownerPrincipalId))) &&
    typeof record.exportedAt === 'string' &&
    Array.isArray(record.categories) &&
    record.categories.every((category) => typeof category === 'string')
  );
}

export class ExportJournal {
  readonly file: string;

  constructor(userDataDir: string) {
    this.file = journalPath(userDataDir);
  }

  /** Every recorded export, oldest first. A missing journal is empty; an unreadable one throws. */
  read(): JournalEntry[] {
    let raw: string;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== 1) throw new Error('the export journal has an unknown format');
    const entries = (parsed as { entries?: unknown }).entries;
    if (!Array.isArray(entries) || !entries.every(isEntry)) throw new Error('the export journal has an unknown format');
    return entries.map((entry) => ({ ...(entry.ownerPrincipalId?{ownerPrincipalId:entry.ownerPrincipalId}:{}), path: entry.path, exportedAt: entry.exportedAt, categories: [...entry.categories] }));
  }

  append(entry: JournalEntry): void {
    const entries = [...this.read(), entry];
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      fs.renameSync(temp, this.file);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }
}
