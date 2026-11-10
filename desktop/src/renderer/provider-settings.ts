/** Fixed presentation destinations only; no credential or provider action is invoked. */
const destinations = {
 'provider-claude-key':'#settings-providers-claude',
 'provider-codex-key':'#settings-providers-openai',
 'codex-chatgpt':'#settings-providers-chatgpt',
} as const;
export type ProviderFocusTarget=keyof typeof destinations;
export function providerSettingsHash(target:string):string {
 return Object.hasOwn(destinations,target)?destinations[target as ProviderFocusTarget]:'#settings-providers';
}
export function providerSettingsTarget(hash:string):ProviderFocusTarget|undefined {
 return (Object.entries(destinations) as [ProviderFocusTarget,string][]).find(([,value])=>value===hash)?.[0];
}
