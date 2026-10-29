/**
 * Draft preservation for the Composer slot (Story 1.16).
 *
 * The Shell owns each Task's unsent text here, outside the Composer, so it
 * survives the single-mode Conversation/Artifact switch, layout-mode changes
 * and the Composer being re-rendered elsewhere. Story 1.17's Composer reads
 * and writes its text only through a `DraftBinding`. Drafts are kept in memory
 * for this window; nothing is sent or saved.
 */
import { useCallback, useMemo, useState } from 'react';

/** The key for text typed while no Task is open. */
export const NO_TASK_DRAFT = '';

export interface DraftBinding {
  /** The Task the draft belongs to, or null when none is open. */
  taskId: string | null;
  value: string;
  onChange: (value: string) => void;
}

/** One draft per Task (and one with no Task open), bound to the open Task. */
export function useDraftBinding(taskId: string | null): DraftBinding {
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const key = taskId ?? NO_TASK_DRAFT;
  const onChange = useCallback((value: string) => setDrafts((current) => (current[key] === value ? current : { ...current, [key]: value })), [key]);
  const value = Object.hasOwn(drafts, key) ? drafts[key]! : '';
  return useMemo(() => ({ taskId, value, onChange }), [taskId, value, onChange]);
}
