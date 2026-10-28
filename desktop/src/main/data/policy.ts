/**
 * The local data-policy register (Story 1.12; FR-37, NFR-9, NFR-10, OQ-2).
 *
 * `desktop/data-policy.json` is a reviewed, committed file that ships with the
 * app. It lists every category of local data the desktop can hold: where it
 * lives (globs under userData, the runtime home or the logs directory), who
 * owns it, who sets its rule, how long it is kept, who can reach it, whether
 * an export includes it, what deletes it and how it is recovered. Nothing at
 * runtime can add, enable or change a category: the file is read once,
 * validated strictly (unknown keys reject) and frozen. The build and the tests
 * validate the same file (`scripts/check-data-policy.cjs`,
 * `test/data-policy.test.ts`).
 *
 * Fail closed:
 * - an enabled category whose owner, rule owner, retention or export rule is
 *   `unknown` is a real-data blocker (`realDataBlockers`);
 * - a held file that matches no category is `unclassified` and blocks;
 * - a file held in a disabled category blocks;
 * - a register that does not load blocks everything.
 *
 * Retention is never invented: the only rules are `until-owner-deletes` (the
 * owner decision of 2026-10-28) and `unknown`.
 *
 * This module only uses `node:fs` and `node:path` so the build check can run
 * the compiled copy directly.
 */
import fs from 'node:fs';
import path from 'node:path';

export const POLICY_FILE = 'data-policy.json';

/** The three governed roots. The runtime home is `<userData>/runtime-home`. */
export const DATA_ROOTS = ['user-data', 'runtime-home', 'logs'] as const;
export type DataRoot = (typeof DATA_ROOTS)[number];

export const RETENTION_RULES = ['until-owner-deletes', 'unknown'] as const;
export type Retention = (typeof RETENTION_RULES)[number];

export const ACCESS_KINDS = ['main-process-only', 'runtime'] as const;
export type Access = (typeof ACCESS_KINDS)[number];

export type ExportRule = { mode: 'included' } | { mode: 'excluded'; reason: string } | { mode: 'unknown' };

export interface DataCategory {
  id: string;
  label: string;
  location: { root: DataRoot; globs: readonly string[] };
  enabled: boolean;
  /** Holds credentials or provider secrets: never exported. */
  credentials: boolean;
  owner: string;
  rule_owner: string;
  retention: Retention;
  access: Access;
  export: ExportRule;
  deletion: string;
  recovery: string;
}

export interface DataPolicy {
  schema_version: 1;
  policy_owner: string;
  notice: string;
  categories: readonly DataCategory[];
}

export class PolicyError extends Error {
  override name = 'PolicyError';
}

/** The literal the register uses for an owner or rule owner nobody has named. */
export const UNKNOWN = 'unknown';

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function fail(where: string, message: string): never {
  throw new PolicyError(`${where}: ${message}`);
}

function exactKeys(value: unknown, where: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(where, 'expected an object');
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!required.includes(key) && !optional.includes(key)) fail(where, `unknown field ${key}`);
  }
  for (const key of required) if (!Object.hasOwn(record, key)) fail(where, `missing field ${key}`);
  return record;
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(where, 'expected a non-empty string');
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) fail(where, `expected one of ${allowed.join(', ')}`);
  return value as T;
}

function validGlob(glob: string, where: string): string {
  if (glob.startsWith('/') || glob.includes('\\') || glob.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    fail(where, `glob ${JSON.stringify(glob)} must be a relative path pattern`);
  }
  return glob;
}

function parseExport(value: unknown, where: string): ExportRule {
  const record = exactKeys(value, where, ['mode'], ['reason']);
  const mode = oneOf(record.mode, ['included', 'excluded', 'unknown'] as const, `${where}.mode`);
  if (mode === 'excluded') return { mode, reason: text(record.reason, `${where}.reason`) };
  if (Object.hasOwn(record, 'reason')) fail(where, `a reason belongs only to an excluded export`);
  return { mode };
}

function parseCategory(value: unknown, index: number): DataCategory {
  const where = `categories[${index}]`;
  const record = exactKeys(value, where, [
    'id',
    'label',
    'location',
    'enabled',
    'credentials',
    'owner',
    'rule_owner',
    'retention',
    'access',
    'export',
    'deletion',
    'recovery',
  ]);
  const id = text(record.id, `${where}.id`);
  if (!ID_PATTERN.test(id)) fail(where, `id ${JSON.stringify(id)} is not lower-case kebab`);
  const at = `category ${id}`;
  const location = exactKeys(record.location, `${at}.location`, ['root', 'globs']);
  const root = oneOf(location.root, DATA_ROOTS, `${at}.location.root`);
  if (!Array.isArray(location.globs) || location.globs.length === 0) fail(`${at}.location.globs`, 'expected a non-empty list');
  const globs = location.globs.map((glob, i) => validGlob(text(glob, `${at}.location.globs[${i}]`), `${at}.location`));
  if (typeof record.enabled !== 'boolean') fail(`${at}.enabled`, 'expected a boolean');
  if (typeof record.credentials !== 'boolean') fail(`${at}.credentials`, 'expected a boolean');
  const category: DataCategory = {
    id,
    label: text(record.label, `${at}.label`),
    location: { root, globs },
    enabled: record.enabled,
    credentials: record.credentials,
    owner: text(record.owner, `${at}.owner`),
    rule_owner: text(record.rule_owner, `${at}.rule_owner`),
    retention: oneOf(record.retention, RETENTION_RULES, `${at}.retention`),
    access: oneOf(record.access, ACCESS_KINDS, `${at}.access`),
    export: parseExport(record.export, `${at}.export`),
    deletion: text(record.deletion, `${at}.deletion`),
    recovery: text(record.recovery, `${at}.recovery`),
  };
  if (category.credentials && category.export.mode !== 'excluded') fail(at, 'a category holding credentials must be excluded from export');
  return category;
}

/** Parses and validates a register document. Throws `PolicyError` naming the first problem. */
export function parsePolicy(json: string): DataPolicy {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new PolicyError(`register is not JSON: ${(error as Error).message}`);
  }
  const record = exactKeys(raw, 'register', ['schema_version', 'policy_owner', 'notice', 'categories']);
  if (record.schema_version !== 1) fail('register', 'schema_version must be 1');
  if (!Array.isArray(record.categories) || record.categories.length === 0) fail('register.categories', 'expected a non-empty list');
  const categories = record.categories.map(parseCategory);
  const ids = new Set<string>();
  for (const category of categories) {
    if (ids.has(category.id)) fail('register', `duplicate category ${category.id}`);
    ids.add(category.id);
  }
  return deepFreeze({
    schema_version: 1,
    policy_owner: text(record.policy_owner, 'register.policy_owner'),
    notice: text(record.notice, 'register.notice'),
    categories,
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Where the shipped register lives: `desktop/data-policy.json`, beside `package.json`. */
export function policyPath(): string {
  // `src/main/data` (tests) and `dist/main/data` (the build) are both three levels below `desktop/`.
  return path.resolve(__dirname, '..', '..', '..', POLICY_FILE);
}

export type PolicyLoad = { ok: true; policy: DataPolicy } | { ok: false; error: string };

let shipped: PolicyLoad | undefined;

/** The shipped register, read and validated once. A failure is remembered and blocks everything. */
export function loadShippedPolicy(): PolicyLoad {
  if (!shipped) {
    try {
      shipped = { ok: true, policy: parsePolicy(fs.readFileSync(policyPath(), 'utf8')) };
    } catch (error) {
      shipped = { ok: false, error: (error as Error).message };
    }
  }
  return shipped;
}

// ---- globs and classification ------------------------------------------------

const globCache = new Map<string, RegExp>();

/**
 * Compiles a register glob: `*` and `?` stay within one path segment, `**`
 * spans segments, and a trailing `/**` matches everything below a directory.
 * Paths use `/` separators and match case-sensitively.
 */
export function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob);
  if (cached) return cached;
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i]!;
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') {
          i += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  const compiled = new RegExp(`^${source}$`);
  globCache.set(glob, compiled);
  return compiled;
}

/**
 * The category that governs `relPath` (forward slashes) under `root`: the first
 * category, in register order, with a matching glob. Disabled categories match
 * too, so a file held in one is visible (and blocks).
 */
export function classify(policy: DataPolicy, root: DataRoot, relPath: string): DataCategory | undefined {
  return policy.categories.find((category) => category.location.root === root && category.location.globs.some((glob) => globToRegExp(glob).test(relPath)));
}

export function categoryById(policy: DataPolicy, id: string): DataCategory | undefined {
  return policy.categories.find((category) => category.id === id);
}

// ---- blockers ----------------------------------------------------------------

export type BlockerKind = 'policy-invalid' | 'unknown-rule' | 'unclassified' | 'disabled-held';

export interface RealDataBlocker {
  kind: BlockerKind;
  /** The category concerned, when there is one. */
  category?: string;
  /** `<root>:<relative path>` of a held file, when the blocker is a file. */
  path?: string;
  detail: string;
}

/** What `realDataBlockers` needs from an inventory (see `inventory.ts`). */
export interface HeldFiles {
  unclassified: readonly string[];
  disabledHeld: ReadonlyArray<{ category: string; path: string }>;
}

/** The register's own unknown rules on enabled categories. */
export function ruleBlockers(policy: DataPolicy): RealDataBlocker[] {
  const blockers: RealDataBlocker[] = [];
  for (const category of policy.categories) {
    if (!category.enabled) continue;
    const unknown: string[] = [];
    if (category.owner.trim().toLowerCase() === UNKNOWN) unknown.push('owner');
    if (category.rule_owner.trim().toLowerCase() === UNKNOWN) unknown.push('rule owner');
    if (category.retention === 'unknown') unknown.push('retention');
    if (category.export.mode === 'unknown') unknown.push('export rule');
    if (unknown.length > 0) {
      blockers.push({ kind: 'unknown-rule', category: category.id, detail: `${category.label} is enabled with an unknown ${unknown.join(', ')}` });
    }
  }
  return blockers;
}

/**
 * Everything that stops real data on this device: an invalid register, an
 * unknown rule on an enabled category, and, when an inventory is given, every
 * unclassified file and every file held in a disabled category.
 */
export function realDataBlockers(load: PolicyLoad, held?: HeldFiles): RealDataBlocker[] {
  if (!load.ok) return [{ kind: 'policy-invalid', detail: `The local data policy did not load: ${load.error}` }];
  const blockers = ruleBlockers(load.policy);
  for (const file of held?.unclassified ?? []) {
    blockers.push({ kind: 'unclassified', path: file, detail: `${file} matches no category in the local data policy` });
  }
  for (const { category, path: file } of held?.disabledHeld ?? []) {
    blockers.push({ kind: 'disabled-held', category, path: file, detail: `${file} is held in the disabled category ${category}` });
  }
  return blockers;
}
