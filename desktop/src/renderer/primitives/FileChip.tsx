/**
 * `FileChip`: a file or folder in a Task's context (DESIGN.md
 * `components.FileChip`).
 *
 * - Type tags PDF (red), XLS (green), DOC (blue) and DIR (muted). Any other
 *   type needs a caller-supplied `typeLabel` (a type error otherwise); at
 *   runtime a missing one shows "FILE" and warns. The tag colour is a file-type
 *   cue, never an error.
 * - The file name is visible. The type's readable name and the optional
 *   `source` detail are accessible text.
 * - `state` `failed`, `unreadable` and `permission-limited` show their own
 *   visible text with an alert glyph, in red-800 or amber-800, distinct from the
 *   PDF type colour.
 * - `onRemove` adds a `<button>` labelled "Remove <name> from task context".
 *   Removing context never deletes the original; the handler is the caller's.
 */
import type { ReactElement } from 'react';

import { Icon } from '../icons/Icon';

export const FILE_TYPES = ['pdf', 'xls', 'doc', 'folder'] as const;
export type FileType = (typeof FILE_TYPES)[number];

/** The visible tag of each known type. */
export const FILE_TYPE_TAG: Record<FileType, string> = { pdf: 'PDF', xls: 'XLS', doc: 'DOC', folder: 'DIR' };
/** The readable name of each known type, read by assistive technology. */
export const FILE_TYPE_NAME: Record<FileType, string> = { pdf: 'PDF document', xls: 'Spreadsheet', doc: 'Document', folder: 'Folder' };

export type FileChipState = 'ready' | 'failed' | 'unreadable' | 'permission-limited';

/** The visible text of each state other than `ready`. */
export const FILE_STATE_TEXT: Record<Exclude<FileChipState, 'ready'>, string> = {
  failed: 'Failed',
  unreadable: 'Unreadable',
  'permission-limited': 'Permission limited',
};

interface CommonProps {
  /** The visible file or folder name. */
  name: string;
  /** Where the file comes from, read by assistive technology. */
  source?: string;
  state?: FileChipState;
  /** Removes this file from the task context only. */
  onRemove?: () => void;
  className?: string;
}

/** A known type shows its own tag; any other type must bring a label. */
export type FileChipProps = CommonProps & ({ type: FileType; typeLabel?: never } | { type: string; typeLabel: string });

const isFileType = (type: string): type is FileType => (FILE_TYPES as readonly string[]).includes(type);

export function FileChip({ type, typeLabel, name, source, state = 'ready', onRemove, className }: FileChipProps): ReactElement {
  const known = isFileType(type);
  let tag: string;
  let typeName: string;
  if (known) {
    tag = FILE_TYPE_TAG[type];
    typeName = FILE_TYPE_NAME[type];
  } else {
    const label = typeLabel?.trim() ?? '';
    if (label === '') console.warn(`FileChip: ${JSON.stringify(type)} is not a known file type and has no typeLabel; shown as FILE.`);
    tag = label === '' ? 'FILE' : label.toUpperCase();
    typeName = label === '' ? 'File' : label;
  }
  const stateText = state === 'ready' ? undefined : FILE_STATE_TEXT[state];
  return (
    <span
      className={['iq-file-chip', state === 'ready' ? undefined : `iq-file-chip--${state}`, onRemove ? 'iq-file-chip--removable' : undefined, className]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={`iq-file-chip-tag iq-file-chip-tag--${known ? type : 'other'}`} aria-hidden="true">
        {tag}
      </span>
      <span className="iq-visually-hidden">{`${typeName}: `}</span>
      <span className="iq-file-chip-name">{name}</span>
      {source !== undefined && source.trim() !== '' ? <span className="iq-visually-hidden">{`, from ${source}`}</span> : null}
      {stateText !== undefined ? (
        <span className="iq-file-chip-state">
          <Icon name="triangle-alert" size={12} />
          <span className="iq-visually-hidden">, </span>
          {stateText}
        </span>
      ) : null}
      {onRemove ? (
        <button type="button" className="iq-file-chip-remove" aria-label={`Remove ${name} from task context`} onClick={() => onRemove()}>
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </span>
  );
}
