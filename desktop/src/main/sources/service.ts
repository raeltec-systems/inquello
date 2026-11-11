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
 * - `references` verifies an answer's citations by re-reading each location
 *   in the sandbox, retains verified extracts and returns the Coverage facts.
 *
 * Everything is gated by the `source-extracts` data-policy category: when its
 * rules are unknown or it is disabled, attaching is unavailable with the
 * blocking reason.
 */
import { attachmentView, AttachRefused, inventoryAttachment, readerDigests, stageIntoTask, stagingEntries, type Attachment, type AttachmentView, type StagingTarget } from './attachments';
import { parseCitations, parseMarkers, type CitationProblem, type ComputedMarker, type InferenceMarker } from './citations';
import { coverage, parseSandboxInventory, type CoverageView, type SandboxFile } from './coverage';
import { ExtractStore, type RetainedExtract } from './store';
import { VERIFY_BOOT, verifyCitations, type ReferenceView, type RunInTask, type ToolRun } from './verify';
import type { WslTasks } from '../runtime/wsl-tasks';

export type SourcesResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export interface SourcesLogger { info(message: string): void; warn(message: string): void }
export interface SourcesServiceOptions {
  userData: string;
  skillRoot: string;
  principalId(): string | null;
  choose(kind: 'files' | 'folder'): Promise<{ files: string[]; folders: string[] } | null>;
  runTool(taskId: string, argv: string[], options: { timeoutMs?: number }): Promise<{ ok: true; value: ToolRun } | { ok: false; reason: string }>;
  stagingTarget(taskId: string): StagingTarget;
  /** The `source-extracts` category's state in the shipped register. */
  policyGate(): { ok: true } | { ok: false; reason: string };
  logger: SourcesLogger;
}
export interface ReferencesView { references: ReferenceView[]; problems: CitationProblem[]; computed: ComputedMarker[]; inferences: InferenceMarker[]; coverage: CoverageView | null; retained: number }

export const SOURCES_REASONS = {
  signedOut: 'Sign in to attach material.',
  unknown: 'This attachment is no longer available. Attach the material again.',
  busy: 'The Task is running. Attach material after the current turn finishes; nothing was staged.',
  stageFailed: 'The attached material could not be staged in the Task folder. Nothing in the original files changed.',
  nothingStaged: 'None of the chosen files can be attached.',
} as const;

export class SourcesService {
  private readonly pending = new Map<string, { principal: string; attachment: Attachment }>();
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

  discard(attachmentId: string): SourcesResult<{ discarded: boolean }> { return { ok: true, value: { discarded: this.pending.delete(attachmentId) } }; }

  private runner(taskId: string, timeoutMs = 120_000): RunInTask {
    return async (argv) => this.options.runTool(taskId, argv, { timeoutMs });
  }

  /** Stages one pending attachment into an idle Task and examines it in the sandbox. */
  async stage(taskId: string, attachmentId: string): Promise<SourcesResult<{ attachment: AttachmentView; coverage: CoverageView }>> {
    const gate = this.options.policyGate();
    if (!gate.ok) return gate;
    const principal = this.principal();
    const held = this.pending.get(attachmentId);
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    if (!held || held.principal !== principal) return { ok: false, reason: SOURCES_REASONS.unknown };
    const { entries, changed } = stagingEntries(held.attachment, this.options.skillRoot);
    const attachment: Attachment = { ...held.attachment, files: held.attachment.files.filter(file => !changed.some(item => item.relative === file.relative)), notSearched: [...held.attachment.notSearched, ...changed] };
    if (changed.length) attachment.incomplete = [...attachment.incomplete, `${changed.length} file(s) changed after they were attached and were not staged.`];
    try { await stageIntoTask(this.options.stagingTarget(taskId), taskId, entries); }
    catch (error) {
      this.options.logger.warn(`sources: staging failed (${(error as Error).message.slice(0, 200)})`);
      return { ok: false, reason: /lock|busy|Resource temporarily|transition|errno 11/i.test((error as Error).message) ? SOURCES_REASONS.busy : SOURCES_REASONS.stageFailed };
    }
    this.pending.delete(attachmentId);
    const view = attachmentView(attachment);
    const record = this.store.task(principal, taskId);
    const attachments = [...(record?.attachments ?? []).filter(item => item.attachmentId !== view.attachmentId), view];
    const inventory = await this.examine(taskId);
    this.store.saveTask(principal, { version: 1, taskId, attachments, inventory, stagedAt: new Date().toISOString() });
    this.options.logger.info(`sources: staged ${view.files.length} file(s) into a Task`);
    return { ok: true, value: { attachment: view, coverage: coverage(attachments, inventory) } };
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

  extracts(taskId: string): SourcesResult<RetainedExtract[]> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
    return { ok: true, value: this.store.extracts(principal, taskId) };
  }

  deleteTask(taskId: string): SourcesResult<{ removed: number; remaining: number }> {
    const principal = this.principal();
    if (!principal) return { ok: false, reason: SOURCES_REASONS.signedOut };
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