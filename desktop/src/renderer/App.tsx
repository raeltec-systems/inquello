/**
 * The renderer root (Story 1.14): the Shell, or the design specimen when the
 * location hash is `#specimen`. The smoke run opens on the specimen so its
 * earlier probes keep reading it; the app opens on the Shell. A hash change is
 * an in-page navigation, so the boundary policy has nothing to block.
 *
 * The App owns the window's in-memory Composer drafts (Story 1.17), so a visit
 * to Settings keeps them; a sign-in or sign-out there clears them all.
 */
import { useEffect, useState, type ReactElement } from 'react';

import { Button } from './primitives';
import { DevelopmentNotice } from './development';
import { createDraftStore } from './Shell/drafts';
import { Shell } from './Shell/Shell';
import { Onboarding } from './Onboarding';
import { Settings } from './Settings';
import { Specimen } from './Specimen';

export type View = 'shell' | 'specimen' | 'onboarding' | 'settings';

export function viewFor(hash: string): View {
  return /^#settings(?:-(?:account|providers(?:-(?:claude|openai|chatgpt))?|routes|tools|usage|signout))?$/.test(hash) ? 'settings' : hash === '#onboarding' ? 'onboarding' : hash === '#specimen' ? 'specimen' : 'shell';
}

export function App(): ReactElement {
  const [view, setView] = useState<View>(() => viewFor(globalThis.location?.hash ?? ''));
  const [drafts] = useState(createDraftStore);
  const [sessionEpoch,setSessionEpoch] = useState(0);
  const [workspaceId,setWorkspaceId]=useState<string|null>(null);
  const [conversation,setConversation]=useState<{taskId:string;title:string}|null>(null);

  useEffect(() => {
    const onHash = () => setView(viewFor(globalThis.location.hash));
    globalThis.addEventListener('hashchange', onHash);
    return () => globalThis.removeEventListener('hashchange', onHash);
  }, []);

  const show = (next: View) => {
    globalThis.location.hash = next === 'settings' ? '#settings' : next === 'onboarding' ? '#onboarding' : next === 'specimen' ? '#specimen' : '#shell';
  };

  return <>
    <DevelopmentNotice />
    <div hidden={view !== 'shell'}><Shell key={sessionEpoch} onWorkspaceChanged={setWorkspaceId} onConversationChanged={setConversation} active={view === 'shell'} onShowSpecimen={() => show('settings')} drafts={drafts} /></div>
    {view === 'settings' && <Settings workspaceId={workspaceId} conversation={conversation} onBack={() => show('shell')} onIdentityChanged={() => { drafts.clear(); setWorkspaceId(null); setConversation(null); setSessionEpoch(n => n + 1); }} />}
    {view === 'onboarding' && <Onboarding onBack={() => show('shell')} onIdentityChanged={() => { drafts.clear(); setWorkspaceId(null); setSessionEpoch(n => n + 1); }} />}
    {view === 'specimen' && <>
      <Specimen onIdentityChanged={() => { drafts.clear(); setWorkspaceId(null); setSessionEpoch(n => n + 1); }} />
      <div className="specimen specimen-back"><Button variant="quiet" size="sm" onPress={() => show('shell')}>Back to the workspace</Button></div>
    </>}
  </>;
}
