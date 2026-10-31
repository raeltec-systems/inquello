import {inspectorsQuiescent} from '../runtime/data-inspector';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DataAuthorityError,DATA_AUTHORITY_UNAVAILABLE,type DataAuthority,type DataProvenance} from './authority';
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
import { importData, pinImportPlan, ImportError,readManifest, type ImportPublication, quarantinePublications } from './import';
import {FILES_DIR,type ExportManifest} from './export';
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
  /** Main-only hint: uncertain work may be stopped, never presumed stopped. */
  canQuiesceUncertainActivity?(): boolean;
}

export interface IdentityControl {
  principalId?():string|null;
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
  forgetClaudeKey(): void | Promise<void>;
  /** Whether a Claude API key is still held. */
  holdsClaudeKey(): boolean;
}

export interface DataServiceOptions {
  load: PolicyLoad;
  authority?:DataAuthority;
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
  otherExportCopiesMayRemain?:boolean;
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
  private recoveryUnsafe=false;

  constructor(private readonly options: DataServiceOptions) {this.recoveryUnsafe=fs.existsSync(this.recoveryMarker());}
  private activityBlocks(){return this.options.runtime.activeTasks()>0&&!this.options.runtime.canQuiesceUncertainActivity?.();}
  private recoveryMarker(){return path.join(this.options.roots['user-data'],'data','recovery-unvalidated');}

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

  private manifestFiles(manifest:ExportManifest){return manifest.included.flatMap(entry=>entry.files.map(file=>({...file,category:entry.category}))).sort((a,b)=>`${a.root}:${a.path}`.localeCompare(`${b.root}:${b.path}`));}
  private manifestDigest(manifest:ExportManifest){return createHash('sha256').update(JSON.stringify({version:1,files:this.manifestFiles(manifest).map(f=>({root:f.root,path:f.path,sha256:f.sha256,size:String(f.size),category:f.category}))})).digest('hex');}
  private async inspect(roots=this.options.roots){if(!this.options.authority)throw new DataAuthorityError();return this.options.authority.inspect(roots);}
  private async authorize(provenance:DataProvenance,action:'export'|'recover'){if(!this.options.authority)throw new DataAuthorityError();await this.options.authority.check(provenance,action);}
  exportData(): Promise<ExportActionResult> {
    return this.exclusive(async () => {
      if (this.activityBlocks()) return { ok: false, reason: DATA_REASONS.exportTaskRunning };
      const destination = await this.options.chooseExportDestination();
      if (!destination) return { ok: false, reason: DATA_REASONS.cancelled };
      // The chooser can stay open while another operation starts work.
      if (this.activityBlocks()) return { ok: false, reason: DATA_REASONS.exportTaskRunning };
      return this.withRuntimeStopped<ExportActionResult>(async () => {
        let createdDestination: string | undefined;
        try {
          if(fs.existsSync(this.recoveryMarker())){this.recoveryUnsafe=true;throw new DataAuthorityError();}
          const provenance=await this.inspect();
          await this.authorize(provenance,'export');
          const result = await exportData({
            policy: this.policy!,
            roots: this.options.roots,
            destination,
            journal: {append:()=>{}},
            provenFiles:new Map(provenance.files.map(file=>[path.resolve(file.path),file])),
            authorize:()=>this.authorize(provenance,'export'),
            attribution: { principal: await this.options.identity.principal(), appVersion: this.options.appVersion, runtimeVersion: this.options.runtimeVersion },
          });
          createdDestination = result.path;
          const { manifest } = result;
          await this.authorize(provenance,'export');
          const digest=this.manifestDigest(manifest),receipt=await this.options.authority!.createReceipt(provenance,digest);
          manifest.provenance={receiptId:receipt.receipt_id,manifestDigest:digest};
          await this.authorize(provenance,'export');
          fs.writeFileSync(path.join(result.path,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`,{mode:0o600});
          this.options.journal.append({path:result.path,exportedAt:manifest.createdAt,categories:manifest.included.map(entry=>entry.category),ownerPrincipalId:provenance.principalId});
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
          if (createdDestination) { try { fs.rmSync(createdDestination, {recursive:true,force:true}); } catch { /* The owner may already have copied bytes; no recall claim. */ } }
          this.options.logger.warn('data: export failed; protected details withheld');
          return { ok: false, reason: error instanceof DataAuthorityError?DATA_AUTHORITY_UNAVAILABLE:error instanceof ExportError ? sentence(error.message) : 'The export could not be completed. Already exported copies cannot be recalled.' };
        }
      });
    });
  }

  importData(): Promise<ImportActionResult> {
    return this.exclusive(async()=>{
      if(this.activityBlocks())return{ok:false,reason:DATA_REASONS.taskRunning};
      const source=await this.options.chooseImportSource();if(!source)return{ok:false,reason:DATA_REASONS.cancelled};
      if(this.activityBlocks())return{ok:false,reason:DATA_REASONS.taskRunning};
      return this.withRuntimeStopped(async()=>{
        const marker=this.recoveryMarker();
        if(fs.existsSync(marker)){this.recoveryUnsafe=true;return{ok:false as const,reason:'An interrupted recovery remains unvalidated. Delete the protected local data categories before restoring again; the runtime stays stopped.'};}
        const publications: ImportPublication[]=[];
        let manifest:ExportManifest|undefined;
        try{
          manifest=pinImportPlan(readManifest(source));
          const files=this.manifestFiles(manifest);
          const reference=manifest.provenance,digest=this.manifestDigest(manifest);
          if(!reference||reference.manifestDigest!==digest||typeof reference.receiptId!=='string'||! /^[0-9a-f-]{36}$/.test(reference.receiptId)||files.length===0)throw new DataAuthorityError();
          const stagedRoots:GovernedRoots={'user-data':path.join(source,FILES_DIR,'user-data'),'runtime-home':path.join(source,FILES_DIR,'runtime-home'),logs:path.join(source,FILES_DIR,'logs')};
          const provenance=await this.inspect(stagedRoots);
          await this.options.authority!.validateReceipt(provenance,reference.receiptId,digest);
          const proven=new Map(provenance.files.map(file=>[path.resolve(file.path),file]));
          for(const file of files){const proof=proven.get(path.resolve(stagedRoots[file.root],file.path));if(!proof||proof.category!==file.category||proof.sha256!==file.sha256||proof.size!==file.size)throw new DataAuthorityError();}
          await this.authorize(provenance,'recover');
          fs.mkdirSync(path.dirname(marker),{recursive:true,mode:0o700});fs.writeFileSync(marker,'Current validation required before runtime reopen\n',{mode:0o600});
          const result=await importData({policy:this.policy!,roots:this.options.roots,source,plan:manifest,onPublished:publication=>publications.push(publication),authorize:()=>this.authorize(provenance,'recover')});
          // The immutable receipt authenticates this exact plan, never a restored lease.
          await this.options.authority!.validateReceipt(provenance,reference.receiptId,digest);
          await this.authorize(provenance,'recover');
          fs.rmSync(marker,{force:true});this.recoveryUnsafe=false;
          return{ok:true as const,import:{restored:result.restored,notRestored:result.notRestored,omissions:result.omissions.map(omissionView)}};
        }catch(error){
          // Runtime is still stopped. Quarantine only new files from this attempt;
          // never mix/remove an earlier database family or restore old authority.
          try{
            if(fs.existsSync(marker)&&manifest){
              const quarantine=path.join(this.options.roots['user-data'],'data','quarantine',randomUUID());
              quarantinePublications(publications,quarantine);
              fs.rmSync(marker,{force:true});
            }
          }catch{this.recoveryUnsafe=true;}
          return{ok:false as const,reason:this.recoveryUnsafe?'Recovered data could not be safely quarantined. The runtime remains stopped; current validation is required before reopening.':error instanceof DataAuthorityError?DATA_AUTHORITY_UNAVAILABLE:error instanceof ImportError?sentence(error.message):'Recovery did not complete; unvalidated new data was quarantined.'};
        }
      });
    });
  }

  deleteData(categories: readonly string[]): Promise<DeleteActionResult> {
    return this.exclusive(async () => {
      const policy = this.policy!;
      const journalPrincipal=this.options.identity.principalId?.()??null;
      const marker=this.recoveryMarker(),interrupted=fs.existsSync(marker);
      if(interrupted)this.recoveryUnsafe=true;
      try {
        validateDeletion(policy, categories);
      } catch (error) {
        return { ok: false, reason: sentence((error as Error).message) };
      }
      if (this.activityBlocks()) return { ok: false, reason: DATA_REASONS.taskRunning };
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
              await this.options.providers.forgetClaudeKey();
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
            protectedPaths:new Set([path.resolve(marker)]),
            clearBrowserProfile: this.options.clearBrowserProfile,
            notes,
          });
          if (categories.includes(CLAUDE_KEY_VAULT) && this.options.providers.holdsClaudeKey()) {
            return { ok: false as const, reason: 'The Claude API key could not be removed and is still stored. Remove it in Providers.' };
          }
          if(interrupted){
            const protectedCategories=policy.categories.filter(c=>c.enabled&&c.export.mode==='included').map(c=>c.id);
            const remaining=takeInventory(policy,this.options.roots);
            if(protectedCategories.every(id=>categories.includes(id))&&!remaining.files.some(f=>f.category&&protectedCategories.includes(f.category))){
              fs.rmSync(marker,{force:true});this.recoveryUnsafe=false;
              const removed=report.removed.find(e=>e.category==='device-id');if(removed){removed.filesRemoved++;removed.filesRemaining=Math.max(0,removed.filesRemaining-1);}
              const retained=report.retained.find(e=>e.category==='device-id');if(retained)retained.files=Math.max(0,retained.files-1);
            }
          }
          this.options.logger.info(`data: deleted ${categories.join(', ')}`);
          const currentPrincipal=this.options.identity.principalId?.()??null;
          const visibleExports=report.survivingExports.filter(e=>!!journalPrincipal&&currentPrincipal===journalPrincipal&&e.ownerPrincipalId===journalPrincipal);
          const view: DeleteReportView = {
            removed: report.removed.map((entry) => ({ ...entry })),
            retained: report.retained.map((entry) => ({ ...entry })),
            otherExportCopiesMayRemain:visibleExports.length!==report.survivingExports.length,
            survivingExports: visibleExports.map((entry) => ({ path: entry.path, exportedAt: entry.exportedAt, categories: [...entry.categories], outsideInquelloControl: true })),
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
    if(!inspectorsQuiescent())return{ok:false,reason:'Native inspector exit is not yet confirmed. Local data changes and runtime reopening remain blocked.'};
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
        if(this.recoveryUnsafe || !inspectorsQuiescent())throw new Error('Protected data or inspector exit remains unvalidated');
        await this.options.runtime.start();
      } catch (error) {
        this.options.logger.error(`data: the runtime did not restart (${(error as Error).message})`);
        result = undefined;
      }
    }
    if(!inspectorsQuiescent())return{ok:false,reason:'Native inspector exit is not yet confirmed. Local data changes and runtime reopening remain blocked.'};
    if(this.recoveryUnsafe)return{ok:false,reason:'Recovered data remains quarantined or unvalidated. The runtime stays stopped; current validation is required before reopening.'};
    if (result === undefined) return { ok: false, reason: DATA_REASONS.runtimeRestart };
    return result;
  }
}

function blockerView(blocker: { kind: BlockerKind; category?: string; path?: string; detail: string }): BlockerView {
  const view: BlockerView = { kind: blocker.kind, detail: 'Local data policy inspection found a blocker; private file names are withheld.' };
  if (blocker.category !== undefined) view.category = blocker.category;
  // File names can themselves disclose private content; only category-level reasons cross IPC.
  return view;
}

/** Capitalises an internal message and ends it with a full stop. */
function sentence(message: string): string {
  const trimmed = message.trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}
