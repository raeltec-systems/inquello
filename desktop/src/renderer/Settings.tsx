import {useEffect,useState,type ReactElement} from 'react';
import {providerSettingsTarget} from './provider-settings';
import {Account} from './Account';
import {Providers} from './Providers';
import {ProcessingRoutes} from './ProcessingRoutes';
import {Button} from './primitives';
type Section='account'|'providers'|'routes'|'signout';
const section=():Section=>globalThis.location.hash==='#settings-signout'?'signout':(globalThis.location.hash==='#settings-providers'||providerSettingsTarget(globalThis.location.hash))?'providers':globalThis.location.hash==='#settings-routes'?'routes':'account';
/** Ordinary settings mounts only implemented controls; no specimen examples. */
export function Settings({onBack,onIdentityChanged,workspaceId=null}:{onBack:()=>void;onIdentityChanged:()=>void;workspaceId?:string|null}):ReactElement {
 const [current,setCurrent]=useState(section);
 const [focusTarget,setFocusTarget]=useState(()=>providerSettingsTarget(globalThis.location.hash));
 useEffect(()=>{const changed=()=>{setCurrent(section());setFocusTarget(providerSettingsTarget(globalThis.location.hash));};globalThis.addEventListener('hashchange',changed);return()=>globalThis.removeEventListener('hashchange',changed);},[]);
 return <main className="iq-settings" aria-label="Settings"><nav aria-label="Settings sections"><Button variant="quiet" onPress={onBack}>{current==='signout'?'Cancel · back to chat':'Back to chat'}</Button><h1>Settings</h1>
 {(['account','providers','routes'] as const).map(value=><a key={value} href={`#settings-${value}`} aria-current={current===value?'page':undefined}>{value==='account'?'Account':value==='providers'?'AI connections':'Models'}</a>)}
 <a href="#onboarding">Workspace and team</a></nav><section className="iq-settings-panel" aria-label={current==='signout'?'Sign out?':current==='account'?'Account':current==='providers'?'AI connections':'Models'}>
 <h2>{current==='signout'?'Sign out?':current==='account'?'Account':current==='providers'?'AI connections':'Models'}</h2>
 {current==='signout'?<Account signOutOnly onIdentityChanged={onIdentityChanged}/>:current==='account'?<Account onIdentityChanged={onIdentityChanged}/>:current==='providers'?<Providers focusTarget={focusTarget} workspaceId={workspaceId}/>:<ProcessingRoutes/>}
 </section></main>;
}
