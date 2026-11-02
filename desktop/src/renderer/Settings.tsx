import {useEffect,useState,type ReactElement} from 'react';
import {Account} from './Account';
import {Providers} from './Providers';
import {ProcessingRoutes} from './ProcessingRoutes';
import {Button} from './primitives';
type Section='account'|'providers'|'routes';
const section=():Section=>globalThis.location.hash==='#settings-providers'?'providers':globalThis.location.hash==='#settings-routes'?'routes':'account';
/** Ordinary settings mounts only implemented controls; no specimen examples. */
export function Settings({onBack,onIdentityChanged}:{onBack:()=>void;onIdentityChanged:()=>void}):ReactElement {
 const [current,setCurrent]=useState(section);
 useEffect(()=>{const changed=()=>setCurrent(section());globalThis.addEventListener('hashchange',changed);return()=>globalThis.removeEventListener('hashchange',changed);},[]);
 return <main className="iq-settings" aria-label="Settings"><nav aria-label="Settings sections"><Button variant="quiet" onPress={onBack}>Back to chat</Button><h1>Settings</h1>
 {(['account','providers','routes'] as const).map(value=><a key={value} href={`#settings-${value}`} aria-current={current===value?'page':undefined}>{value==='account'?'Account':value==='providers'?'Providers':'Processing routes'}</a>)}
 <a href="#onboarding">Workspace and team</a></nav><section className="iq-settings-panel" aria-label={current==='account'?'Account':current==='providers'?'Providers':'Processing routes'}>
 <h2>{current==='account'?'Account':current==='providers'?'Providers':'Processing routes'}</h2>
 {current==='account'?<Account onIdentityChanged={onIdentityChanged}/>:current==='providers'?<Providers/>:<ProcessingRoutes/>}
 </section></main>;
}
