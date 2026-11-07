/**
 * Reimport: restores an export's included categories.
 *
 * - The manifest is read strictly. Every file it lists must belong, under the
 *   current register, to the category it is listed under, and that category
 *   must be enabled, exported and free of credentials. Nothing else can be
 *   written, so an export cannot plant a file in another category.
 * - Every digest is verified before anything is written; one mismatch refuses
 *   the whole import.
 * - The runtime home must be empty: it may hold no file of a category the
 *   export restores there, and no unclassified file. Rebuildable runtime state
 *   and runtime logs, which the runtime writes on every start, do not count.
 * - A working-store restore requires an empty store family and publishes the
 *   fully verified DB/WAL/SHM directory together, never a partial family.
 * - Linked destination ancestry is refused. Linux pins directory descriptors;
 *   other platforms require a quiescent owner-controlled destination tree.
 * - Nothing is overwritten. A file whose target already exists, or that could
 *   not be copied intact, is listed as not restored.
 *
 * The caller (main) runs this only while no Task runs and with the runtime
 * stopped, then restarts the runtime.
 */
import {DataAuthorityError} from './authority';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { copyWithDigest, digestFile, exportedFilePath, MANIFEST_FILE, MANIFEST_FORMAT, type ExportManifest, type ManifestFile, type ManifestOmission } from './export';
import { takeInventory, type GovernedRoots } from './inventory';
import { categoryById, classify, DATA_ROOTS, type DataPolicy, type DataRoot } from './policy';

export class ImportError extends Error {
  override name = 'ImportError';
}

export interface ImportOptions {
  policy: DataPolicy;
  roots: GovernedRoots;
  /** The export directory the user chose. */
  source: string;
  /** Immutable plan already inspected and service-receipted by main. */
  plan?: ExportManifest;
  /** Main fresh authority before each slow copy/read/publication boundary. */
  authorize?():Promise<void>;
  /** Synchronous main-only publication ledger. */
  onPublished?(publication:ImportPublication):void;
}

export interface ImportResult {
  restored: Array<{ category: string; label: string; files: number }>;
  notRestored: Array<{ category: string; path: string; reason: string }>;
  /** What the export itself omitted, as its manifest declares. */
  omissions: ManifestOmission[];
  createdAt: string;
}

const SHA256 = /^[0-9a-f]{64}$/;

function bad(message: string): never {
  throw new ImportError(`the export manifest is not valid: ${message}`);
}

function safeRel(rel: unknown): string {
  if (typeof rel !== 'string' || rel === '' || rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) bad(`unsafe path ${JSON.stringify(rel)}`);
  if (rel.split('/').some((part) => part === '' || part === '.' || part === '..')) bad(`unsafe path ${JSON.stringify(rel)}`);
  if (/^[A-Za-z]:/.test(rel)) bad(`unsafe path ${JSON.stringify(rel)}`);
  return rel;
}

/** Reads and checks the manifest's shape. */
export function readManifest(source: string): ExportManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(source, MANIFEST_FILE), 'utf8'));
  } catch {
    throw new ImportError('the chosen folder holds no readable Inquello export manifest');
  }
  if (typeof raw !== 'object' || raw === null) bad('not an object');
  const manifest = raw as Record<string, unknown>;
  if (manifest.format !== MANIFEST_FORMAT || manifest.version !== 1) bad('unknown format or version');
  if (typeof manifest.createdAt !== 'string' || !Array.isArray(manifest.included) || !Array.isArray(manifest.omissions)) bad('missing fields');
  const seen = new Set<string>();
  for (const entry of manifest.included as unknown[]) {
    if (typeof entry !== 'object' || entry === null) bad('included entry is not an object');
    const { category, label, files } = entry as Record<string, unknown>;
    if (typeof category !== 'string' || typeof label !== 'string' || !Array.isArray(files)) bad('included entry is incomplete');
    for (const file of files as unknown[]) {
      if (typeof file !== 'object' || file === null) bad('file entry is not an object');
      const { root, path: rel, size, sha256 } = file as Record<string, unknown>;
      if (typeof root !== 'string' || !(DATA_ROOTS as readonly string[]).includes(root)) bad(`unknown root ${JSON.stringify(root)}`);
      safeRel(rel);
      if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) bad('file size is not valid');
      if (typeof sha256 !== 'string' || !SHA256.test(sha256)) bad('file digest is not valid');
      const key = `${root}:${rel as string}`;
      if (seen.has(key)) bad(`duplicate file ${key}`);
      seen.add(key);
    }
  }
  for (const omission of manifest.omissions as unknown[]) {
    if (typeof omission !== 'object' || omission === null) bad('omission is not an object');
    const { category, label, reason, files } = omission as Record<string, unknown>;
    if ((category !== null && typeof category !== 'string') || typeof label !== 'string' || typeof reason !== 'string' || typeof files !== 'number') bad('omission is incomplete');
  }
  return raw as ExportManifest;
}

/** Pin the complete recovery plan before any authority wait. */
export function pinImportPlan(manifest: ExportManifest): ExportManifest {
  const snapshot = structuredClone(manifest);
  const freeze = (value: unknown): void => {
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  freeze(snapshot);
  return snapshot;
}

export async function importData(options: ImportOptions): Promise<ImportResult> {
  const { policy, roots } = options;
  const source = path.resolve(options.source);
  const manifest = pinImportPlan(options.plan ?? readManifest(source));
  // Do not adopt a changed archive as a new plan after receipt/authority waits.
  if (options.plan && JSON.stringify(readManifest(source)) !== JSON.stringify(manifest)) {
    throw new ImportError('the export manifest changed after current validation');
  }
  await options.authorize?.();

  // 1. Every listed file must belong to an importable category under this register.
  for (const entry of manifest.included) {
    const category = categoryById(policy, entry.category);
    if (!category || !category.enabled || category.credentials || category.export.mode !== 'included') {
      throw new ImportError(`the export includes ${JSON.stringify(entry.category)}, which this data policy does not allow importing`);
    }
    for (const file of entry.files) {
      if (classify(policy, file.root, file.path)?.id !== category.id) {
        throw new ImportError(`${file.root}:${file.path} does not belong to ${category.label} under this data policy`);
      }
    }
  }

  // Reject linked destination ancestry before restoring any category. A lexical
  // manifest path alone does not constrain writes through existing directories.
  for (const entry of manifest.included) {
    for (const file of entry.files) checkDestinationAncestry(roots[file.root], file.path);
  }

  // 2. Verify every digest before writing anything.
  for (const entry of manifest.included) {
    for (const file of entry.files) {
      let actual: { size: number; sha256: string };
      try {
        await options.authorize?.();
        actual = await digestFile(exportedFilePath(source, file.root, file.path),options.authorize);
      } catch(error) {
        if(error instanceof DataAuthorityError)throw error;
        throw new ImportError(`${file.root}:${file.path} is missing from the export`);
      }
      if (actual.sha256 !== file.sha256 || actual.size !== file.size) {
        throw new ImportError(`${file.root}:${file.path} does not match its digest; the export was changed or damaged`);
      }
    }
  }

  // 3. The runtime home must be empty of anything the import restores, and of unclassified files.
  const restoring = new Set(manifest.included.filter((entry) => entry.files.some((file) => file.root === 'runtime-home')).map((entry) => entry.category));
  const inventory = takeInventory(policy, roots);
  const occupied = inventory.files.filter((file) => file.root === 'runtime-home' && (file.category === null || restoring.has(file.category)));
  if (occupied.length > 0) {
    throw new ImportError(`the runtime home already holds data (${occupied.length} file(s); private names withheld); import restores only into an empty runtime home`);
  }

  // The working store is one SQLite family, not independent replaceable files.
  // Even if the manifest only restores a WAL (or a differently named database),
  // no existing DB/WAL/SHM from this category may be mixed with it. Check before
  // restoring *any* category, not after earlier session files have been copied.
  if (manifest.included.some((entry) => entry.category === 'working-store' && entry.files.length > 0)
      && inventory.files.some((file) => file.category === 'working-store')) {
    throw new ImportError('the working store already holds data; remove the entire Private work organisation category before importing it');
  }

  // 4. Publish the working-store category as one complete directory. Restoring
  // SQLite files independently could leave a new DB with a missing/foreign WAL
  // when a later copy fails and the caller restarts the runtime.
  const workingFiles = manifest.included.filter((entry) => entry.category === 'working-store').flatMap((entry) => entry.files);
  const workingOutcome = workingFiles.length > 0 ? await restoreWorkingStore(source, roots, workingFiles,options.authorize,options.onPublished) : null;

  // Other categories retain per-file, no-overwrite restoration.
  const restored: ImportResult['restored'] = [];
  const notRestored: ImportResult['notRestored'] = [];
  for (const entry of manifest.included) {
    let count = 0;
    for (const file of entry.files) {
      const outcome = entry.category === 'working-store' ? workingOutcome : await restoreFile(source, roots, file,options.authorize,options.onPublished);
      if (outcome === null) count += 1;
      else notRestored.push({ category: entry.category, path: `${file.root}:${file.path}`, reason: outcome });
    }
    restored.push({ category: entry.category, label: entry.label, files: count });
  }
  await options.authorize?.();
  return { restored, notRestored, omissions: manifest.omissions, createdAt: manifest.createdAt };
}

/**
 * Checks existing directory components, including the governed root's ancestors.
 * Missing components are allowed and created later. lstat rejects symlinks and
 * Windows junctions, rather than following them as stat/recursive mkdir would.
 */
function checkDestinationAncestry(root: string, relative: string): void {
  const parent = path.dirname(path.join(path.resolve(root), ...relative.split('/')));
  const parsed = path.parse(parent);
  let current = parsed.root;
  for (const component of parent.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ImportError('the import destination contains a linked or non-directory ancestor');
  }
}

interface DestinationDirectory {
  path: string;
  check(): void;
  close(): void;
}

/**
 * Linux: walk one component at a time with O_NOFOLLOW and keep the destination
 * directory pinned through /proc/self/fd. A swapped ancestor cannot redirect
 * copy, publication or cleanup into the replacement directory. No pathname
 * fallback is used if this support is unavailable on Linux.
 *
 * Other platforms: reject linked ancestry and check it again before publication.
 * Node has no portable openat API; those checks do NOT eliminate concurrent
 * ancestor replacement. Import requires a quiescent, owner-controlled data tree.
 */
function destinationDirectory(root: string, relative: string): DestinationDirectory {
  const parent = path.dirname(path.join(path.resolve(root), ...relative.split('/')));
  checkDestinationAncestry(root, relative);
  if (process.platform === 'linux') {
    const flags = fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW;
    let fd = fs.openSync(path.parse(parent).root, flags);
    try {
      for (const component of parent.slice(path.parse(parent).root.length).split(path.sep).filter(Boolean)) {
        const child = `/proc/self/fd/${fd}/${component}`;
        try {
          fs.mkdirSync(child, { mode: 0o700 });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
        const next = fs.openSync(child, flags);
        fs.closeSync(fd);
        fd = next;
      }
      const pinned = `/proc/self/fd/${fd}`;
      const identity = fs.fstatSync(fd);
      const check = () => {
        checkDestinationAncestry(root, relative);
        const current = fs.lstatSync(parent);
        if (current.dev !== identity.dev || current.ino !== identity.ino) throw new ImportError('the import destination changed during the copy');
      };
      return { path: pinned, check, close: () => fs.closeSync(fd) };
    } catch (error) {
      fs.closeSync(fd);
      throw error;
    }
  }
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  checkDestinationAncestry(root, relative);
  const identity = fs.lstatSync(parent);
  return {
    path: parent,
    check: () => {
      checkDestinationAncestry(root, relative);
      const current = fs.lstatSync(parent);
      if (current.dev !== identity.dev || current.ino !== identity.ino) throw new ImportError('the import destination changed during the copy');
    },
    close: () => undefined,
  };
}

/**
 * The working store's DB/WAL/SHM files are one publication unit. Stage every
 * file, verify all bytes, then rename the complete sibling directory into
 * place. rename cannot replace a nonempty directory, so a competing store
 * created after preflight refuses the whole publication instead of mixing
 * families. Unclassified files in `working` are also preserved by refusal.
 *
 * POSIX can replace an existing empty directory atomically. If a platform
 * refuses that replacement, remove only a verified empty real directory with
 * rmdir and retry the directory rename. No prior data can be lost in that gap;
 * a newly nonempty target still refuses publication. Never publish SQLite
 * files individually.
 */
async function restoreWorkingStore(source: string, roots: GovernedRoots, files: ManifestFile[],authorize?:()=>Promise<void>,onPublished?:(publication:ImportPublication)=>void): Promise<string | null> {
  if (files.some((file) => file.root !== 'user-data' || path.posix.dirname(file.path) !== 'working')) {
    return 'The working-store layout is not supported; no working-store file was restored';
  }
  let directory: DestinationDirectory | undefined;
  let staging: string | undefined;
  let ownsStaging = false;
  try {
    directory = destinationDirectory(roots['user-data'], 'working');
    staging = path.join(directory.path, `.import-working-${randomUUID()}`);
    fs.mkdirSync(staging, { mode: 0o700 });
    ownsStaging = true;
    for (const file of files) {
      const copied = await copyWithDigest(exportedFilePath(source, file.root, file.path), path.join(staging, path.posix.basename(file.path)),{authorize});
      if (copied.sha256 !== file.sha256 || copied.size !== file.size) return 'The working-store copy did not match its digest; no working-store file was restored';
    }
    directory.check();
    checkDestinationAncestry(roots['user-data'], 'working/placeholder');
    const destination = path.join(directory.path, 'working');
    await authorize?.();
    directory.check();
    checkDestinationAncestry(roots['user-data'], 'working/placeholder');
    try {
      if (fs.readdirSync(destination).length > 0) return 'The working-store folder is not empty; no working-store file was restored';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const published={...publication(staging,'user-data/working',true),target:path.join(roots['user-data'],'working')};
    try {
      fs.renameSync(staging, destination);
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      directory.check();
      const target = fs.lstatSync(destination);
      if (!target.isDirectory() || target.isSymbolicLink() || fs.readdirSync(destination).length !== 0) throw error;
      // Windows commonly refuses replacing even an empty directory. rmdir is
      // intentionally nonrecursive: a DB appearing meanwhile prevents removal.
      fs.rmdirSync(destination);
      fs.renameSync(staging, destination);
    }
    ownsStaging = false;
    onPublished?.(published);
    return null;
  } catch (error) {
    if (error instanceof DataAuthorityError) throw error;
    if (error instanceof ImportError) return error.message;
    return `The working store could not be restored (${(error as NodeJS.ErrnoException).code ?? 'error'}); no working-store file was restored`;
  } finally {
    try {
      if (ownsStaging && staging) fs.rmSync(staging, { recursive: true, force: true });
    } finally {
      directory?.close();
    }
  }
}

/** Restores one file; returns null on success or the reason it was not restored. */
async function restoreFile(source: string, roots: GovernedRoots, file: ManifestFile,authorize?:()=>Promise<void>,onPublished?:(publication:ImportPublication)=>void): Promise<string | null> {
  let directory: DestinationDirectory | undefined;
  let temp: string | undefined;
  let staged = false;
  try {
    directory = destinationDirectory(roots[file.root as DataRoot], file.path);
    const target = path.join(directory.path, path.posix.basename(file.path));
    temp = path.join(directory.path, `.import-${randomUUID()}.tmp`);
    directory.check();
    const copied = await copyWithDigest(exportedFilePath(source, file.root, file.path), temp,{authorize});
    staged = true;
    if (copied.sha256 !== file.sha256 || copied.size !== file.size) return 'The copy did not match its digest';
    directory.check();
    // Atomic no-replace publication: rename would overwrite a target created
    // between existsSync and rename, including an existing SQLite family file.
    // Filesystems that do not support hard links fail closed, never fall back.
    await authorize?.();
    directory.check();
    const published={...publication(temp,`${file.root}/${file.path}`,false),target:path.join(roots[file.root],file.path)};
    fs.linkSync(temp, target);
    onPublished?.(published);
    return null;
  } catch (error) {
    if (error instanceof DataAuthorityError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'A file already exists there; it was not overwritten';
    if (error instanceof ImportError) return error.message;
    return `It could not be written (${(error as NodeJS.ErrnoException).code ?? 'error'})`;
  } finally {
    try {
      if (staged && temp) fs.rmSync(temp, { force: true });
    } finally {
      directory?.close();
    }
  }
}

/** Private identity ledger: never reconstructed from archive names/initial absence. */
export interface ImportPublication { readonly target:string; readonly relative:string; readonly identity:fs.Stats; readonly members:ReadonlyArray<{name:string;identity:fs.Stats}>|null }
function publication(target:string,relative:string,family:boolean):ImportPublication {
 return {target,relative,identity:fs.lstatSync(target),members:family?fs.readdirSync(target).map(name=>({name,identity:fs.lstatSync(path.join(target,name))})):null};
}
function sameIdentity(a:fs.Stats,b:fs.Stats):boolean {
 return !a.isSymbolicLink()&&!b.isSymbolicLink()&&a.dev===b.dev&&a.ino===b.ino&&a.birthtimeMs===b.birthtimeMs&&a.size===b.size&&a.mtimeMs===b.mtimeMs;
}
/** Synchronous validation/move; ambiguity retains marker and stopped runtime. */
export function quarantinePublications(publications:readonly ImportPublication[],quarantine:string):void {
 for(const item of publications){
  if(!sameIdentity(item.identity,fs.lstatSync(item.target)))throw new ImportError('A published destination changed; safe recovery cleanup is unavailable');
  if(item.members){
   const names=fs.readdirSync(item.target).sort();
   if(JSON.stringify(names)!==JSON.stringify(item.members.map(m=>m.name).sort())||item.members.some(m=>!sameIdentity(m.identity,fs.lstatSync(path.join(item.target,m.name)))))throw new ImportError('A published database family changed; safe recovery cleanup is unavailable');
  }
  const destination=path.join(quarantine,item.relative);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.renameSync(item.target,destination);
 }
}
