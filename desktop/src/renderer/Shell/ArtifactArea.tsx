/**
 * The artifact area (Story 1.16): a labelled complementary region, at least
 * 380px wide beside the thread, shown only while an artifact is open.
 *
 * Nothing in the app opens one yet: a later story opens real artifacts. Until
 * then the area stays closed, and only tests open it with test-only content.
 * It never shows a sample or demo artifact.
 *
 * - The selected item is owned by the Shell, so it survives the single-mode
 *   Conversation/Artifact switch and layout-mode changes.
 * - Contextual review actions sit in their own labelled region after the
 *   artifact's items, so the tab order is artifact, then review, then the
 *   Composer slot.
 */
import type { ReactElement } from 'react';

import { Button, IconButton } from '../primitives';

export interface ArtifactItem {
  itemId: string;
  label: string;
}

export interface ArtifactReviewAction {
  label: string;
  onPress: () => void;
}

/** An open artifact, as a later story will supply it. */
export interface ShellArtifact {
  artifactId: string;
  title: string;
  items: readonly ArtifactItem[];
  reviewActions?: readonly ArtifactReviewAction[];
}

export interface ArtifactAreaProps {
  artifact: ShellArtifact;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onClose: () => void;
  /** Hidden by the single-mode switch; kept mounted so nothing is lost. */
  hidden?: boolean;
}

export function ArtifactArea({ artifact, selectedItemId, onSelectItem, onClose, hidden = false }: ArtifactAreaProps): ReactElement {
  const reviewActions = artifact.reviewActions ?? [];
  return (
    <aside className="iq-artifact" aria-label="Artifact" data-artifact-area={artifact.artifactId} hidden={hidden}>
      <div className="iq-artifact-header">
        <h2 className="iq-artifact-title">{artifact.title}</h2>
        <IconButton icon="x" label="Close artifact" onPress={onClose} data-action="close-artifact" />
      </div>
      <ul className="iq-artifact-items" aria-label={`${artifact.title} items`}>
        {artifact.items.map((item) => (
          <li key={item.itemId}>
            <button
              type="button"
              className="iq-nav-row iq-artifact-item"
              aria-pressed={item.itemId === selectedItemId}
              data-artifact-item={item.itemId}
              onClick={() => onSelectItem(item.itemId)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      {reviewActions.length > 0 ? (
        <section className="iq-artifact-review" aria-label="Contextual review" data-review-region>
          {reviewActions.map((action) => (
            <Button key={action.label} variant="secondary" size="sm" onPress={action.onPress}>
              {action.label}
            </Button>
          ))}
        </section>
      ) : null}
    </aside>
  );
}
