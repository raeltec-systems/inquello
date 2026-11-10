// Fake `codex-app-server` for the runtime matrix tests. Speaks the same
// newline-delimited JSON as upstream stdio and is driven by environment variables:
//
//   FAKE_MODE          normal | serverRequest | badJson | oversize | exitAfterInit |
//                      ignoreEof | stderrNoise | slowReader
//   FAKE_RECORD        file that receives argv and every stdin line (one JSON per line)
//   FAKE_VERSION       version reported in userAgent (default 0.165.0)
//   FAKE_USER_AGENT    full userAgent override
//   FAKE_INIT_DELAY_MS delay before answering initialize
//   FAKE_OVERSIZE_BYTES length of the oversized line (oversize mode)
import fs from 'node:fs';

const mode = process.env.FAKE_MODE ?? 'normal';
const record = process.env.FAKE_RECORD;
const version = process.env.FAKE_VERSION ?? '0.165.0';
const initDelay = Number(process.env.FAKE_INIT_DELAY_MS ?? '0');

function log(entry) {
  if (record) fs.appendFileSync(record, `${JSON.stringify(entry)}\n`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

log({ argv: process.argv.slice(2) });

let serverRequestReply;
let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line.trim()) handle(line);
  }
});
process.stdin.on('end', () => {
  log({ eof: true });
  if (mode === 'ignoreEof') {
    setInterval(() => {}, 1000);
    return;
  }
  process.stderr.write('fake: stdin closed, exiting\n');
  process.exit(0);
});

function handle(line) {
  log({ line });
  const message = JSON.parse(line);
  if (message.method === 'initialize') {
    if (mode === 'stderrNoise') {
      // Looks like a protocol response with a mismatched version; must never be parsed.
      process.stderr.write(`${JSON.stringify({ id: message.id, result: { userAgent: 'evil/9.9.9 (stderr)' } })}\n`);
      process.stderr.write('INFO codex_app_server: starting up\n');
    }
    setTimeout(() => {
      send({
        id: message.id,
        result: {
          userAgent: process.env.FAKE_USER_AGENT ?? `${message.params.clientInfo.name}/${version} (Fake OS; x86_64) fake`,
          codexHome: '/fake/codex-home',
          platformFamily: 'fake',
          platformOs: 'fake',
        },
      });
    }, initDelay);
    return;
  }
  if (message.method === 'initialized') {
    afterInitialized();
    return;
  }
  if (message.id !== undefined && message.method === undefined) {
    // A response to a server request.
    serverRequestReply = message;
    return;
  }
  switch (message.method) {
    case 'echo':
      send({ id: message.id, result: message.params ?? null });
      break;
    case 'overload':
      send({ id: message.id, error: { code: -32001, message: 'Server overloaded; retry later.' } });
      break;
    case 'fail':
      send({ id: message.id, error: { code: -32603, message: 'internal failure', data: { detail: 1 } } });
      break;
    case 'getServerRequestReply':
      send({ id: message.id, result: serverRequestReply ?? null });
      break;
    case 'hang':
      break;
    default:
      send({ id: message.id, error: { code: -32601, message: `unknown method ${message.method}` } });
  }
}

function afterInitialized() {
  switch (mode) {
    case 'serverRequest':
      send({ id: 'srv-1', method: 'item/commandExecution/requestApproval', params: { command: 'rm -rf /' } });
      break;
    case 'badJson':
      process.stdout.write('this is not json\n');
      send({ method: 'fake/afterBadJson', params: { ok: true } });
      break;
    case 'oversize':
      process.stdout.write(`{"method":"fake/huge","params":"${'a'.repeat(Number(process.env.FAKE_OVERSIZE_BYTES ?? '4096'))}"}\n`);
      break;
    case 'exitAfterInit':
      process.stderr.write('ERROR codex_app_server: fatal one\nERROR codex_app_server: fatal two\n');
      setTimeout(() => process.exit(3), 50);
      break;
    case 'slowReader':
      process.stdin.pause();
      setTimeout(() => process.stdin.resume(), 1500);
      break;
    default:
      break;
  }
}
