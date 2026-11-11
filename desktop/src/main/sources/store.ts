/**
 * The private extract store (`source-extracts`, `<userData>/sources/**`).
 *
 * Holds only what an answer relied on: each verified reference with the text
 * found at its location, plus the Task's attachment record (names, relative
 * paths, modified times, hashes; never a full copy of a source). Records are
 * kept per signed-in creator (a one-way key of the principal) and per Task,
 * written atomically, and readable only by the main process. Retention is
 * `until-owner-deletes`. A deleted Task's extracts are removed with it; an
 * interrupted write leaves only a temporary file that recovery discards, so
 * recovery never resurrects a deleted extract.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { AttachmentView } from './attachments';
import type { ReferenceView } from './verify';

export const SOURCES_DIR = 'sources';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RetainedExtract {
  version: 1;
  extractId: string;
  taskId: string;
  retainedAt: string;
  reference: Pick<ReferenceView, 'id' | 'at' | 'quote' | 'format' | 'location'> & { file: NonNullable<ReferenceView['file']> };
  extract: NonNullable<ReferenceView['extract']>;
}

export interface TaskSourceRecord { version: 1; taskId: string; attachments: AttachmentView[]; inventory: unknown | null; stagedAt: string }

export const principalKey = (principal: string): string => createHash('sha256').update(`inquello-sources\0${principal}`).digest('hex').slice(0, 32);

function writeAtomic(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, target);
}

export class ExtractStore {
  readonly root: string;
  constructor(userData: string) { this.root = path.join(userData, SOURCES_DIR); }

  private taskDir(principal: string, taskId: string): string {
    if (!principal) throw new Error('A signed-in creator is required');
    if (!UUID.test(taskId)) throw new Error('Invalid Task id');
    return path.join(this.root, principalKey(principal), taskId);
  }

  /** Keeps a verified reference and its extract. Unverified references are never retained. Idempotent per location and file version. */
  retain(principal: string, taskId: string, view: ReferenceView, now: () => Date = () => new Date()): RetainedExtract | null {
    if (view.status !== 'verified' || !view.file || !view.extract) return null;
    const extractId = createHash('sha256').update(JSON.stringify([taskId, view.id, view.at, view.file.sha256, view.quote])).digest('hex').slice(0, 32);
    const target = path.join(this.taskDir(principal, taskId), 'extracts', `${extractId}.json`);
    const record: RetainedExtract = { version: 1, extractId, taskId, retainedAt: now().toISOString(), reference: { id: view.id, at: view.at, quote: view.quote, format: view.format, location: view.location, file: view.file }, extract: view.extract };
    if (fs.existsSync(target)) return this.read(target, taskId) ?? record;
    writeAtomic(target, record);
    return record;
  }

  private read(file: string, taskId: string): RetainedExtract | null {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8')) as RetainedExtract;
      return value.version === 1 && value.taskId === taskId && typeof value.extractId === 'string' ? value : null;
    } catch { return null; }
  }

  extracts(principal: string, taskId: string): RetainedExtract[] {
    const folder = path.join(this.taskDir(principal, taskId), 'extracts');
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter(name => /^[0-9a-f]{32}\.json$/.test(name)).map(name => this.read(path.join(folder, name), taskId)).filter((value): value is RetainedExtract => value !== null)
      .sort((a, b) => a.retainedAt.localeCompare(b.retainedAt) || a.extractId.localeCompare(b.extractId));
  }

  saveTask(principal: string, record: TaskSourceRecord): void { writeAtomic(path.join(this.taskDir(principal, record.taskId), 'task.json'), record); }

  task(principal: string, taskId: string): TaskSourceRecord | null {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(this.taskDir(principal, taskId), 'task.json'), 'utf8')) as TaskSourceRecord;
      return value.version === 1 && value.taskId === taskId && Array.isArray(value.attachments) ? value : null;
    } catch { return null; }
  }

  /** Removes everything retained for one Task of this creator. Reports what was removed and what could not be. */
  deleteTask(principal: string, taskId: string): { removed: number; remaining: number } {
    const folder = this.taskDir(principal, taskId);
    if (!fs.existsSync(folder)) return { removed: 0, remaining: 0 };
    const count = (dir: string): number => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, item) => sum + (item.isDirectory() ? count(path.join(dir, item.name)) : 1), 0) : 0;
    const before = count(folder);
    fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3 });
    const remaining = count(folder);
    return { removed: before - remaining, remaining };
  }

  /** Discards temporary files left by an interrupted write. Never restores anything. */
  recover(): number {
    let removed = 0;
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, item.name);
        if (item.isDirectory()) walk(target);
        else if (item.name.endsWith('.tmp')) { fs.rmSync(target, { force: true }); removed++; }
      }
    };
    walk(this.root);
    return removed;
  }
}
