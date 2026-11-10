import {useEffect,useRef,useState,type ReactElement} from 'react';
import {providerSettingsTarget} from './provider-settings';
import {Account} from './Account';
import {Providers} from './Providers';
import {ProcessingRoutes} from './ProcessingRoutes';
import {Button} from './primitives';
import {TaskUsage} from './Shell/TaskUsage';
import {Capabilities} from './Capabilities';
type Section='account'|'providers'|'routes'|'tools'|'usage'|'signout';
const section=():Section=>globalThis.location.hash==='#settings-signout'?'signout':(globalThis.location.hash==='#settings-providers'||providerSettingsTarget(globalThis.location.hash))?'providers':globalThis.location.hash==='#settings-routes'?'routes':globalThis.location.hash==='#settings-usage'?'usage':globalThis.location.hash==='#settings-tools'?'tools':'account';
const titles:Record<Exclude<Section,'signout'>,string>={account:'Account',providers:'AI connections',routes:'Models',tools:'Tools and connections',usage:'Usage'};
/** Ordinary settings mounts only implemented controls; no specimen examples. */
export function Settings({onBack,onIdentityChanged,workspaceId=null,conversation=null}:{onBack:()=>void;onIdentityChanged:()=>void;workspaceId?:string|null;conversation?:{taskId:string;title:string}|null}):ReactElement {
 const [current,setCurrent]=useState(section);
 const [focusTarget,setFocusTarget]=useState(()=>providerSettingsTarget(globalThis.location.hash));
 useEffect(()=>{const changed=()=>{setCurrent(section());setFocusTarget(providerSettingsTarget(globalThis.location.hash));};globalThis.addEventListener('hashchange',changed);return()=>globalThis.removeEventListener('hashchange',changed);},[]);
 const heading=useRef<HTMLHeadingElement>(null);
 // Provider reconnect destinations focus their own exact control.
 useEffect(()=>{if(!focusTarget)heading.current?.focus();},[current,focusTarget]);
 const title=current==='signout'?'Sign out?':titles[current];
 return <main className="iq-settings" aria-label="Settings"><nav aria-label="Settings sections"><Button variant="quiet" onPress={onBack}>{current==='signout'?'Cancel · back to chat':'Back to chat'}</Button><h1>Settings</h1>
 {(['account','providers','routes','tools','usage'] as const).map(value=><a key={value} href={`#settings-${value}`} aria-current={current===value?'page':undefined}>{titles[value]}</a>)}
 <a href="#onboarding">Workspace and team</a></nav><section className="iq-settings-panel" aria-label={title}>
 <h2 ref={heading} tabIndex={-1}>{title}</h2>
 {current==='signout'?<Account signOutOnly onIdentityChanged={onIdentityChanged}/>:current==='account'?<Account onIdentityChanged={onIdentityChanged}/>:current==='providers'?<Providers focusTarget={focusTarget} workspaceId={workspaceId}/>:current==='tools'?<Capabilities workspaceId={workspaceId} showProcessingRoutes={false}/>:current==='usage'?<SettingsUsage conversation={conversation}/>:<ProcessingRoutes/>}
 </section></main>;
}

/** Attributable usage is recorded per private conversation; limits are inherited from the provider account. */
function SettingsUsage({conversation}:{conversation:{taskId:string;title:string}|null}):ReactElement {
 if(!conversation)return <div data-settings-usage><p>Open a conversation to see its attributable usage and the inherited limits that apply to it. Usage is recorded per conversation; no totals are estimated.</p></div>;
 return <div data-settings-usage data-settings-usage-task={conversation.taskId}><p>Usage for the open conversation: <strong>{conversation.title}</strong></p><TaskUsage key={conversation.taskId} taskId={conversation.taskId} part="history"/></div>;
}
