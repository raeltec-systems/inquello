const fs = require('node:fs');
const ts = require('/workspace/inquello/desktop/node_modules/typescript');
const base = '/workspace/inquello/desktop';
const fakesSource = fs.readFileSync(base + '/test/identity-fakes.ts', 'utf8').replaceAll('../src/main/', base + '/dist/main/');
fs.writeFileSync('/tmp/inquello-edge-identity-fakes.cjs', ts.transpileModule(fakesSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
const { IdentitySession } = require(base + '/dist/main/identity/session.js');
const { CredentialVault } = require(base + '/dist/main/identity/vault.js');
const { CONFIG, FakeIssuer, FakeService, fakeOpener, fakeSafeStorage } = require('/tmp/inquello-edge-identity-fakes.cjs');
(async () => {
  const now = { value: Date.now() };
  const service = new FakeService(() => now.value);
  const issuer = new FakeIssuer();
  const vault = new CredentialVault({ safeStorage: fakeSafeStorage('basic_text'), platform: 'linux', dir: '/tmp/inquello-edge-unused-vault' });
  const txn = await service.createLoginTransaction({ issuer: CONFIG.issuerUrl, client_id: CONFIG.clientId, redirect_uri: 'http://127.0.0.1:12345/callback', device_id: vault.deviceId() });
  const creds = await service.bootstrap({ login_transaction_id: txn.login_transaction_id, transaction_proof: txn.transaction_proof, redirect_uri: txn.redirect_uri, id_token: FakeIssuer.idTokenFor(txn.nonce) });
  vault.save({ version: 1, serviceUrl: CONFIG.serviceUrl, issuer: CONFIG.issuerUrl, deviceId: vault.deviceId(), sessionId: creds.session_id, principalId: creds.principal_id, displayName: 'Synthetic user', accessCredential: creds.access_credential, accessExpiresAt: creds.access_expires_at, refreshCredential: creds.refresh_credential, refreshExpiresAt: creds.refresh_expires_at, sessionExpiresAt: creds.session_expires_at, pendingLogout: null });
  const session = new IdentitySession({ config: { kind: 'configured', config: CONFIG }, vault, service, issuer, openBrowser: fakeOpener(issuer).opener, now: () => now.value, logger: { info() {}, warn() {}, error() {} } });
  if (!session.holdsSession()) throw new Error('fixture session load failed');
  const originalCommand = service.sessionCommand.bind(service);
  service.sessionCommand = async (access, envelope) => {
    // Access expires after prepareLogout/freshAccess, before the command arrives.
    now.value = service.current().accessExpiresAt + 1;
    service.refreshOutcome = 'dependency';
    return originalCommand(access, envelope);
  };
  const before = service.calls.length;
  const result = await session.signOut();
  const afterSignOut = { result, calls: service.calls.slice(before), serverRevoked: service.current().revoked, vaultCleared: vault.load() === null, revocationCalls: service.revokedWith.length };
  const recovered = await service.refresh(service.current().refresh);
  afterSignOut.refreshStillAccepted = Boolean(recovered.access_credential);
  console.log(JSON.stringify(afterSignOut, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
