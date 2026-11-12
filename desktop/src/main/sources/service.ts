/**
 * Attached material for a Task (Story 2.1), main process only.
 *
 * - `attach` opens the system file or folder dialog (main chooses; the
 *   renderer never supplies a path) and inventories the choice.
 * - `stage` copies the attached files and the evidence skill into the Task
 *   folder (the Linux guest Task folder, or the Windows one under Full
 *   access) and examines them in the Task's sandbox with the skill's
 *   `inventory`. Staging needs the Task to be idle: a running turn holds the
 *   Task folder, and the staging is refused rather than raced.
 * - `stageIdle` is the renderer's path for an existing Task: it proves the
 *   Task through an authorized progress read and refuses while a turn runs.
 * - `startTask` is the Task-start path (`stageBeforeFirstTurn`): the material
 *   and the skill are written as one transfer manifest for the guest broker,
 *   and the runtime stages it into the new Task folder before the first turn.
 *   A start whose material could not be staged does not start the turn; the
 *   attachments stay held so the person can send again. The sandbox inventory
 *   for Coverage runs once that first turn has ended (a running turn holds the
 *   Task folder); until then Coverage says the files are not yet examined.
 * - `references` verifies an answer's citations by re-reading each location
 *   in the sandbox, retains verified extracts and returns the Coverage facts;
 *   `view` does that for every completed agent message of a Task.
 *
 * Everything is gated by the `source-extracts` data-policy category: when its
 * rules are unknown or it is disabled, attaching is unavailable with the
 * blocking reason.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { categoryById, ruleBlockers, type PolicyLoad } from '../data/policy';
import { validateTransfer, type Entry } from '../runtime/wsl-tasks';
import { terminalProgress } from '../tasks/progress';
import type { StartedTaskView, TasksResult } from '../tasks/types';
import { attachmentView, AttachRefused, inventoryAttachment, mergeEntries, readerDigests, stageIntoTask, stagingEntries, type Attachment, type AttachmentView, type StagingTarget } from './attachments';
import { formatOf, locationLabel, parseCitations, parseMarkers, type CitationProblem, type ComputedMarker, type InferenceMarker } from './citations';
import { coverage, parseSandboxInventory, type CoverageView, type SandboxFile } from './coverage';
import { ExtractStore, principalKey, type RetainedExtract, type TaskSourceRecord } from './store';
import { CHECK_NOT_RUN, VERIFY_BOOT, verifyCitations, type ReferenceView, type RunInTask, type ToolRun } from './verify';
import type { WslTasks } from '../runtime/wsl-tasks';

export type SourcesResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export interface SourcesLogger { info(message: string): void; warn(message: string): void }
/** A Task's run status and its completed agent messages, from an authorized progress read. */
export interface TaskTurnState { status: string; messages: Array<{ itemId: string; text: string }> }
export interface SourcesServiceOptions {
  userData: string;
  skillRoot: string;
  principalId(): string | null;
  choose(kind: 'files' | 'folder'): Promise<{ files: string[]; folders: string[] } | null>;
  runTool(taskId: string, argv: string[], options: { timeoutMs?: number }): Promise<{ ok: true; value: ToolRun } | { ok: false; reason: string }>;
  stagingTarget(taskId: string): StagingTarget;
  /** The `source-extracts` category's state in the shipped register. */
  policyGate(): { ok: true } | { ok: false; reason: string };
  /** The Task's current run status and completed agent messages; null when the Task cannot be read for this person. */
  taskState?(taskId: string, workspaceId: string): Promise<TaskTurnState | null>;
  /**
   * Where a Task start's transfer manifest is written for the runtime to stage
   * before the first turn (`<profile storage>\material\<operationId>.json`, a
   * private folder); null when this device cannot stage at Task start.
   */
  startMaterial?(operationId: string): string | null;
  /** Something about a Task's attached material changed (staged at start, or examined in the sandbox). */
  onChanged?(taskId: string): void;
  logger: SourcesLogger;
}
export interface ReferencesView { references: ReferenceView[]; problems: CitationProblem[]; computed: ComputedMarker[]; inferences: InferenceMarker[]; coverage: CoverageView | null; retained: number }
/** A reference with where its directive sits in the message text, so the renderer can place it. */
export interface MarkedReference extends ReferenceView { start: number; end: number; raw: string }
export interface MessageReferences {
  itemId: string;
  /** `waiting`: the turn is still running and nothing was checked yet; never shown as verified. */
  state: 'checked' | 'waiting';
  references: MarkedReference[];
  problems: CitationProblem[];
  computed: ComputedMarker[];
  inferences: InferenceMarker[];
}
export interface AttachedSummary { attachmentId: string; label: string; kind: 'folder' | 'files'; files: number }
export interface SourcesView {
  /** Whether attaching is available under the data policy, and why not. */
  available: boolean;
  reason: string | null;
  attachments: AttachedSummary[];
  coverage: CoverageView | null;
  /** Material staged at Task start that could not be examined in the sandbox afterwards, in plain words. */
  problem: string | null;
  /** The visible note that tells the agent where the material is and how to read it; null without attachments. */
  note: string | null;
  messages: MessageReferences[];
}
export type StageOutcome = { state: 'staged'; attachment: AttachmentView; coverage: CoverageView; note: string };

export const SOURCES_REASONS = {
  signedOut: 'Sign in to attach material.',
  unknown: 'This attachment is no longer available. Attach the material again.',
  busy: 'The Task is running. Attach material after the current turn finishes; nothing was staged.',
  uncertain: 'The outcome of the Task’s last turn is uncertain, so nothing was staged. Attach material once the Task has been resumed and its turn has finished.',
  stageFailed: 'The attached material could not be staged in the Task folder. Nothing in the original files changed.',
  nothingStaged: 'None of the chosen files can be attached.',
  taskUnavailable: 'This Task cannot be read right now, so nothing was staged. Try again when the conversation is shown.',
  startUnavailable: 'Attaching material when a Task starts needs the Linux Task sandbox, which this device does not use. Send without it, then attach it between turns. Your draft is preserved.',
  startFailed: 'The attached material could not be prepared for the Task folder, so nothing was sent. Your draft and attachments are preserved.',
  notExamined: 'The attached material is in the Task folder, but it could not be examined in the sandbox, so Coverage counts only what was attached.',
} as const;
export const SOURCES_CATEGORY = 'source-extracts';

/** The visible note added to the request, so the agent knows where the material is and how to read it. Mirrored in `renderer/Shell/sources-bridge.ts`. */
export function sourcesNote(labels: readonly string[]): string {
  return `Attached material (${labels.join('; ')}) is in the Task folder under attached/. Read it with the evidence skill in skills/inquello-evidence/SKILL.md and cite what you rely on.`;
}

/** Attaching needs the `source-extracts` category enabled with every rule known. */
export function sourcesPolicyGate(load: PolicyLoad): { ok: true } | { ok: false; reason: string } {
  if (!load.ok) return { ok: false, reason: 'Attaching is unavailable: the local data policy did not load.' };
  const category = categoryById(load.policy, SOURCES_CATEGORY);
  if (!category) return { ok: false, reason: 'Attaching is unavailable: the local data policy has no rule for source references and extracts.' };
  if (!category.enabled) return { ok: false, reason: `Attaching is unavailable: ${category.label} is not enabled in the local data policy.` };
  const blocker = ruleBlockers({ ...load.policy, categories: [category] })[0];
  return blocker ? { ok: false, reason: `Attaching is unavailable: ${blocker.detail}.` } : { ok: true };
}

const MARKER = /:inquello-(?:source|computed|inference)\{/;
const CACHE_LIMIT = 256;
/** A failed examination of staged material is retried after this long, or sooner when the Task's status changes. */
export const EXAMINE_RETRY_MS = 60_000;
/**
 * A Task whose turn has ended. `uncertain` is not settled here: its turn may still hold the Task folder or produce
 * output, so nothing is staged, examined or verified until it is resumed or reconciled.
 */
export const settledProgress = (status: string): boolean => terminalProgress(status) && status !== 'uncertain';

/** Removes every start-time manifest left in a material folder (each is a full copy of the material); returns how many. */
export function removeStartManifests(folder: string): number {
  let names: string[];
  try { names = fs.readdirSync(folder); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
  let removed = 0;
  for (const name of names) { const file = path.join(folder, name); try { if (fs.lstatSync(file).isFile()) { fs.rmSync(file, { force: true }); removed++; } } catch { /* the next start retries */ } }
  return removed;
}

export class SourcesService {
  private readonly pending = new Map<string, { principal: string; attachment: Attachment }>();
  /** Task starts whose outcome was uncertain: recorded on the Task once reconciliation confirms it. */
  private readonly inDoubt = new Map<string, { principal: string; attachmentIds: string[]; views: AttachmentView[]; stagedAt: string }>();
  /** Staged material not yet examined in the sandbox is examined once its Task is idle; a failed examination is retried after `EXAMINE_RETRY_MS` or when the Task's status changes. */
  private readonly examining = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, { at: number; status: string }>();
  private readonly checked = new Map<string, MessageReferences>();
  private readonly checking = new Map<string, Promise<MessageReferences>>();
  readonly store: ExtractStore;
  constructor(private readonly options: SourcesServiceOptions) { this.store = new ExtractStore(options.userData); }

  private principal(): string | null { return this.options.principalId(); }

  async attach(kind: 'files' | 'folder'): Promise<SourcesResult<AttachmentView | null>> {
    const gate = this.options.policyGate();
    if (!gate.ok) return gate;
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const chosen = await this.options.choose(kind);
    if (!chosen || (chosen.files.length === 0 && chosen.folders.length === 0)) return { ok: true, value: null };
    let attachment: Attachment;
    try { attachment = inventoryAttachment(chosen); } catch (error) {
      if (error instanceof AttachRefused) return { ok: false, reason: error.message };
      this.options.logger.warn(`sources: the chosen material could not be inventoried (${(error as NodeJS.ErrnoException).code ?? 'error'})`);
      return { ok: false, reason: 'The chosen material could not be read. Nothing was attached.' };
    }
    if (attachment.files.length === 0) return { ok: false, reason: SOURCES_REASONS.nothingStaged };
    if (principal !== this.principal()) return { ok: false, reason: SOURCES_REASONS.signedOut };
    this.pending.set(attachment.attachmentId, { principal, attachment });
    if (this.pending.size > 32) this.pending.delete(this.pending.keys().next().value!);
    return { ok: true, value: attachmentView(attachment) };
  }

  discard(attachmentId: string): SourcesResult<{ discarded: boolean }> {
    const principal = this.principal();
    const held = this.pending.get(attachmentId);
    if (!held || held.principal !== principal) return { ok: true, value: { discarded: false } };
    return { ok: true, value: { discarded: this.pending.delete(attachmentId) } };
  }

  private runner(taskId: string, timeoutMs = 120_000): RunInTask {
    return async (argv) => this.options.runTool(taskId, argv, { timeoutMs });
  }

  /** Stages one pending attachment into an idle Task and examines it in the sandbox. */
  async stage(taskId: string, attachmentId: string): Promise<SourcesResult<{ attachment: AttachmentView; coverage: CoverageView }>> {
    const principal = this.principal();
    const held = this.pending.get(attachmentId);
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    if (!held || held.principal !== principal) return { ok: false, reason: SOURCES_REASONS.unknown };
    const result = await this.stageAttachment(taskId, principal, held.attachment);
    if (result.ok) this.pending.delete(attachmentId);
    return result;
  }

  private async stageAttachment(taskId: string, principal: string, held: Attachment): Promise<SourcesResult<{ attachment: AttachmentView; coverage: CoverageView }>> {
    const gate = this.options.policyGate();
    if (!gate.ok) return gate;
    const { entries, changed } = stagingEntries(held, this.options.skillRoot);
    const attachment: Attachment = { ...held, files: held.files.filter(file => !changed.some(item => item.relative === file.relative)), notSearched: [...held.notSearched, ...changed] };
    if (changed.length) attachment.incomplete = [...attachment.incomplete, `${changed.length} file(s) changed after they were attached and were not staged.`];
    try { await stageIntoTask(this.options.stagingTarget(taskId), taskId, entries); }
    catch (error) {
      this.options.logger.warn(`sources: staging failed (${(error as Error).message.slice(0, 200)})`);
      return { ok: false, reason: /lock|busy|Resource temporarily|transition|errno 11/i.test((error as Error).message) ? SOURCES_REASONS.busy : SOURCES_REASONS.stageFailed };
    }
    if (principal !== this.principal()) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const view = attachmentView(attachment);
    const record = this.store.task(principal, taskId);
    const attachments = [...(record?.attachments ?? []).filter(item => item.attachmentId !== view.attachmentId), view];
    const inventory = await this.examine(taskId);
    this.store.saveTask(principal, { version: 1, taskId, attachments, inventory, stagedAt: new Date().toISOString() });
    this.failures.delete(taskId);
    this.options.logger.info(`sources: staged ${view.files.length} file(s) into a Task`);
    return { ok: true, value: { attachment: view, coverage: coverage(attachments, inventory) } };
  }

  /** The renderer's path for an existing Task: the Task must be readable for this person and idle. */
  async stageIdle(taskId: string, workspaceId: string, attachmentId: string): Promise<SourcesResult<StageOutcome>> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const state = await this.taskState(taskId, workspaceId);
    if (!state) return { ok: false, reason: SOURCES_REASONS.taskUnavailable };
    if (state.status === 'uncertain') return { ok: false, reason: SOURCES_REASONS.uncertain };
    if (!settledProgress(state.status)) return { ok: false, reason: SOURCES_REASONS.busy };
    const staged = await this.stage(taskId, attachmentId);
    if (!staged.ok) return staged;
    this.options.onChanged?.(taskId);
    return { ok: true, value: { state: 'staged', attachment: staged.value.attachment, coverage: staged.value.coverage, note: sourcesNote([staged.value.attachment.label]) } };
  }

  /**
   * Staging before a Task's first turn: the held attachments and the skill as
   * one transfer manifest (the broker's `replace` entries, with the same
   * bounds the between-turns staging uses), written privately for this
   * operation. Returns the manifest's digest, which the start request carries.
   */
  stageBeforeFirstTurn(operationId: string, attachmentIds: readonly string[]): SourcesResult<{ file: string; sha256: string; attachments: Attachment[] }> {
    const gate = this.options.policyGate();
    if (!gate.ok) return gate;
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const ids = [...new Set(attachmentIds)];
    const held = ids.map(id => this.pending.get(id));
    if (!ids.length || held.some(item => !item || item.principal !== principal)) return { ok: false, reason: SOURCES_REASONS.unknown };
    let file: string | null;
    try { file = this.options.startMaterial?.(operationId) ?? null; } catch (error) {
      this.options.logger.warn(`sources: the start material folder is unavailable (${(error as Error).message.slice(0, 200)})`);
      return { ok: false, reason: SOURCES_REASONS.startFailed };
    }
    if (!file) return { ok: false, reason: SOURCES_REASONS.startUnavailable };
    let entries: Entry[] = [];
    const attachments: Attachment[] = [];
    for (const item of held) {
      const staged = stagingEntries(item!.attachment, this.options.skillRoot);
      const attachment: Attachment = { ...item!.attachment, files: item!.attachment.files.filter(entry => !staged.changed.some(changed => changed.relative === entry.relative)), notSearched: [...item!.attachment.notSearched, ...staged.changed] };
      if (staged.changed.length) attachment.incomplete = [...attachment.incomplete, `${staged.changed.length} file(s) changed after they were attached and were not staged.`];
      attachments.push(attachment);
      entries = mergeEntries(entries, staged.entries);
    }
    try {
      validateTransfer(entries);
      const bytes = Buffer.from(JSON.stringify(entries));
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomUUID()}.tmp`;
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, file);
      return { ok: true, value: { file, sha256: createHash('sha256').update(bytes).digest('hex'), attachments } };
    } catch (error) {
      this.options.logger.warn(`sources: the start material could not be prepared (${(error as Error).message.slice(0, 200)})`);
      try { fs.rmSync(file, { force: true }); } catch { /* not a file we wrote */ }
      return { ok: false, reason: SOURCES_REASONS.startFailed };
    }
  }

  /**
   * Starts a Task with attached material in its folder before the first turn.
   * `start` sends the Task start with the manifest's digest; the manifest is
   * removed once the runtime has answered. The attachments are recorded on the
   * Task only when the runtime set it up (any outcome but `setup-failed`); a
   * refused or setup-failed start leaves them held for a new Send, and an
   * uncertain one is recorded when reconciliation confirms the Task.
   */
  async startTask(operationId: string, attachmentIds: readonly string[], start: (material: { sha256: string }) => Promise<TasksResult<StartedTaskView>>): Promise<TasksResult<StartedTaskView>> {
    const principal = this.principal();
    const prepared = this.stageBeforeFirstTurn(operationId, attachmentIds);
    if (!prepared.ok || !principal) return { ok: false, code: 'refused', reason: prepared.ok ? SOURCES_REASONS.signedOut : prepared.reason };
    const ids = [...new Set(attachmentIds)];
    let result: TasksResult<StartedTaskView>;
    try { result = await start({ sha256: prepared.value.sha256 }); }
    finally { fs.rmSync(prepared.value.file, { force: true }); }
    const views = prepared.value.attachments.map(attachmentView);
    const stagedAt = new Date().toISOString();
    if (result.ok) this.recordStarted(principal, result.value, ids, views, stagedAt);
    else if (result.code === 'uncertain') {
      this.inDoubt.set(operationId, { principal, attachmentIds: ids, views, stagedAt });
      if (this.inDoubt.size > 32) this.inDoubt.delete(this.inDoubt.keys().next().value!);
    }
    return result;
  }

  /** A Task start reconciled after an uncertain outcome: records its material if the runtime set the Task up. */
  reconciled(operationId: string, result: TasksResult<StartedTaskView>): void {
    const entry = this.inDoubt.get(operationId);
    if (!entry || !result.ok || result.value.operationId !== operationId) return;
    this.inDoubt.delete(operationId);
    if (entry.principal === this.principal()) this.recordStarted(entry.principal, result.value, entry.attachmentIds, entry.views, entry.stagedAt);
  }

  private recordStarted(principal: string, started: StartedTaskView, attachmentIds: string[], views: AttachmentView[], stagedAt: string): void {
    // A setup failure happened before the first turn; the material may not be in any usable Task. Keep it held.
    if (started.status === 'setup-failed' || principal !== this.principal()) return;
    for (const id of attachmentIds) if (this.pending.get(id)?.principal === principal) this.pending.delete(id);
    const record = this.store.task(principal, started.taskId);
    const attachments = [...(record?.attachments ?? []).filter(item => !views.some(view => view.attachmentId === item.attachmentId)), ...views];
    this.store.saveTask(principal, { version: 1, taskId: started.taskId, attachments, inventory: null, stagedAt });
    this.failures.delete(started.taskId);
    this.options.logger.info(`sources: staged ${views.reduce((sum, view) => sum + view.files.length, 0)} file(s) into a Task before its first turn`);
    this.options.onChanged?.(started.taskId);
  }

  /** Examines material staged at Task start once the Task is idle (the running first turn holds the Task folder). */
  private examineStarted(principal: string, taskId: string, status: string): Promise<void> {
    const running = this.examining.get(taskId);
    if (running) return running;
    const work = (async () => {
      const inventory = await this.examine(taskId);
      const record = this.store.task(principal, taskId);
      if (!record || principal !== this.principal()) return;
      if (inventory) this.store.saveTask(principal, { ...record, inventory });
      else this.failures.set(taskId, { at: Date.now(), status });
      this.options.onChanged?.(taskId);
    })().finally(() => this.examining.delete(taskId));
    this.examining.set(taskId, work);
    return work;
  }

  /** Whether examining the Task's material failed recently; a failure is forgotten after `EXAMINE_RETRY_MS` or when the status changed. */
  private failed(taskId: string, status: string): boolean {
    const failure = this.failures.get(taskId);
    if (!failure) return false;
    if (failure.status === status && Date.now() - failure.at < EXAMINE_RETRY_MS) return true;
    this.failures.delete(taskId);
    return false;
  }

  private async taskState(taskId: string, workspaceId: string): Promise<TaskTurnState | null> {
    try { return (await this.options.taskState?.(taskId, workspaceId)) ?? null; } catch { return null; }
  }

  /** The skill's own inventory of everything staged, run in the Task's sandbox. Null when it could not run. */
  private async examine(taskId: string): Promise<SandboxFile[] | null> {
    const digests = readerDigests(this.options.skillRoot);
    const result = await this.runner(taskId)(['/usr/bin/python3', '-I', '-c', VERIFY_BOOT, JSON.stringify(digests), 'inventory', 'attached', '--json']);
    if (!result.ok || result.value.exitCode !== 0) { this.options.logger.warn('sources: the sandbox inventory did not run'); return null; }
    try { return parseSandboxInventory(result.value.stdout); } catch { return null; }
  }

  coverage(taskId: string): SourcesResult<CoverageView | null> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const record = this.store.task(principal, taskId);
    return { ok: true, value: record ? coverage(record.attachments, Array.isArray(record.inventory) ? record.inventory as SandboxFile[] : null) : null };
  }

  /** Verifies an answer's references in the sandbox and retains the verified extracts. */
  async references(taskId: string, answer: string): Promise<SourcesResult<ReferencesView>> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const { citations, problems } = parseCitations(answer);
    const { computed, inferences } = parseMarkers(answer);
    const record = this.store.task(principal, taskId);
    if (citations.length === 0) return { ok: true, value: { references: [], problems, computed, inferences, coverage: record ? coverage(record.attachments, record.inventory as SandboxFile[] | null) : null, retained: 0 } };
    const files = record?.attachments.flatMap(item => item.files) ?? [];
    const merged: AttachmentView | null = record ? { ...record.attachments[0]!, files } : null;
    const references = await verifyCitations(citations, merged, readerDigests(this.options.skillRoot), this.runner(taskId));
    if (principal !== this.principal()) return { ok: false, reason: SOURCES_REASONS.signedOut };
    let retained = 0;
    const gate = this.options.policyGate();
    if (gate.ok) for (const view of references) if (this.store.retain(principal, taskId, view)) retained++;
    return { ok: true, value: { references, problems, computed, inferences, coverage: record ? coverage(record.attachments, record.inventory as SandboxFile[] | null) : null, retained } };
  }

  /** One agent message's references: verified once the turn has ended, then kept for this staged state of the Task. */
  private async messageReferences(principal: string, taskId: string, message: { itemId: string; text: string }, status: string, record: TaskSourceRecord | null): Promise<MessageReferences> {
    const idle = settledProgress(status);
    const key = JSON.stringify([principalKey(principal), taskId, message.itemId, createHash('sha256').update(message.text).digest('hex'), record?.stagedAt ?? '']);
    const cached = this.checked.get(key);
    if (cached) return cached;
    const { citations, problems } = parseCitations(message.text);
    const { computed, inferences } = parseMarkers(message.text);
    const mark = (views: ReferenceView[]): MarkedReference[] => views.map(view => ({ ...view, start: citations[view.index]!.start, end: citations[view.index]!.end, raw: citations[view.index]!.raw }));
    const unchecked = (reason: string): ReferenceView[] => citations.map((citation, index) => ({ index, id: citation.id, at: citation.at, quote: citation.quote, format: formatOf(citation.id), location: locationLabel(formatOf(citation.id), citation.at), status: 'unverified', reason, file: null, extract: null }));
    if (citations.length === 0 || !idle) {
      return { itemId: message.itemId, state: citations.length > 0 ? 'waiting' : 'checked', references: mark(unchecked(status === 'uncertain' ? 'Not yet checked: the outcome of the turn is uncertain' : 'Not yet checked: the turn is still running')), problems, computed, inferences };
    }
    let running = this.checking.get(key);
    if (!running) {
      running = (async () => {
        const result = await this.references(taskId, message.text);
        const value: MessageReferences = { itemId: message.itemId, state: 'checked', references: mark(result.ok ? result.value.references : unchecked(`${CHECK_NOT_RUN}: ${result.reason}`)), problems, computed, inferences };
        // Only a check that ran is kept: when the sandbox, a timeout or the script stopped it, the next view checks again.
        if (result.ok && !result.value.references.some(view => view.reason?.startsWith(CHECK_NOT_RUN))) { this.checked.set(key, value); if (this.checked.size > CACHE_LIMIT) this.checked.delete(this.checked.keys().next().value!); }
        return value;
      })().finally(() => this.checking.delete(key));
      this.checking.set(key, running);
    }
    return running;
  }

  /** Everything the Task's conversation shows about its attached material, for the signed-in creator only. */
  async view(taskId: string, workspaceId: string): Promise<SourcesResult<SourcesView>> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const gate = this.options.policyGate();
    let record = this.store.task(principal, taskId);
    const state = await this.taskState(taskId, workspaceId);
    const messages: MessageReferences[] = [];
    if (state) {
      const idle = settledProgress(state.status);
      // Material staged at Task start is examined once the first turn has ended.
      // Checked on every view, so a status seen while a turn runs clears an earlier failure.
      const recentFailure = this.failed(taskId, state.status);
      if (idle && record && record.inventory === null && !recentFailure) { await this.examineStarted(principal, taskId, state.status); record = this.store.task(principal, taskId); }
      for (const message of state.messages.slice(-64)) if (MARKER.test(message.text)) messages.push(await this.messageReferences(principal, taskId, message, state.status, record));
    }
    if (principal !== this.principal()) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const attachments: AttachedSummary[] = (record?.attachments ?? []).map(item => ({ attachmentId: item.attachmentId, label: item.label, kind: item.files.some(file => file.relative.includes('/')) || item.notSearched.some(file => file.relative.includes('/')) ? 'folder' : 'files', files: item.files.length }));
    return { ok: true, value: {
      available: gate.ok, reason: gate.ok ? null : gate.reason, attachments,
      coverage: record ? coverage(record.attachments, Array.isArray(record.inventory) ? record.inventory as SandboxFile[] : null) : null,
      problem: record && record.inventory === null && this.failures.has(taskId) ? SOURCES_REASONS.notExamined : null,
      note: attachments.length ? sourcesNote(attachments.map(item => item.label)) : null, messages,
    } };
  }

  /** Forgets checked references held in memory, after the category was deleted or imported. */
  forgetChecked(): void { this.checked.clear(); }

  extracts(taskId: string): SourcesResult<RetainedExtract[]> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    return { ok: true, value: this.store.extracts(principal, taskId) };
  }

  deleteTask(taskId: string): SourcesResult<{ removed: number; remaining: number }> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    this.forgetChecked();
    return { ok: true, value: this.store.deleteTask(principal, taskId) };
  }
}

/** The Task's Linux guest folder through the existing transfer broker. The broker takes the Task lock without waiting, so a running turn refuses staging. */
export function wslStagingTarget(tasks: Pick<WslTasks, 'broker'>): StagingTarget {
  return {
    async snapshot(taskId) { const result = await tasks.broker(taskId, { action: 'snapshot' }); if (!result.entries) throw new Error('Task snapshot missing'); return result.entries; },
    async replace(taskId, entries) { await tasks.broker(taskId, { action: 'replace', entries }); },
  };
}
