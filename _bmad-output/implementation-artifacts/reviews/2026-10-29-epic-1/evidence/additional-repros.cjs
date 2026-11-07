const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const base = '/workspace/inquello/desktop/dist/main';
const { IdentitySession } = require(base + '/identity/session.js');
const { CredentialVault } = require(base + '/identity/vault.js');
const { CONFIG, FakeIssuer, FakeService, fakeSafeStorage } = require('/tmp/inquello-edge-identity-fakes.cjs');
const { copyWithDigest } = require(base + '/data/export.js');
const logger = { info() {}, warn() {}, error() {} };
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function makeSession(dir, gate) {
  const service = new FakeService();
  const vault = new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir });
  const entered = deferred();
  const bootstrap = service.bootstrap.bind(service);
  service.bootstrap = async request => { entered.resolve(); if (gate) await gate.promise; return bootstrap(request); };
  const session = new IdentitySession({
    config: { kind: 'configured', config: CONFIG }, vault, service, logger,
    issuer: {
      discover: async () => ({ authorizationEndpoint: 'https://issuer.example/authorize', tokenEndpoint: 'https://issuer.example/token' }),
      exchangeCode: async () => FakeIssuer.idTokenFor([...service.transactions.values()][0].nonce),
    },
    startLoopback: async () => ({ redirectUri: 'http://127.0.0.1:12345/callback', callback: Promise.resolve({ code: 'synthetic' }), close() {} }),
    openBrowser: async () => {},
  });
  return { session, vault, service, entered };
}
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inquello-review-extra-'));
  try {
    const gate = deferred();
    const w = await makeSession(path.join(root, 'race'), gate);
    const signIn = w.session.signIn();
    await w.entered.promise;
    const signOut = await w.session.signOut();
    w.session.forgetLocally();
    gate.resolve();
    await signIn;
    console.log(JSON.stringify({ case: 'pending sign-in after sign-out/local discard', signOutOk: signOut.ok, finalIdentity: w.session.snapshot().identity.state, credentialsRecreated: w.vault.load() !== null }));

    const p = await makeSession(path.join(root, 'persist'));
    await p.session.signIn();
    const old = p.vault.load().refreshCredential;
    p.vault.save = () => { throw Object.assign(new Error('synthetic write failure'), {code:'ENOSPC'}); };
    const refreshed = await p.session.refreshNow();
    console.log(JSON.stringify({ case: 'refresh persistence failure', refreshed, storageReported: p.session.snapshot().credentialStorage, staleRefreshOnDisk: p.vault.load().refreshCredential === old, serverHasRotated: p.service.current().refresh !== old }));

    const source = path.join(root, 'source');
    const dest = path.join(root, 'target');
    fs.writeFileSync(source, 'synthetic backup content');
    const originalOpen = fs.promises.open;
    fs.promises.open = async function(file, ...args) {
      const handle = await originalOpen.call(this, file, ...args);
      if (file === dest) {
        const originalWrite = handle.write.bind(handle);
        handle.write = async buffer => originalWrite(buffer.subarray(0, Math.max(1, Math.floor(buffer.length / 2))));
      }
      return handle;
    };
    try {
      const result = await copyWithDigest(source, dest);
      console.log(JSON.stringify({case:'legal short-write injection', reportedSize:result.size, actualSize:fs.statSync(dest).size}));
    } finally { fs.promises.open = originalOpen; }
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
})().catch(e => { console.error(e); process.exitCode = 1; });
