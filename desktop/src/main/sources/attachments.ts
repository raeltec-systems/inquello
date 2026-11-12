/**
 * Attached material on the Windows side (Story 2.1): inventory of files and
 * folders the main process chose through the system dialog, and the staged
 * copy in a Task folder. The renderer never supplies a path; it sees an
 * attachment id, display names and paths relative to the chosen folder.
 *
 * Originals are only read. Links, junctions, hard-linked and special files are
 * never followed or staged; files the operating system denies are listed as
 * inaccessible; types no reader supports and files over the bounds are listed
 * as not searched. Staging re-reads each file and refuses one that changed
 * since it was attached.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { validateTransferName, type Entry } from '../runtime/wsl-tasks';
import { formatOf, type SourceFormat } from './citations';

export const MAX_ATTACHED_FILES = 2000;
export const MAX_ATTACHED_BYTES = 192 * 1024 ** 2;
export const MAX_FILE_BYTES = 64 * 1024 ** 2;
const MAX_DEPTH = 32;
export const ATTACHED_DIR = 'attached';
export const SKILL_DIR = 'skills/inquello-evidence';

export interface AttachedFile { id: string; name: string; relative: string; bytes: number; modifiedAt: string; sha256: string; format: SourceFormat; source: string }
export interface ExcludedFile { relative: string; reason: string }
export interface Attachment {
  attachmentId: string;
  label: string;
  createdAt: string;
  files: AttachedFile[];
  notSearched: ExcludedFile[];
  inaccessible: ExcludedFile[];
  incomplete: string[];
}
/** What the renderer and the retained record see: no absolute path. */
export type AttachmentView = Omit<Attachment, 'files'> & { files: Array<Omit<AttachedFile, 'source'>>; bytes: number };

export class AttachRefused extends Error { override name = 'AttachRefused'; }

export function attachmentView(attachment: Attachment): AttachmentView {
  return { ...attachment, files: attachment.files.map(({ source: _source, ...file }) => file), bytes: attachment.files.reduce((sum, file) => sum + file.bytes, 0) };
}

const denied = (error: unknown) => ['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '');

function digest(file: string): { sha256: string; bytes: number; mtimeMs: number } {
  const fd = fs.openSync(file, 'r');
  try {
    const before = fs.fstatSync(fd);
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(1024 * 1024);
    let total = 0, read: number;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, total)) > 0) { hash.update(buffer.subarray(0, read)); total += read; }
    const after = fs.fstatSync(fd);
    if (total !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('changed while being read');
    return { sha256: hash.digest('hex'), bytes: total, mtimeMs: before.mtimeMs };
  } finally { fs.closeSync(fd); }
}

/**
 * Inventories the chosen files and folders. A folder that cannot be read at
 * all refuses the attachment; anything inside it that cannot be read is
 * listed and the rest is still attached.
 */
export function inventoryAttachment(selection: { files: readonly string[]; folders: readonly string[] }, now: () => Date = () => new Date()): Attachment {
  const attachment: Attachment = { attachmentId: randomUUID(), label: '', createdAt: now().toISOString(), files: [], notSearched: [], inaccessible: [], incomplete: [] };
  const seen = new Set<string>();
  let total = 0, cut = false;
  const consider = (source: string, relative: string, info: fs.Stats) => {
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) { attachment.notSearched.push({ relative, reason: info.isSymbolicLink() ? 'Link or shortcut; not followed' : 'Special file; not read' }); return; }
    if (info.nlink > 1) { attachment.notSearched.push({ relative, reason: 'Hard-linked file; not staged' }); return; }
    const staged = `${ATTACHED_DIR}/${relative}`;
    try { validateTransferName(staged); } catch { attachment.notSearched.push({ relative, reason: 'File name cannot be staged' }); return; }
    if (seen.has(staged.toLowerCase())) { attachment.notSearched.push({ relative, reason: 'Duplicate name; only the first was attached' }); return; }
    // The skill's sandbox inventory skips dot-prefixed files, so they are not staged and say why.
    if (path.posix.basename(relative).startsWith('.')) { attachment.notSearched.push({ relative, reason: 'Hidden file (name starts with a dot); not searched' }); return; }
    const format = formatOf(relative);
    if (format === 'unsupported') { attachment.notSearched.push({ relative, reason: 'Unsupported file type' }); return; }
    if (info.size > MAX_FILE_BYTES) { attachment.notSearched.push({ relative, reason: `Over the size bound (${MAX_FILE_BYTES / 1024 ** 2} MiB per file)` }); return; }
    if (cut || attachment.files.length >= MAX_ATTACHED_FILES || total + info.size > MAX_ATTACHED_BYTES) {
      cut = true; attachment.notSearched.push({ relative, reason: 'Left out: the attachment bound was reached' }); return;
    }
    let facts: ReturnType<typeof digest>;
    try { facts = digest(source); } catch (error) {
      if (denied(error)) attachment.inaccessible.push({ relative, reason: 'Permission denied by the operating system' });
      else attachment.notSearched.push({ relative, reason: 'The file changed or could not be read while attaching' });
      return;
    }
    seen.add(staged.toLowerCase());
    total += facts.bytes;
    attachment.files.push({ id: staged, name: path.basename(relative), relative, bytes: facts.bytes, modifiedAt: new Date(facts.mtimeMs).toISOString(), sha256: facts.sha256, format, source });
  };
  const walk = (folder: string, prefix: string, depth: number) => {
    let names: string[];
    try { names = fs.readdirSync(folder).sort(); } catch (error) {
      if (denied(error)) { attachment.inaccessible.push({ relative: prefix.replace(/\/$/, '') || '.', reason: 'Folder denied by the operating system' }); return; }
      throw error;
    }
    for (const name of names) {
      const source = path.join(folder, name), relative = `${prefix}${name}`;
      let info: fs.Stats;
      try { info = fs.lstatSync(source); } catch (error) { if (denied(error)) { attachment.inaccessible.push({ relative, reason: 'Permission denied by the operating system' }); continue; } throw error; }
      if (info.isDirectory() && !info.isSymbolicLink()) {
        if (depth >= MAX_DEPTH) { attachment.notSearched.push({ relative, reason: 'Folder nested too deeply; not searched' }); continue; }
        walk(source, `${relative}/`, depth + 1);
      } else consider(source, relative, info);
    }
  };
  for (const folder of selection.folders) {
    let info: fs.Stats;
    try { info = fs.lstatSync(folder); fs.readdirSync(folder); } catch (error) {
      if (denied(error)) throw new AttachRefused('The folder cannot be read: the operating system denied access. Nothing was attached.');
      throw new AttachRefused('The folder is no longer available. Nothing was attached.');
    }
    if (!info.isDirectory() || info.isSymbolicLink()) throw new AttachRefused('Choose a folder, not a link to one. Nothing was attached.');
    walk(folder, `${path.basename(folder)}/`, 0);
  }
  for (const file of selection.files) {
    let info: fs.Stats;
    try { info = fs.lstatSync(file); } catch (error) {
      if (denied(error)) { attachment.inaccessible.push({ relative: path.basename(file), reason: 'Permission denied by the operating system' }); continue; }
      attachment.notSearched.push({ relative: path.basename(file), reason: 'The file is no longer available' }); continue;
    }
    consider(file, path.basename(file), info);
  }
  if (cut) attachment.incomplete.push(`Only part of the material was attached: the bound is ${MAX_ATTACHED_FILES} files and ${MAX_ATTACHED_BYTES / 1024 ** 2} MiB.`);
  if (attachment.inaccessible.length) attachment.incomplete.push(`${attachment.inaccessible.length} item(s) could not be read because the operating system denied access.`);
  if (attachment.notSearched.length) attachment.incomplete.push(`${attachment.notSearched.length} item(s) were not attached; see Not searched.`);
  const parts = [...selection.folders.map(folder => path.basename(folder)), ...(selection.files.length ? [selection.files.length === 1 ? path.basename(selection.files[0]!) : `${selection.files.length} files`] : [])];
  attachment.label = parts.join(', ') || 'Nothing';
  return attachment;
}

/** The skill's files, staged beside the material, and the digests the app checks before trusting them. */
export function skillFiles(skillRoot: string): Array<{ relative: string; data: Buffer }> {
  const files: Array<{ relative: string; data: Buffer }> = [];
  const walk = (folder: string, prefix: string) => {
    for (const name of fs.readdirSync(folder).sort()) {
      if (name === '__pycache__') continue;
      const source = path.join(folder, name), info = fs.lstatSync(source);
      if (info.isDirectory()) walk(source, `${prefix}${name}/`);
      else if (info.isFile()) files.push({ relative: `${prefix}${name}`, data: fs.readFileSync(source) });
    }
  };
  walk(skillRoot, '');
  return files;
}

export function readerDigests(skillRoot: string): Record<string, string> {
  const digests: Record<string, string> = {};
  for (const file of skillFiles(skillRoot)) if (file.relative.startsWith('scripts/') && file.relative.endsWith('.py')) digests[file.relative.slice('scripts/'.length)] = createHash('sha256').update(file.data).digest('hex');
  return digests;
}

const entry = (relative: string, data: Buffer): Entry => ({ path: relative, kind: 'file', data: data.toString('base64'), sha256: createHash('sha256').update(data).digest('hex') });

/**
 * Transfer entries for the material and the skill. Each original is read again
 * and must still match what was attached; one that changed is not staged.
 */
export function stagingEntries(attachment: Attachment, skillRoot: string): { entries: Entry[]; changed: ExcludedFile[] } {
  const entries: Entry[] = [], changed: ExcludedFile[] = [], directories = new Set<string>();
  const parents = (relative: string) => { let parent = path.posix.dirname(relative); const chain: string[] = []; while (parent !== '.') { chain.unshift(parent); parent = path.posix.dirname(parent); } for (const dir of chain) if (!directories.has(dir)) { directories.add(dir); entries.push({ path: dir, kind: 'directory' }); } };
  for (const file of attachment.files) {
    let data: Buffer;
    try { data = fs.readFileSync(file.source); } catch { changed.push({ relative: file.relative, reason: 'No longer readable since it was attached' }); continue; }
    if (createHash('sha256').update(data).digest('hex') !== file.sha256) { changed.push({ relative: file.relative, reason: 'Changed since it was attached; attach it again' }); continue; }
    parents(file.id);
    entries.push(entry(file.id, data));
  }
  for (const file of skillFiles(skillRoot)) { const relative = `${SKILL_DIR}/${file.relative}`; parents(relative); entries.push(entry(relative, file.data)); }
  return { entries, changed };
}

/** Where staged entries land: the Task's Linux guest folder or, under Full access, its Windows folder. */
export interface StagingTarget {
  snapshot(taskId: string): Promise<Entry[]>;
  replace(taskId: string, entries: Entry[]): Promise<void>;
}

/** Merges staged entries into the Task's current files: the skill is refreshed, earlier material is kept unless a file of the same path replaces it. */
export function mergeEntries(current: readonly Entry[], staged: readonly Entry[]): Entry[] {
  const incoming = new Map(staged.map(item => [item.path.toLowerCase(), item]));
  const kept = current.filter(item => !incoming.has(item.path.toLowerCase()) && !(item.path === SKILL_DIR || item.path.startsWith(`${SKILL_DIR}/`)));
  return [...kept, ...staged];
}

export async function stageIntoTask(target: StagingTarget, taskId: string, staged: readonly Entry[]): Promise<void> {
  const current = await target.snapshot(taskId);
  await target.replace(taskId, mergeEntries(current, staged));
}

/** A Task folder on this host (Full access, or a non-Windows development host). */
export function hostStagingTarget(folderOf: (taskId: string) => string): StagingTarget {
  return {
    async snapshot() { return []; },
    async replace(taskId, entries) {
      const root = folderOf(taskId);
      for (const item of [...entries].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
        const target = path.join(root, ...item.path.split('/'));
        if (item.kind === 'directory') fs.mkdirSync(target, { recursive: true, mode: 0o700 });
        else fs.writeFileSync(target, Buffer.from(item.data!, 'base64'), { mode: 0o600 });
      }
    },
  };
}
