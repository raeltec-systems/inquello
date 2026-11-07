import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {describe, expect, it} from 'vitest';
import {httpsIssuer, parseServiceConfig} from '../src/main/identity/config';
import {startLoopbackListener} from '../src/main/identity/loopback';
import {IssuerClient} from '../src/main/identity/service-client';

describe('Story 1.31 native hosted identity compatibility', () => {
  it('preserves exact path/trailing slash issuer and explicitly configured callback port', () => {
    const issuer = 'https://identity.example.invalid/tenant/';
    expect(httpsIssuer(issuer)).toBe(issuer);
    for (const bad of ['http://identity.example.invalid/', 'https://u:p@identity.example.invalid/', issuer+'?x', issuer+'#x']) expect(httpsIssuer(bad)).toBeNull();
    const raw = {service_url:'https://service.example.invalid',issuer_url:issuer,issuer_label:'Hosted identity',client_id:'native',ca_path:'test-ca.pem',callback_port:53682};
    const parsed = parseServiceConfig(JSON.stringify(raw), ()=>'-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----');
    expect(parsed.kind).toBe('configured');
    if (parsed.kind === 'configured') {
      expect(parsed.config.issuerUrl).toBe(issuer);
      expect(parsed.config.callbackPort).toBe(53682);
    }
    for (const callback_port of [0, 80, 65536, '53682', 53682.5]) expect(parseServiceConfig(JSON.stringify({...raw,callback_port}),()=> '-----BEGIN CERTIFICATE-----').kind).toBe('invalid');
  });

  it('refuses occupied fixed callback port instead of silently selecting another', async () => {
    const blocker = http.createServer();
    await new Promise<void>(resolve=>blocker.listen(0,'127.0.0.1',resolve));
    try {
      const port = (blocker.address() as AddressInfo).port;
      await expect(startLoopbackListener({state:'one-use',issuer:'https://identity.example.invalid/',port})).rejects.toThrow();
    } finally { await new Promise<void>((resolve,reject)=>blocker.close(error=>error?reject(error):resolve())); }
  });

  it('discovers a path issuer exactly and rejects foreign or credential-bearing endpoints', async () => {
    const issuer = 'https://identity.example.invalid/tenant/';
    const document = {issuer,authorization_endpoint:issuer+'authorize',token_endpoint:issuer+'token',code_challenge_methods_supported:['S256']};
    const calls: string[] = [];
    const client = new IssuerClient(issuer,async req=> {
      calls.push(req.url);
      return {status:200,contentType:'application/json',location:null,text:JSON.stringify(document)};
    });
    await expect(client.discover()).resolves.toEqual({authorizationEndpoint:document.authorization_endpoint,tokenEndpoint:document.token_endpoint});
    expect(calls).toEqual([issuer+'.well-known/openid-configuration']);
    document.token_endpoint='https://other.example.invalid/token';
    await expect(client.discover()).rejects.toThrow();
    document.token_endpoint='https://u:p@identity.example.invalid/token';
    await expect(client.discover()).rejects.toThrow();
    document.token_endpoint=issuer+'token';
    document.issuer=issuer.slice(0,-1);
    await expect(client.discover()).rejects.toThrow();
  });
});

describe('Story 1.31 explicit issuer trust',()=>{
  const pem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
  const raw={service_url:'https://service.example.invalid',issuer_url:'https://tenant.auth0.com/',issuer_label:'Hosted identity',client_id:'native',ca_path:'service.pem',identity_profile:'auth0',issuer_trust:'system',callback_port:53682};
  it('requires a registered fixed callback and explicit issuer trust for Auth0',()=>{
    const {callback_port,...withoutPort}=raw;
    const {issuer_trust,...withoutTrust}=raw;
    expect(parseServiceConfig(JSON.stringify(withoutPort),()=>pem).kind).toBe('invalid');
    expect(parseServiceConfig(JSON.stringify(withoutTrust),()=>pem).kind).toBe('invalid');
    const {identity_profile,...withoutProfile}=raw;
    expect(parseServiceConfig(JSON.stringify(withoutProfile),()=>pem).kind).toBe('invalid');
    const c=parseServiceConfig(JSON.stringify(raw),()=>pem);
    expect(c).toMatchObject({kind:'configured',config:{ca:pem,issuerCa:null,callbackPort:53682,identityProfile:'auth0'}});
  });
  it('supports a separate fixture issuer CA without changing service pinning',()=>{
    const c=parseServiceConfig(JSON.stringify({...raw,issuer_trust:'custom-ca',issuer_ca_path:'issuer.pem'}),file=>file==='service.pem'?pem:pem+'\nissuer');
    expect(c).toMatchObject({kind:'configured',config:{ca:pem,issuerCa:pem+'\nissuer'}});
    expect(parseServiceConfig(JSON.stringify({...raw,issuer_trust:'custom-ca'}),()=>pem).kind).toBe('invalid');
    expect(parseServiceConfig(JSON.stringify({...raw,issuer_ca_path:'issuer.pem'}),()=>pem).kind).toBe('invalid');
    expect(parseServiceConfig(JSON.stringify({...raw,issuer_trust:'custom-ca',issuer_ca_path:'issuer.pem'}),()=>pem+'PRIVATE KEY').kind).toBe('invalid');
  });
});

it('maps occupied registered callback to a clear refusal without opening the browser',async()=>{
  const {IdentitySession,REASONS}=await import('../src/main/identity/session');
  const {CredentialVault}=await import('../src/main/identity/vault');
  const {LoopbackError}=await import('../src/main/identity/loopback');
  const {CONFIG,FakeIssuer,FakeService,fakeSafeStorage}=await import('./identity-fakes');
  const {recordingLogger}=await import('./helpers');
  let opened=false;
  const session=new IdentitySession({config:{kind:'configured',config:{...CONFIG,callbackPort:53682}},vault:new CredentialVault({safeStorage:fakeSafeStorage('basic_text'),platform:'linux',dir:'unused-memory-only'}),service:new FakeService(),issuer:new FakeIssuer(),openBrowser:async()=>{opened=true;},logger:recordingLogger(),startLoopback:async()=>{throw new LoopbackError('port-occupied');}});
  expect(await session.signIn()).toMatchObject({ok:false,reason:REASONS.callbackOccupied});
  expect(opened).toBe(false);
});
