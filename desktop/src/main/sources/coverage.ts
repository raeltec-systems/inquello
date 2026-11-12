/**
 * Coverage facts (Story 2.1): what was examined against what was attached.
 * Files read out of files attached; for tabular files, rows read out of rows
 * present; every file not searched, unreadable or inaccessible with its reason.
 * Anything excluded, partly read or cut by a bound makes the input set
 * incomplete, and the answer area says so.
 */
import type { AttachmentView, ExcludedFile } from './attachments';

export interface SandboxFile { path: string; status: 'readable' | 'unreadable' | 'not-searched'; kind?: string; reason?: string; counts?: Record<string, unknown> }
export interface CoverageView {
  filesAttached: number;
  filesRead: number;
  rows: { read: number; present: number; unknown: number } | null;
  unreadable: ExcludedFile[];
  notSearched: ExcludedFile[];
  inaccessible: ExcludedFile[];
  partlyRead: ExcludedFile[];
  incomplete: boolean;
  statement: string;
}

export function parseSandboxInventory(stdout: string): SandboxFile[] {
  const value = JSON.parse(stdout) as { files?: unknown };
  if (!value || !Array.isArray(value.files) || value.files.length > 20000) throw new Error('Invalid inventory');
  return value.files.map((raw) => {
    const item = raw as Record<string, unknown>;
    if (typeof item.path !== 'string' || !['readable', 'unreadable', 'not-searched'].includes(String(item.status))) throw new Error('Invalid inventory entry');
    return { path: item.path, status: item.status as SandboxFile['status'], ...(typeof item.kind === 'string' ? { kind: item.kind } : {}), ...(typeof item.reason === 'string' ? { reason: item.reason } : {}), ...(item.counts && typeof item.counts === 'object' ? { counts: item.counts as Record<string, unknown> } : {}) };
  });
}

const relativeOf = (attached: AttachmentView[], id: string) => attached.flatMap(a => a.files).find(file => file.id === id)?.relative ?? id.replace(/^attached\//, '');

export function coverage(attachments: AttachmentView[], inventory: SandboxFile[] | null): CoverageView {
  const files = attachments.flatMap(a => a.files);
  const notSearched = attachments.flatMap(a => a.notSearched);
  const inaccessible = attachments.flatMap(a => a.inaccessible);
  const unreadable: ExcludedFile[] = [], partlyRead: ExcludedFile[] = [];
  let filesRead = 0, read = 0, present = 0, unknown = 0, tabular = false;
  const byPath = new Map((inventory ?? []).map(item => [item.path, item]));
  for (const file of files) {
    const item = byPath.get(file.id);
    const isTable = ['csv', 'xlsx', 'xls'].includes(file.format);
    tabular ||= isTable;
    if (!item) { unreadable.push({ relative: file.relative, reason: inventory ? 'Not found in the staged material' : 'Not yet examined in the sandbox' }); if (isTable) unknown++; continue; }
    if (item.status !== 'readable') { unreadable.push({ relative: file.relative, reason: item.reason ?? 'Unreadable' }); if (isTable) unknown++; continue; }
    filesRead++;
    const counts = item.counts ?? {};
    // `rowsRead` is present only when the reading was cut by the line bound; then fewer rows were read than are present.
    if (isTable) {
      if (file.format === 'csv') { const rows = Number(counts.rows ?? 0); present += rows; read += counts.rowsRead === undefined ? rows : Math.min(Number(counts.rowsRead) || 0, rows); }
      else for (const sheet of Object.values((counts.sheets ?? {}) as Record<string, { rows?: number; rowsRead?: number }>)) { const rows = Number(sheet.rows ?? 0); present += rows; read += sheet.rowsRead === undefined ? rows : Math.min(Number(sheet.rowsRead) || 0, rows); }
    }
    const partly = (counts as { partly?: unknown }).partly;
    if (Array.isArray(partly) && partly.length) partlyRead.push({ relative: relativeOf(attachments, file.id), reason: `Partly read: ${partly.join(', ')}` });
    const empty = (counts as { pagesWithoutText?: unknown }).pagesWithoutText;
    if (Array.isArray(empty) && empty.length) partlyRead.push({ relative: file.relative, reason: `No recognisable text on page ${empty.join(', ')}` });
  }
  const incomplete = notSearched.length + inaccessible.length + unreadable.length + partlyRead.length > 0 || attachments.some(a => a.incomplete.some(text => text.startsWith('Only part')));
  const statement = `${filesRead} of ${files.length + notSearched.length + inaccessible.length} attached files read`
    + (tabular ? `; ${read} of ${present} rows read in the readable tables${unknown ? `, rows of ${unknown} unreadable table(s) not counted` : ''}` : '')
    + (incomplete ? '. The input set is incomplete.' : '.');
  return { filesAttached: files.length + notSearched.length + inaccessible.length, filesRead, rows: tabular ? { read, present, unknown } : null, unreadable, notSearched, inaccessible, partlyRead, incomplete, statement };
}
