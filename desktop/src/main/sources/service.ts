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
 * - `attachToNewTask` is the Task-start path. Files cannot be in the Task
 *   folder before the first turn yet (`stageBeforeFirstTurn`), so the staging
 *   waits until the first turn ends and the person is told so.
 * - `references` verifies an answer's citations by re-reading each location
 *   in the sandbox, retains verified extracts and returns the Coverage facts;
 *   `view` does that for every completed agent message of a Task.
 *
 * Everything is gated by the `source-extracts` data-policy category: when its
 * rules are unknown or it is disabled, attaching is unavailable with the
 * blocking reason.
 */
import { createHash } from 'node:crypto';

import { categoryById, ruleBlockers, type PolicyLoad } from '../data/policy';
import { terminalProgress } from '../tasks/progress';
import { attachmentView, AttachRefused, inventoryAttachment, readerDigests, stageIntoTask, stagingEntries, type Attachment, type AttachmentView, type StagingTarget } from './attachments';
import { formatOf, locationLabel, parseCitations, parseMarkers, type CitationProblem, type ComputedMarker, type InferenceMarker } from './citations';
import { coverage, parseSandboxInventory, type CoverageView, type SandboxFile } from './coverage';
import { ExtractStore, principalKey, type RetainedExtract, type TaskSourceRecord } from './store';
import { VERIFY_BOOT, verifyCitations, type ReferenceView, type RunInTask, type ToolRun } from './verify';
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
  /** Something about a Task's attached material changed (a deferred staging finished or failed). */
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
  /** Attached at Task start, staged once the first turn ends. */
  deferred: Array<{ attachmentId: string; label: string }>;
  /** A deferred staging that failed, in plain words. */
  problem: string | null;
  /** The visible note that tells the agent where the material is and how to read it; null without attachments. */
  note: string | null;
  messages: MessageReferences[];
}
export type StageOutcome =
  | { state: 'staged'; attachment: AttachmentView; coverage: CoverageView; note: string }
  | { state: 'deferred'; label: string; notice: string };

export const SOURCES_REASONS = {
  signedOut: 'Sign in to attach material.',
  unknown: 'This attachment is no longer available. Attach the material again.',
  busy: 'The Task is running. Attach material after the current turn finishes; nothing was staged.',
  stageFailed: 'The attached material could not be staged in the Task folder. Nothing in the original files changed.',
  nothingStaged: 'None of the chosen files can be attached.',
  taskUnavailable: 'This Task cannot be read right now, so nothing was staged. Try again when the conversation is shown.',
} as const;
/** Told to the person when material attached at Task start waits for the first turn to end. Mirrored in `renderer/Shell/sources-bridge.ts`. */
export const SOURCES_DEFERRED_NOTICE = 'Attached files become available to your next message, once this first turn finishes. The request you just sent cannot use them.';
/** Why files cannot be in the Task folder before the first turn (owner decision pending). */
export const STAGE_BEFORE_FIRST_TURN_UNAVAILABLE = 'The runtime starts a Task and its first turn in one step and refuses a Task folder that already holds files.';
export const SOURCES_CATEGORY = 'source-extracts';

/** The visible note added to the next request, so the agent knows where the material is and how to read it. */
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

export class SourcesService {
  private readonly pending = new Map<string, { principal: string; attachment: Attachment }>();
  private readonly deferred = new Map<string, { principal: string; workspaceId: string; attachments: Attachment[] }>();
  private readonly failures = new Map<string, { principal: string; text: string }>();
  private readonly checked = new Map<string, MessageReferences>();
  private readonly checking = new Map<string, Promise<MessageReferences>>();
  private flushing: Promise<void> | null = null;
  private flushAgain = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.options.logger.info(`sources: staged ${view.files.length} file(s) into a Task`);
    return { ok: true, value: { attachment: view, coverage: coverage(attachments, inventory) } };
  }

  /** The renderer's path for an existing Task: the Task must be readable for this person and idle. */
  async stageIdle(taskId: string, workspaceId: string, attachmentId: string): Promise<SourcesResult<StageOutcome>> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const state = await this.taskState(taskId, workspaceId);
    if (!state) return { ok: false, reason: SOURCES_REASONS.taskUnavailable };
    if (!terminalProgress(state.status)) return { ok: false, reason: SOURCES_REASONS.busy };
    const staged = await this.stage(taskId, attachmentId);
    if (!staged.ok) return staged;
    this.failures.delete(taskId);
    return { ok: true, value: { state: 'staged', attachment: staged.value.attachment, coverage: staged.value.coverage, note: sourcesNote([staged.value.attachment.label]) } };
  }

  /**
   * The seam for staging before a Task's first turn. `inquello/tasks/start`
   * creates the Task, sets up its folder and starts the first turn in one
   * engine call, and refuses a Task folder that already holds files, so this
   * is not possible yet. When the engine accepts a desktop-prepared staging,
   * this is the one place to implement it; `attachToNewTask` already calls it
   * first and only falls back to waiting when it reports unsupported.
   */
  stageBeforeFirstTurn(_taskId: string, _attachmentId: string): { supported: false; reason: string } {
    return { supported: false, reason: STAGE_BEFORE_FIRST_TURN_UNAVAILABLE };
  }

  /**
   * Material attached on the start view, for the Task that start just
   * created. Until files can be staged before the first turn, they are
   * staged as soon as that turn ends; the person is told plainly that the
   * request already sent cannot use them. Nothing pretends otherwise.
   */
  async attachToNewTask(taskId: string, workspaceId: string, attachmentId: string): Promise<SourcesResult<StageOutcome>> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const held = this.pending.get(attachmentId);
    if (!held || held.principal !== principal) return { ok: false, reason: SOURCES_REASONS.unknown };
    const early = this.stageBeforeFirstTurn(taskId, attachmentId);
    if (early.supported) return { ok: false, reason: early.reason };
    // Nothing is staged here: `flushOnce` stages only after an authorized progress read of this Task shows its turn has ended.
    const entry = this.deferred.get(taskId);
    if (entry && entry.principal === principal) { if (!entry.attachments.some(item => item.attachmentId === attachmentId)) entry.attachments.push(held.attachment); }
    else {
      if (this.deferred.size >= 32) return { ok: false, reason: 'Too many Tasks are waiting for attached material. Attach this material after the first turn finishes.' };
      this.deferred.set(taskId, { principal, workspaceId, attachments: [held.attachment] });
    }
    this.pending.delete(attachmentId);
    this.options.logger.info('sources: material attached at Task start waits for the first turn to end');
    this.scheduleFlush(0);
    return { ok: true, value: { state: 'deferred', label: held.attachment.label, notice: SOURCES_DEFERRED_NOTICE } };
  }

  /** Called when any Task's progress changed; stages waiting material once its Task is idle. */
  progressChanged(): void { if (this.deferred.size) this.scheduleFlush(); }

  private scheduleFlush(delayMs = 750): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flushDeferred(); }, delayMs);
    this.flushTimer.unref?.();
  }

  /** Stages every waiting attachment whose Task is now idle. Never runs twice at once. */
  flushDeferred(): Promise<void> {
    if (this.flushing) { this.flushAgain = true; return this.flushing; }
    this.flushing = (async () => { do { this.flushAgain = false; await this.flushOnce(); } while (this.flushAgain); })().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async flushOnce(): Promise<void> {
    const principal = this.principal();
    for (const [taskId, entry] of [...this.deferred]) {
      if (entry.principal !== principal) continue;
      const state = await this.taskState(taskId, entry.workspaceId);
      if (!state || !terminalProgress(state.status)) continue;
      let changed = false;
      for (const attachment of [...entry.attachments]) {
        const result = await this.stageAttachment(taskId, principal, attachment);
        if (!result.ok && result.reason === SOURCES_REASONS.busy) break;
        entry.attachments = entry.attachments.filter(item => item !== attachment);
        changed = true;
        if (!result.ok) this.failures.set(taskId, { principal, text: `${attachment.label} could not be attached after the first turn: ${result.reason}` });
      }
      if (entry.attachments.length === 0) this.deferred.delete(taskId);
      if (changed) this.options.onChanged?.(taskId);
    }
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
  private async messageReferences(principal: string, taskId: string, message: { itemId: string; text: string }, idle: boolean, record: TaskSourceRecord | null): Promise<MessageReferences> {
    const key = JSON.stringify([principalKey(principal), taskId, message.itemId, createHash('sha256').update(message.text).digest('hex'), record?.stagedAt ?? '']);
    const cached = this.checked.get(key);
    if (cached) return cached;
    const { citations, problems } = parseCitations(message.text);
    const { computed, inferences } = parseMarkers(message.text);
    const mark = (views: ReferenceView[]): MarkedReference[] => views.map(view => ({ ...view, start: citations[view.index]!.start, end: citations[view.index]!.end, raw: citations[view.index]!.raw }));
    const unchecked = (reason: string): ReferenceView[] => citations.map((citation, index) => ({ index, id: citation.id, at: citation.at, quote: citation.quote, format: formatOf(citation.id), location: locationLabel(formatOf(citation.id), citation.at), status: 'unverified', reason, file: null, extract: null }));
    if (citations.length === 0 || !idle) {
      return { itemId: message.itemId, state: citations.length > 0 ? 'waiting' : 'checked', references: mark(unchecked('Not yet checked: the turn is still running')), problems, computed, inferences };
    }
    let running = this.checking.get(key);
    if (!running) {
      running = (async () => {
        const result = await this.references(taskId, message.text);
        const value: MessageReferences = { itemId: message.itemId, state: 'checked', references: mark(result.ok ? result.value.references : unchecked(`The reference could not be checked: ${result.reason}`)), problems, computed, inferences };
        if (result.ok) { this.checked.set(key, value); if (this.checked.size > CACHE_LIMIT) this.checked.delete(this.checked.keys().next().value!); }
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
    const record = this.store.task(principal, taskId);
    const deferredEntry = this.deferred.get(taskId);
    const deferred = deferredEntry?.principal === principal ? deferredEntry.attachments.map(item => ({ attachmentId: item.attachmentId, label: item.label })) : [];
    if (deferred.length) this.scheduleFlush();
    const state = await this.taskState(taskId, workspaceId);
    const messages: MessageReferences[] = [];
    if (state) {
      const idle = terminalProgress(state.status);
      for (const message of state.messages.slice(-64)) if (MARKER.test(message.text)) messages.push(await this.messageReferences(principal, taskId, message, idle, record));
    }
    if (principal !== this.principal()) return { ok: false, reason: SOURCES_REASONS.signedOut };
    const failure = this.failures.get(taskId);
    const attachments: AttachedSummary[] = (record?.attachments ?? []).map(item => ({ attachmentId: item.attachmentId, label: item.label, kind: item.files.some(file => file.relative.includes('/')) || item.notSearched.some(file => file.relative.includes('/')) ? 'folder' : 'files', files: item.files.length }));
    return { ok: true, value: {
      available: gate.ok, reason: gate.ok ? null : gate.reason, attachments,
      coverage: record ? coverage(record.attachments, Array.isArray(record.inventory) ? record.inventory as SandboxFile[] : null) : null,
      deferred, problem: failure?.principal === principal ? failure.text : null,
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
