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
