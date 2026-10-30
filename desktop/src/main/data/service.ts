/**
 * The main-process local data service behind the `data.*` operations.
 *
 * - `getPolicy` lists every register category with its owner, rule and held
 *   counts, and every real-data blocker (unknown rules, unclassified files,
 *   files in disabled categories, or a register that did not load).
 * - `exportData` asks main's save dialog for a new folder (the renderer never
 *   supplies a path), refuses active Tasks, stops the runtime so its SQLite
 *   database/WAL family is quiescent, writes and journals the export, and
 *   restarts the runtime even when copying fails.
 * - `importData` asks main's folder dialog for an export, refuses while a Task
 *   runs, stops the runtime, restores into an empty runtime home and restarts
 *   the runtime.
 * - `deleteData` refuses while a Task runs, signs out first when the identity
 *   session is chosen (falling back to local removal when the service cannot
 *   confirm, and cancelling a sign-in in progress either way), stops the
 *   runtime, removes the chosen categories and restarts the runtime. Deleting
 *   the Claude API key also clears it from the provider service (a
 *   memory-only key, or one a check in flight would restore); the deletion
 *   fails rather than report success while the key is still held. Exported
 *   copies are never touched; the report lists them.
 *
 * One action runs at a time. Every result is a fresh plain object holding
 * only the fields below, so nothing else crosses IPC.
 */
import type { Logger } from '../runtime/logger';
import { deleteCategories, DeleteError, validateDeletion, type DeleteReport } from './delete';
import { exportData, ExportError, type Attribution, type ManifestOmission } from './export';
import { importData, ImportError } from './import';
import { takeInventory, type GovernedRoots, type Inventory } from './inventory';
import type { ExportJournal } from './journal';
import { isStoreCategory, realDataBlockers, type BlockerKind, type DataPolicy, type PolicyLoad } from './policy';

export const IDENTITY_SESSION = 'identity-session';
export const CLAUDE_KEY_VAULT = 'claude-key-vault';

export interface RuntimeControl {
  /** Resolves only once all runtime writers have exited. The host serializes
   * initial startup/shutdown and reserves restart to this exclusive data action. */
  stop(): Promise<void>;
  /** Starts the runtime only after the exclusive data action finishes. */
  start(): Promise<void>;
  /** Tasks currently running in the runtime. */
  activeTasks(): number;
}

export interface IdentityControl {
  /** The signed-in principal for attribution, or null. */
  principal(): Promise<{ displayName: string; issuerLabel: string } | null>;
  /** Whether a session is held (signed in, or a sign-out is pending). */
  holdsSession(): boolean;
  /** The Story 1.10 sign-out; `ok` means the shared service confirmed it. */
  signOut(): Promise<{ ok: boolean }>;
  /** Drops the session locally (memory and file) without the service, and cancels a sign-in in progress. */
  forgetLocally(): void;
}

export interface ProviderControl {
  /** Removes the Claude API key from memory and disk; a check in flight cannot restore it. */
  forgetClaudeKey(): void;
  /** Whether a Claude API key is still held. */
  holdsClaudeKey(): boolean;
}

export interface DataServiceOptions {
  load: PolicyLoad;
  roots: GovernedRoots;
  journal: ExportJournal;
  runtime: RuntimeControl;
  identity: IdentityControl;
  providers: ProviderControl;
  chooseExportDestination(): Promise<string | null>;
  chooseImportSource(): Promise<string | null>;
  clearBrowserProfile(): Promise<void>;
  appVersion: string;
  runtimeVersion: string;
  logger: Logger;
}

export interface CategoryView {
  id: string;
  label: string;
  enabled: boolean;
  /** Files in a governed root, or an entry the OS credential store keeps (never deleted here). */
  location: 'files' | 'os-credential-store';
  owner: string;
  ruleOwner: string;
  retention: 'until-owner-deletes' | 'unknown';
  access: 'main-process-only' | 'runtime';
  export: { mode: 'included' | 'excluded' | 'unknown'; reason?: string };
  deletion: string;
  recovery: string;
  held: { files: number; bytes: number };
}

export interface BlockerView {
  kind: BlockerKind;
  category?: string;
  path?: string;
  detail: string;
}

export interface PolicyView {
  loaded: boolean;
  policyOwner: string | null;
  notice: string | null;
  categories: CategoryView[];
  blockers: BlockerView[];
}

export interface ExportReportView {
  path: string;
  createdAt: string;
  included: Array<{ category: string; label: string; files: number }>;
  omissions: Array<{ category: string | null; label: string; reason: string; files: number }>;
  notice: string;
  attribution: Attribution;
}

export interface ImportReportView {
  restored: Array<{ category: string; label: string; files: number }>;
  notRestored: Array<{ category: string; path: string; reason: string }>;
  omissions: Array<{ category: string | null; label: string; reason: string; files: number }>;
}

export type ServerRevocation = 'confirmed' | 'not-confirmed' | 'not-signed-in';

export interface DeleteReportView extends DeleteReport {
  serverRevocation?: ServerRevocation;
}

export type ExportActionResult = { ok: true; export: ExportReportView } | { ok: false; reason: string };
export type ImportActionResult = { ok: true; import: ImportReportView } | { ok: false; reason: string };
export type DeleteActionResult = { ok: true; delete: DeleteReportView } | { ok: false; reason: string };

export const DATA_REASONS = {
  busy: 'Another local data action is in progress.',
  cancelled: 'No folder was chosen.',
  policyInvalid: 'The local data policy did not load, so local data actions are blocked.',
  taskRunning: 'A Task is running. Stop it before importing or deleting local data.',
  exportTaskRunning: 'A Task is running. Stop it before exporting local data.',
  runtimeStop: 'The runtime could not be stopped safely. The local data action was not completed.',
  runtimeRestart: 'The local data action ran, but the runtime did not restart afterwards. Restart Inquello.',
} as const;

const omissionView = (omission: ManifestOmission) => ({ category: omission.category, label: omission.label, reason: omission.reason, files: omission.files });

export class DataService {
  private busy = false;

  constructor(private readonly options: DataServiceOptions) {}

  get policy(): DataPolicy | null {
    return this.options.load.ok ? this.options.load.policy : null;
  }

  /** Category ids `data.delete` accepts: enabled categories held in files. */
  deletableCategories(): string[] {
    return this.policy?.categories.filter((category) => category.enabled && !isStoreCategory(category)).map((category) => category.id) ?? [];
  }

  inventory(): Inventory | null {
    return this.policy ? takeInventory(this.policy, this.options.roots) : null;
  }

  getPolicy(): PolicyView {
    const policy = this.policy;
    if (!policy) {
      return { loaded: false, policyOwner: null, notice: null, categories: [], blockers: realDataBlockers(this.options.load).map(blockerView) };
    }
    const inventory = takeInventory(policy, this.options.roots);
    return {
      loaded: true,
      policyOwner: policy.policy_owner,
      notice: policy.notice,
      categories: policy.categories.map((category) => ({
        id: category.id,
        label: category.label,
        enabled: category.enabled,
        location: isStoreCategory(category) ? 'os-credential-store' : 'files',
        owner: category.owner,
        ruleOwner: category.rule_owner,
        retention: category.retention,
        access: category.access,
        export: category.export.mode === 'excluded' ? { mode: 'excluded', reason: category.export.reason } : { mode: category.export.mode },
        deletion: category.deletion,
        recovery: category.recovery,
        held: { files: inventory.held[category.id]!.files, bytes: inventory.held[category.id]!.bytes },
      })),
      blockers: realDataBlockers(this.options.load, inventory).map(blockerView),
    };
  }

  private async exclusive<T extends { ok: boolean }>(fn: () => Promise<T | { ok: false; reason: string }>): Promise<T | { ok: false; reason: string }> {
    if (this.busy) return { ok: false, reason: DATA_REASONS.busy };
    if (!this.policy) return { ok: false, reason: DATA_REASONS.policyInvalid };
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }

  exportData(): Promise<ExportActionResult> {
    return this.exclusive(async () => {
      if (this.options.runtime.activeTasks() > 0) return { ok: false, reason: DATA_REASONS.exportTaskRunning };
      const destination = await this.options.chooseExportDestination();
      if (!destination) return { ok: false, reason: DATA_REASONS.cancelled };
      // The chooser can stay open while another operation starts work.
      if (this.options.runtime.activeTasks() > 0) return { ok: false, reason: DATA_REASONS.exportTaskRunning };
      return this.withRuntimeStopped<ExportActionResult>(async () => {
        try {
          const result = await exportData({
            policy: this.policy!,
            roots: this.options.roots,
            destination,
            journal: this.options.journal,
            attribution: { principal: await this.options.identity.principal(), appVersion: this.options.appVersion, runtimeVersion: this.options.runtimeVersion },
          });
          const { manifest } = result;
          this.options.logger.info(`data: exported ${manifest.included.length} categories`);
          return {
            ok: true,
            export: {
              path: result.path,
              createdAt: manifest.createdAt,
              included: manifest.included.map((entry) => ({ category: entry.category, label: entry.label, files: entry.files.length })),
              omissions: manifest.omissions.map(omissionView),
              notice: manifest.notice,
              attribution: {
                principal: manifest.attribution.principal ? { ...manifest.attribution.principal } : null,
                appVersion: manifest.attribution.appVersion,
                runtimeVersion: manifest.attribution.runtimeVersion,
              },
            },
          };
        } catch (error) {
          this.options.logger.warn(`data: export failed (${(error as Error).message})`);
          return { ok: false, reason: error instanceof ExportError ? sentence(error.message) : 'The export could not be written; nothing was kept.' };
        }
      });
    });
  }

  importData(): Promise<ImportActionResult> {
    return this.exclusive(async () => {
      if (this.options.runtime.activeTasks() > 0) return { ok: false, reason: DATA_REASONS.taskRunning };
      const source = await this.options.chooseImportSource();
      if (!source) return { ok: false, reason: DATA_REASONS.cancelled };
      return this.withRuntimeStopped(async () => {
        try {
          const result = await importData({ policy: this.policy!, roots: this.options.roots, source });
          this.options.logger.info(`data: imported ${result.restored.reduce((sum, entry) => sum + entry.files, 0)} files`);
          return {
            ok: true as const,
            import: {
              restored: result.restored.map((entry) => ({ category: entry.category, label: entry.label, files: entry.files })),
              notRestored: result.notRestored.map((entry) => ({ category: entry.category, path: entry.path, reason: entry.reason })),
              omissions: result.omissions.map(omissionView),
            },
          };
        } catch (error) {
          this.options.logger.warn(`data: import refused (${(error as Error).message})`);
          return { ok: false as const, reason: error instanceof ImportError ? sentence(error.message) : 'The import could not be completed.' };
        }
      });
    });
  }

  deleteData(categories: readonly string[]): Promise<DeleteActionResult> {
    return this.exclusive(async () => {
      const policy = this.policy!;
      try {
        validateDeletion(policy, categories);
      } catch (error) {
        return { ok: false, reason: sentence((error as Error).message) };
      }
      if (this.options.runtime.activeTasks() > 0) return { ok: false, reason: DATA_REASONS.taskRunning };
      let journalEntries;
      try {
        journalEntries = this.options.journal.read();
      } catch {
        return { ok: false, reason: 'The export journal could not be read, so surviving exports cannot be listed. Nothing was deleted.' };
      }

      const notes: Record<string, string> = {};
      let serverRevocation: ServerRevocation | undefined;
      if (categories.includes(IDENTITY_SESSION)) {
        if (!this.options.identity.holdsSession()) {
          // Nothing to revoke, but a sign-in in progress must not recreate it.
          this.options.identity.forgetLocally();
          serverRevocation = 'not-signed-in';
        } else {
          let confirmed = false;
          try {
            confirmed = (await this.options.identity.signOut()).ok;
          } catch {
            confirmed = false;
          }
          if (!confirmed) this.options.identity.forgetLocally();
          serverRevocation = confirmed ? 'confirmed' : 'not-confirmed';
        }
        notes[IDENTITY_SESSION] =
          serverRevocation === 'confirmed'
            ? 'Signed out; the shared service confirmed the session was revoked.'
            : serverRevocation === 'not-confirmed'
              ? 'Removed locally; the shared service could not confirm the revocation, so the server session may stay valid until it expires.'
              : 'No session was signed in.';
      }

      return this.withRuntimeStopped(async () => {
        try {
          if (categories.includes(CLAUDE_KEY_VAULT)) {
            try {
              this.options.providers.forgetClaudeKey();
            } catch (error) {
              // The file deletion below retries; the check after it decides.
              this.options.logger.warn(`data: the Claude API key could not be cleared (${(error as NodeJS.ErrnoException).code ?? 'error'})`);
            }
          }
          const report = await deleteCategories({
            policy,
            roots: this.options.roots,
            categories,
            journalEntries,
            clearBrowserProfile: this.options.clearBrowserProfile,
            notes,
          });
          if (categories.includes(CLAUDE_KEY_VAULT) && this.options.providers.holdsClaudeKey()) {
            return { ok: false as const, reason: 'The Claude API key could not be removed and is still stored. Remove it in Providers.' };
          }
          this.options.logger.info(`data: deleted ${categories.join(', ')}`);
          const view: DeleteReportView = {
            removed: report.removed.map((entry) => ({ ...entry })),
            retained: report.retained.map((entry) => ({ ...entry })),
            survivingExports: report.survivingExports.map((entry) => ({ path: entry.path, exportedAt: entry.exportedAt, categories: [...entry.categories], outsideInquelloControl: true })),
          };
          if (serverRevocation) view.serverRevocation = serverRevocation;
          return { ok: true as const, delete: view };
        } catch (error) {
          this.options.logger.warn(`data: delete failed (${(error as Error).message})`);
          return { ok: false as const, reason: error instanceof DeleteError ? sentence(error.message) : 'The deletion could not be completed.' };
        }
      });
    });
  }

  /** Stops the runtime, runs `fn`, then restarts the runtime whatever happened. */
  private async withRuntimeStopped<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | { ok: false; reason: string }> {
    try {
      await this.options.runtime.stop();
    } catch (error) {
      this.options.logger.error(`data: the runtime could not be stopped (${(error as Error).message})`);
      return { ok: false, reason: DATA_REASONS.runtimeStop };
    }
    let result: T | undefined;
    try {
      result = await fn();
    } finally {
      try {
        await this.options.runtime.start();
      } catch (error) {
        this.options.logger.error(`data: the runtime did not restart (${(error as Error).message})`);
        result = undefined;
      }
    }
    if (result === undefined) return { ok: false, reason: DATA_REASONS.runtimeRestart };
    return result;
  }
}

function blockerView(blocker: { kind: BlockerKind; category?: string; path?: string; detail: string }): BlockerView {
  const view: BlockerView = { kind: blocker.kind, detail: blocker.detail };
  if (blocker.category !== undefined) view.category = blocker.category;
  if (blocker.path !== undefined) view.path = blocker.path;
  return view;
}

/** Capitalises an internal message and ends it with a full stop. */
function sentence(message: string): string {
  const trimmed = message.trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}
