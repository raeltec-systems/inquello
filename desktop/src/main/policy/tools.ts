/**
 * Bounded tool runs (Story 1.19): the Task folder, the translation of the
 * runtime's own results into denials, and the escalation gate.
 *
 * - **Task folder.** Each Task has a private working folder with an `output`
 *   folder under Inquello's data area (`<userData>/tasks/<taskId>`, owner
 *   only), created on first use and governed by the `task-folders` category
 *   of `data-policy.json` (export and delete through Local data). Its path
 *   never appears in user-facing text: people see "This Task's working
 *   folder" and "Output folder".
 * - **Denials** are the runtime's own results translated, never invented:
 *   - the network proxy's blocked answer names the destination ("Blocked:
 *     example.com is not on this Workspace's allowed list");
 *   - a file error the sandbox caused (a read-only mount, or a path the
 *     sandbox hides although it exists on this device) is "Blocked: outside
 *     this Task's permitted locations" with the boundary named;
 *   - a sandbox error with nothing attributable is "Blocked by the local
 *     sandbox" and nothing more specific.
 * - **Escalation.** When the runtime would ask before an action, the request
 *   is recorded as a pending authorization request. When its thread belongs
 *   to a known Task (`routeFor`, wired once Story 1.25 attaches threads to
 *   Tasks), the request goes to the same permission path as
 *   `inquello/tools/exec` (Story 1.20): an ApprovalCard, and the runtime is
 *   answered only after the person decides. Otherwise it is declined with
 *   the boundary named.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The data-area directory that holds every Task folder. */
export const TASK_FOLDERS_DIR = 'tasks';
export const TASK_OUTPUT_DIR = 'output';

/** Plain names for the Task's folders; the only way they are shown. */
export const WORKING_FOLDER_LABEL = "This Task's working folder";
export const OUTPUT_FOLDER_LABEL = 'Output folder';

export const DENIAL_OUTSIDE = "Blocked: outside this Task's permitted locations";
export const DENIAL_SANDBOX = 'Blocked by the local sandbox';
export const SANDBOX_UNAVAILABLE = 'Local sandbox unavailable on this device';

export const networkDenialText = (destination: string): string => `Blocked: ${destination} is not on this Workspace's allowed list`;
export const outsideDenialText = (boundary: string): string => `${DENIAL_OUTSIDE}. Boundary: ${boundary}.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Where the Task folders live. */
export function taskFoldersRoot(userDataDir: string): string {
  return path.join(userDataDir, TASK_FOLDERS_DIR);
}

/** The Task's working folder and its output folder (no I/O). */
export function taskFolderPaths(root: string, taskId: string): { working: string; output: string } {
  if (!UUID.test(taskId)) throw new Error('a Task folder needs a Task id');
  const working = path.join(path.resolve(root), taskId);
  return { working, output: path.join(working, TASK_OUTPUT_DIR) };
}

/** Creates the Task's folder and its output folder, private to this user; returns their paths. */
export function ensureTaskFolder(root: string, taskId: string): { working: string; output: string } {
  const paths = taskFolderPaths(root, taskId);
  fs.mkdirSync(path.resolve(root), { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.output, { recursive: true, mode: 0o700 });
  for (const dir of [path.resolve(root), paths.working, paths.output]) {
    if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
  }
  return paths;
}

// ---- denials ------------------------------------------------------------------

/** One boundary of the runtime's tool reach. */
export interface ReachBoundary {
  kind: 'working_folder' | 'output_folder' | 'system';
  access: 'read' | 'write';
  label: string;
}

export interface ToolDenial {
  kind: 'filesystem' | 'network' | 'sandbox';
  /** The user-facing text; never a device path. */
  text: string;
  /** The boundary named, for a filesystem denial. */
  boundary: string | null;
  /** The destination named, for a network denial. */
  destination: string | null;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface DenialContext {
  working: string;
  output: string;
  bounded: boolean;
  boundaries: readonly ReachBoundary[];
  /** Whether a path exists on this device (outside the sandbox). */
  exists?: (file: string) => boolean;
}

const REFUSED = ['Read-only file system', 'Operation not permitted', 'Permission denied'] as const;
const MISSING = ['No such file or directory', 'Directory nonexistent'] as const;
type FileError = (typeof REFUSED)[number] | (typeof MISSING)[number];
const FILE_ERROR = new RegExp(
  String.raw`(?:'([^'\n]+)'|‘([^’\n]+)’|"([^"\n]+)"|([^\s:'"‘’]+))\s*:\s*(${[...REFUSED, ...MISSING].join('|')})`,
  'g',
);

function inside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/** The boundaries a path outside the Task folder is held to: every permitted location. */
const permittedText = (boundaries: readonly ReachBoundary[]): string => boundaries.map((boundary) => boundary.label).join(', ');

/** The proxy's blocked answer, as its JSON body or a CONNECT refusal with its host. */
function networkDenials(output: string): ToolDenial[] {
  const denials: ToolDenial[] = [];
  for (const line of output.split(/\r?\n/)) {
    const start = line.indexOf('{"status":"blocked"');
    if (start < 0) continue;
    try {
      const body = JSON.parse(line.slice(start, line.lastIndexOf('}') + 1)) as { status?: unknown; host?: unknown };
      if (body.status === 'blocked' && typeof body.host === 'string' && body.host.length > 0) {
        denials.push({ kind: 'network', text: networkDenialText(body.host), boundary: null, destination: body.host });
      }
    } catch {
      // Not the proxy's answer.
    }
  }
  // `curl -v` through the proxy: `> CONNECT host:port` then `< x-proxy-error: blocked-by-…`.
  let connectHost: string | null = null;
  for (const line of output.split(/\r?\n/)) {
    const connect = /^>\s*CONNECT\s+(\S+?)(?::\d+)?\s+HTTP\//.exec(line);
    if (connect) connectHost = connect[1]!.replace(/^\[|\]$/g, '');
    if (/^<\s*x-proxy-error:\s*blocked-by-/i.test(line)) {
      if (connectHost) denials.push({ kind: 'network', text: networkDenialText(connectHost), boundary: null, destination: connectHost });
      else denials.push({ kind: 'sandbox', text: DENIAL_SANDBOX, boundary: null, destination: null });
    }
  }
  if (denials.length === 0 && /CONNECT tunnel failed, response 403/.test(output)) {
    denials.push({ kind: 'sandbox', text: DENIAL_SANDBOX, boundary: null, destination: null });
  }
  return denials;
}

function fileDenial(file: string, error: FileError, context: DenialContext): ToolDenial | null {
  const exists = context.exists ?? ((candidate: string) => fs.existsSync(candidate));
  const refused = (REFUSED as readonly string[]).includes(error);
  const boundaryOf = (kind: ReachBoundary['kind']) => context.boundaries.find((boundary) => boundary.kind === kind) ?? null;
  const within = inside(context.output, file) ? boundaryOf('output_folder') : inside(context.working, file) ? boundaryOf('working_folder') : null;
  if (within) {
    // Inside the Task folder: only a refused write to a read-only boundary is the sandbox's.
    if (refused && within.access === 'read') return { kind: 'filesystem', text: outsideDenialText(within.label), boundary: within.label, destination: null };
    if (error === 'Read-only file system') return { kind: 'sandbox', text: DENIAL_SANDBOX, boundary: null, destination: null };
    return null;
  }
  if (error === 'Read-only file system') {
    // Visible but mounted read only: the system locations.
    const system = boundaryOf('system');
    const label = system?.label ?? permittedText(context.boundaries);
    return { kind: 'filesystem', text: outsideDenialText(label), boundary: label, destination: null };
  }
  if (error === 'Operation not permitted' || (!refused && (exists(file) || exists(path.dirname(file))))) {
    // Refused outright, or hidden by the sandbox although it exists on this device.
    const label = permittedText(context.boundaries);
    return { kind: 'filesystem', text: outsideDenialText(label), boundary: label, destination: null };
  }
  return null;
}

/**
 * Translates a run's own output into denials. Nothing is reported for a
 * permitted run, an unbounded run, or an error the sandbox did not cause.
 */
export function translateDenials(result: ExecResult, context: DenialContext): ToolDenial[] {
  if (!context.bounded) return [];
  const denials = networkDenials(`${result.stdout}\n${result.stderr}`);
  for (const match of result.stderr.matchAll(FILE_ERROR)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    if (!raw) continue;
    const file = path.isAbsolute(raw) ? raw : path.resolve(context.working, raw);
    const denial = fileDenial(file, match[5] as FileError, context);
    if (denial) denials.push(denial);
  }
  if (denials.length === 0 && result.exitCode !== 0 && /^bwrap:/m.test(result.stderr)) {
    denials.push({ kind: 'sandbox', text: DENIAL_SANDBOX, boundary: null, destination: null });
  }
  const seen = new Set<string>();
  return denials.filter((denial) => (seen.has(denial.text) ? false : (seen.add(denial.text), true)));
}

// ---- escalation ------------------------------------------------------------------

/** The runtime's requests that ask before an action. */
export const ESCALATION_METHODS = [
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/permissions/requestApproval',
  'execCommandApproval',
  'applyPatchApproval',
] as const;
export type EscalationMethod = (typeof ESCALATION_METHODS)[number];

/** A pending authorization request: declined, or routed to the person (Story 1.20). */
export interface PendingAuthorization {
  id: string;
  method: EscalationMethod;
  threadId: string | null;
  status: 'declined' | 'pending' | 'allowed';
  /** The denial text, with the boundary or destination named. */
  reason: string;
  receivedAt: string;
}

/** The permission path for a thread's Task (Story 1.20): asks the person and resolves with the outcome. */
export interface EscalationRoute {
  ask(command: readonly string[]): Promise<'allowed' | 'denied' | 'expired'>;
}

export interface EscalationGateOptions {
  /** The permitted boundaries of the Task that owns a thread, when known. */
  boundaryFor?: (threadId: string | null) => string | null;
  /** The permission path of the Task that owns a thread, when known. */
  routeFor?: (threadId: string | null) => EscalationRoute | null;
  now?: () => Date;
  newId: () => string;
}

const MAX_PENDING = 100;

/**
 * Answers every escalation the runtime raises: recorded as a pending
 * authorization request and declined, naming the boundary (or destination).
 * A declined escalation never ends the Task; the runtime continues with the
 * operation refused.
 */
export class EscalationGate {
  private readonly records: PendingAuthorization[] = [];

  constructor(private readonly options: EscalationGateOptions) {}

  handles(method: string): method is EscalationMethod {
    return (ESCALATION_METHODS as readonly string[]).includes(method);
  }

  /**
   * The runtime's answer to an escalation request, or undefined for any
   * other request. A command escalation of a Task with a permission path is
   * answered later, once the person has decided.
   */
  answer(method: string, params: unknown): unknown {
    if (!this.handles(method)) return undefined;
    const p = (typeof params === 'object' && params !== null ? params : {}) as Record<string, unknown>;
    const threadId = typeof p.threadId === 'string' ? p.threadId : typeof p.conversationId === 'string' ? p.conversationId : null;
    const network = p.networkApprovalContext as { host?: unknown } | null | undefined;
    const host = network && typeof network.host === 'string' && network.host.length > 0 ? network.host : null;
    const boundary = this.options.boundaryFor?.(threadId) ?? null;
    const reason = host ? networkDenialText(host) : boundary ? outsideDenialText(boundary) : DENIAL_SANDBOX;
    const route = method === 'item/commandExecution/requestApproval' || method === 'execCommandApproval' ? (this.options.routeFor?.(threadId) ?? null) : null;
    const command = route ? commandOf(p.command) : null;
    const record: PendingAuthorization = { id: this.options.newId(), method, threadId, status: route && command ? 'pending' : 'declined', reason, receivedAt: (this.options.now?.() ?? new Date()).toISOString() };
    this.records.push(record);
    if (this.records.length > MAX_PENDING) this.records.splice(0, this.records.length - MAX_PENDING);
    if (route && command) {
      return route.ask(command).then(
        (outcome) => {
          record.status = outcome === 'allowed' ? 'allowed' : 'declined';
          if (outcome === 'allowed') return method === 'execCommandApproval' ? { decision: 'approved' } : { decision: 'accept' };
          return declined(method, reason);
        },
        () => {
          record.status = 'declined';
          return declined(method, reason);
        },
      );
    }
    return declined(method, reason);
  }

  /** The recorded requests, newest last. */
  pending(): readonly PendingAuthorization[] {
    return this.records.map((record) => ({ ...record }));
  }
}

/** A command escalation's argv: the runtime's own list, or its command line split on spaces. */
function commandOf(value: unknown): string[] | null {
  if (Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === 'string')) return value as string[];
  if (typeof value === 'string' && value.trim() !== '') return value.trim().split(/\s+/);
  return null;
}

/** The runtime's decline for each escalation method. */
function declined(method: EscalationMethod, reason: string): unknown {
  switch (method) {
    case 'item/permissions/requestApproval':
      return { permissions: {}, scope: 'turn' };
    case 'execCommandApproval':
    case 'applyPatchApproval':
      return { decision: { denied: { rejection: reason } } };
    default:
      return { decision: 'decline' };
  }
}
