/**
 * The renderer root (Story 1.14): the Shell, or the design specimen when the
 * location hash is `#specimen`. The smoke run opens on the specimen so its
 * earlier probes keep reading it; the app opens on the Shell. A hash change is
 * an in-page navigation, so the boundary policy has nothing to block.
 */
import { useEffect, useState, type ReactElement } from 'react';

import { Button } from './primitives';
import { Shell } from './Shell/Shell';
import { Specimen } from './Specimen';

export type View = 'shell' | 'specimen';

export function viewFor(hash: string): View {
  return hash === '#specimen' ? 'specimen' : 'shell';
}

export function App(): ReactElement {
  const [view, setView] = useState<View>(() => viewFor(globalThis.location?.hash ?? ''));

  useEffect(() => {
    const onHash = () => setView(viewFor(globalThis.location.hash));
    globalThis.addEventListener('hashchange', onHash);
    return () => globalThis.removeEventListener('hashchange', onHash);
  }, []);

  const show = (next: View) => {
    globalThis.location.hash = next === 'specimen' ? '#specimen' : '#shell';
  };

  if (view === 'specimen') {
    return (
      <>
        <Specimen />
        <div className="specimen specimen-back">
          <Button variant="quiet" size="sm" onPress={() => show('shell')}>
            Back to the workspace
          </Button>
        </div>
      </>
    );
  }
  return <Shell onShowSpecimen={() => show('specimen')} />;
}
