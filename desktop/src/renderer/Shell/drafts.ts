/**
 * Draft preservation for the Composer (Stories 1.16 and 1.17).
 *
 * Each Task's unsent text lives here, outside the Composer, so it survives
 * opening other Tasks, the single-mode Conversation/Artifact switch, layout
 * changes and a visit to Settings. The Composer reads and writes its text only
 * through a `DraftBinding`.
 *
 * Drafts are kept in this renderer's memory for the window's lifetime only:
 * nothing is written to disk or browser storage, logged, or sent to main.
 * They belong to one signed-in principal:
 * - `clear()` drops every draft (sign-out, sign-in, a change of principal);
 * - `claim(owner)` clears when a different principal is seen;
 * - `retain(workspaceId, taskIds)` drops the drafts of that Workspace's Tasks
 *   that no longer exist (a deleted Task).
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

/** The key for text typed while no Task is open. */
export const NO_TASK_DRAFT = '';

export interface DraftBinding {
  /** The Task the draft belongs to, or null when none is open. */
  taskId: string | null;
  value: string;
  onChange: (value: string) => void;
}

export interface DraftStore {
  /** The draft for a Task (or `NO_TASK_DRAFT`), or '' when there is none. */
  get(key: string): string;
  /** Records a draft; the Workspace lets `retain` discard it once its Task is gone. */
  set(key: string, workspaceId: string | null, value: string): void;
  /** Drops every draft. */
  clear(): void;
  /** Records the signed-in principal; a different one than before clears every draft. */
  claim(owner: string | null): void;
  /** Drops the drafts of `workspaceId`'s Tasks that are not in `taskIds`. */
  retain(workspaceId: string, taskIds: Iterable<string>): void;
  /** How many non-empty drafts are held (never their text). */
  count(): number;
  subscribe(listener: () => void): () => void;
  /** Changes whenever a draft changes; for `useSyncExternalStore`. */
  version(): number;
}

interface Entry {
  workspaceId: string | null;
  value: string;
}

/** A new, empty in-memory draft store. */
export function createDraftStore(): DraftStore {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let owner: string | null = null;
  let version = 0;
  const changed = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };
  const clear = () => {
    if (entries.size === 0) return;
    entries.clear();
    changed();
  };
  return {
    get: (key) => entries.get(key)?.value ?? '',
    set: (key, workspaceId, value) => {
      const current = entries.get(key);
      if (current?.value === value || (!current && value === '')) return;
      if (value === '') entries.delete(key);
      else entries.set(key, { workspaceId: key === NO_TASK_DRAFT ? null : (workspaceId ?? current?.workspaceId ?? null), value });
      changed();
    },
    clear,
    claim: (next) => {
      if (next === null) return;
      if (owner !== null && owner !== next) clear();
      owner = next;
    },
    retain: (workspaceId, taskIds) => {
      const live = new Set(taskIds);
      let removed = false;
      for (const [key, entry] of entries) {
        if (key !== NO_TASK_DRAFT && entry.workspaceId === workspaceId && !live.has(key)) {
          entries.delete(key);
          removed = true;
        }
      }
      if (removed) changed();
    },
    count: () => entries.size,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

/**
 * One draft per Task (and one with no Task open), bound to the open Task.
 * Without a store the hook keeps its own for the caller's lifetime.
 */
export function useDraftBinding(taskId: string | null, store?: DraftStore, workspaceId: string | null = null): DraftBinding {
  const [own] = useState(createDraftStore);
  const drafts = store ?? own;
  useSyncExternalStore(drafts.subscribe, drafts.version, drafts.version);
  const key = taskId ?? NO_TASK_DRAFT;
  const onChange = useCallback((value: string) => drafts.set(key, workspaceId, value), [drafts, key, workspaceId]);
  const value = drafts.get(key);
  return useMemo(() => ({ taskId, value, onChange }), [taskId, value, onChange]);
}
