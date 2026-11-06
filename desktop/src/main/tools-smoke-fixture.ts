import http from 'node:http';

/** Owned loopback-only MCP discovery fixture. No auth or tool invocation exists. */
export async function startToolsSmokeFixture() {
  const counts = { initialize: 0, toolsList: 0, forbidden: 0 };
  const server = http.createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/mcp') {
      request.resume(); response.writeHead(405).end(); return;
    }
    let body = '', bytes = 0;
    request.setEncoding('utf8');
    request.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 16_384) { counts.forbidden++; request.destroy(); return; }
      body += chunk;
    });
    request.on('end', () => {
      try {
        const message = JSON.parse(body) as { id?: string | number; method?: string };
        if (message.id === undefined && message.method === 'notifications/initialized') {
          response.writeHead(202).end(); return;
        }
        let result: unknown;
        if (message.method === 'initialize') {
          counts.initialize++;
          result = { protocolVersion:'2025-03-26', capabilities:{tools:{}}, serverInfo:{name:'inquello-ui-fixture',version:'1'} };
        } else if (message.method === 'tools/list') {
          counts.toolsList++;
          result = { tools:[{name:'fictional_echo',description:'Discovery only; invocation is refused.',inputSchema:{type:'object',properties:{}}}] };
        } else if (message.method === 'resources/list' || message.method === 'resources/templates/list') {
          result = message.method === 'resources/list' ? {resources:[]} : {resourceTemplates:[]};
        } else {
          counts.forbidden++; response.writeHead(403).end(); return;
        }
        response.writeHead(200, {'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
      } catch { counts.forbidden++; response.writeHead(400).end(); }
      finally { body = ''; }
    });
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  await new Promise<void>((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const url = `http://127.0.0.1:${(server.address() as {port:number}).port}/mcp`;
  return {url,counts,close:() => new Promise<void>((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('Owned MCP fixture did not close')),5_000);
    server.close(error => {clearTimeout(timer);error?reject(error):resolve();});
    server.closeAllConnections();
  })};
}
