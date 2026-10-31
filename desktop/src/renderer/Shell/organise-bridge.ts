/**
 * The renderer's typed view of `window.inquello.organise` (Story 1.14).
 * Results come from main and are parsed defensively: a malformed answer is
 * treated as a failed request, never shown half-read.
 */

export interface EngagementItem {
  engagementId: string;
  workspaceId: string;
  name: string;
  objectives: string;
  scope: string;
  clientEntity: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  revision: number;
}

export interface FolderItem {
  folderId: string;
  engagementId: string;
  name: string;
  revision: number;
}

export interface TaskItem {
  taskId: string;
  workspaceId: string;
  engagementId: string | null;
  folderId: string | null;
  title: string;
  runtimeThreadId: string | null;
  sourceRefs: string[];
  artifactRefs: string[];
  visibility: 'private';
  revision: number;
}

export interface WorkspaceTree {
  unavailableTasks?:Array<{taskId:string;reason:'current_authority_unavailable'}>;
  workspaceId: string;
  engagements: EngagementItem[];
  folders: FolderItem[];
  tasks: TaskItem[];
}

export interface WorkspaceEntry {
  workspaceId: string;
  name: string;
  source: 'service' | 'local';
}

export interface WorkspacesState {
  signedIn: boolean;
  sharedService: 'available' | 'unavailable' | 'not-configured';
  workspaces: WorkspaceEntry[];
  engagementCreation: { enabled: boolean; reason?: string };
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; code: string; reason: string };

export interface OrganiseBridge {
  getWorkspaces(): Promise<unknown>;
  getTree(request: { workspaceId: string }): Promise<unknown>;
  createEngagement(request: {
    operationId: string;
    workspaceId: string;
    name: string;
    objectives: string;
    scope: string;
    clientEntity: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  }): Promise<unknown>;
  createFolder(request: { operationId: string; workspaceId: string; engagementId: string; name: string }): Promise<unknown>;
  createTask(request: { operationId: string; workspaceId: string; engagementId: string | null; folderId: string | null; title: string }): Promise<unknown>;
  renameTask(request: { operationId: string; workspaceId: string; taskId: string; expectedRevision: number; title: string }): Promise<unknown>;
  moveTask(request: {
    operationId: string;
    workspaceId: string;
    taskId: string;
    expectedRevision: number;
    engagementId: string | null;
    folderId: string | null;
  }): Promise<unknown>;
}

/** The organise operations, or null outside the desktop. */
export function organiseBridge(): OrganiseBridge | null {
  const bridge = (globalThis as { inquello?: { organise?: OrganiseBridge } }).inquello;
  return bridge?.organise ?? null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const optionalStr = (value: unknown): string | null | undefined => (value === null ? null : typeof value === 'string' ? value : undefined);
const revision = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);
const strings = (value: unknown): string[] | null => (Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null);

export function parseEngagement(value: unknown): EngagementItem | null {
  const r = record(value);
  if (!r) return null;
  const engagementId = str(r.engagementId);
  const workspaceId = str(r.workspaceId);
  const name = str(r.name);
  const objectives = str(r.objectives);
  const scope = str(r.scope);
  const clientEntity = optionalStr(r.clientEntity);
  const periodStart = optionalStr(r.periodStart);
  const periodEnd = optionalStr(r.periodEnd);
  const rev = revision(r.revision);
  if (engagementId === null || workspaceId === null || name === null || objectives === null || scope === null) return null;
  if (clientEntity === undefined || periodStart === undefined || periodEnd === undefined || rev === null) return null;
  return { engagementId, workspaceId, name, objectives, scope, clientEntity, periodStart, periodEnd, revision: rev };
}

export function parseFolder(value: unknown): FolderItem | null {
  const r = record(value);
  const folderId = str(r?.folderId);
  const engagementId = str(r?.engagementId);
  const name = str(r?.name);
  const rev = revision(r?.revision);
  if (!r || folderId === null || engagementId === null || name === null || rev === null) return null;
  return { folderId, engagementId, name, revision: rev };
}

export function parseTask(value: unknown): TaskItem | null {
  const r = record(value);
  if (!r || r.visibility !== 'private') return null;
  const taskId = str(r.taskId);
  const workspaceId = str(r.workspaceId);
  const title = str(r.title);
  const engagementId = optionalStr(r.engagementId);
  const folderId = optionalStr(r.folderId);
  const runtimeThreadId = optionalStr(r.runtimeThreadId);
  const sourceRefs = strings(r.sourceRefs);
  const artifactRefs = strings(r.artifactRefs);
  const rev = revision(r.revision);
  if (taskId === null || workspaceId === null || title === null || rev === null || sourceRefs === null || artifactRefs === null) return null;
  if (engagementId === undefined || folderId === undefined || runtimeThreadId === undefined) return null;
  return { taskId, workspaceId, engagementId, folderId, title, runtimeThreadId, sourceRefs, artifactRefs, visibility: 'private', revision: rev };
}

function all<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

export function parseTree(value: unknown): WorkspaceTree | null {
  const r = record(value);
  const workspaceId = str(r?.workspaceId);
  const engagements = all(r?.engagements, parseEngagement);
  const folders = all(r?.folders, parseFolder);
  const tasks = all(r?.tasks, parseTask);
  const unavailableTasks=all(r?.unavailableTasks??[],item=>{const x=record(item);return x&&typeof x.taskId==='string'&&x.reason==='current_authority_unavailable'?{taskId:x.taskId,reason:'current_authority_unavailable' as const}:null;});
  if (workspaceId === null || !engagements || !folders || !tasks || !unavailableTasks || unavailableTasks.length>10000) return null;
  return { workspaceId, engagements, folders, tasks, unavailableTasks };
}

export function parseWorkspaces(value: unknown): WorkspacesState | null {
  const r = record(value);
  if (!r || typeof r.signedIn !== 'boolean') return null;
  const shared = r.sharedService;
  if (shared !== 'available' && shared !== 'unavailable' && shared !== 'not-configured') return null;
  const workspaces = all(r.workspaces, (item) => {
    const w = record(item);
    const workspaceId = str(w?.workspaceId);
    const name = str(w?.name);
    if (!w || workspaceId === null || name === null || (w.source !== 'service' && w.source !== 'local')) return null;
    return { workspaceId, name, source: w.source as WorkspaceEntry['source'] };
  });
  const creation = record(r.engagementCreation);
  if (!workspaces || !creation || typeof creation.enabled !== 'boolean') return null;
  const reason = str(creation.reason);
  return {
    signedIn: r.signedIn,
    sharedService: shared,
    workspaces,
    engagementCreation: reason ? { enabled: creation.enabled, reason } : { enabled: creation.enabled },
  };
}

/** Parses `{ ok, value }` / `{ ok: false, code, reason }`; a malformed answer is a failure. */
export function parseOutcome<T>(value: unknown, parse: (value: unknown) => T | null): Outcome<T> {
  const r = record(value);
  if (r?.ok === true) {
    const parsed = parse(r.value);
    if (parsed !== null) return { ok: true, value: parsed };
  } else if (r?.ok === false) {
    return { ok: false, code: str(r.code) ?? 'failed', reason: str(r.reason) ?? 'The request did not complete.' };
  }
  return { ok: false, code: 'failed', reason: 'The request did not complete.' };
}

/** A fresh operation ID for one user action; a retry of the same action reuses it. */
export function newOperationId(): string {
  return globalThis.crypto.randomUUID();
}
