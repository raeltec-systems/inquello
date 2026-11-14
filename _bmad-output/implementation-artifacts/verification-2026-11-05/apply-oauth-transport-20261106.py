from pathlib import Path
p=Path(r'D:\Projects\inquello\engine\codex-rs\rmcp-client\src\perform_oauth_login.rs')
s=p.read_text()
s=s.replace('use tiny_http::Response;\nuse tiny_http::Server;\n','use tokio::net::TcpListener;\n')
a=s.index('struct CallbackServerGuard {')
b=s.index('#[derive(Debug, Clone, PartialEq, Eq)]',a)
s=s[:a]+'''#[path = "oauth_callback_transport.rs"]
mod callback_transport;
use callback_transport::CallbackServerGuard;
use callback_transport::spawn_callback_server;

'''+s[b:]
a=s.index('fn spawn_callback_server(')
b=s.index('#[derive(Debug, Clone, PartialEq, Eq)]',a)
s=s[:a]+s[b:]
a=s.index('fn local_redirect_uri(')
b=s.index('fn resolve_redirect_uri(',a)
s=s[:a]+'''fn local_redirect_uri(addr: SocketAddr) -> Result<String> {
    Ok(format!("http://{addr}/callback"))
}

'''+s[b:]
s=s.replace('fn resolve_redirect_uri(server: &Server,','fn resolve_redirect_uri(addr: SocketAddr,')
s=s.replace('return local_redirect_uri(server);','return local_redirect_uri(addr);')
s=s.replace('''let listener_port = server
            .server_addr()
            .to_ip()
            .ok_or_else(|| anyhow!("unable to determine OAuth callback listener port"))?
            .port();''','''let listener_port = addr.port();''')
a=s.index('        let bind_deadline = ')
b=s.index('        let redirect_uri = if is_enterprise_idp {',a)
s=s[:a]+'''        let server = TcpListener::bind(bind_addr).await?;
        let listener_addr = server.local_addr()?;
        let redirect_uri = resolve_redirect_uri(listener_addr, callback_url)?;
'''+s[b:]
s=s.replace('''let listener_port = server
                .server_addr()
                .to_ip()
                .ok_or_else(|| anyhow!("unable to determine enterprise callback listener port"))?
                .port();''','''let listener_port = listener_addr.port();''')
s=s.replace('        spawn_callback_server(server, tx, callback_path, callback_closed.clone());','        let guard = spawn_callback_server(server, tx, callback_path, callback_closed.clone());')
# All exits (including timeout and cancellation) drop the flow and await transport teardown.
s=s.replace('''        let stored = self.complete(emit_browser_url).await?;
        save_oauth_tokens(''','''        let closed = self.callback_closed();
        let result = self.complete(emit_browser_url).await;
        closed.await;
        let stored = result?;
        save_oauth_tokens(''')
s=s.replace('''        drop(self.guard);
        result
''','''        drop(self.guard);
        self.callback_closed.cancelled().await;
        result
''')
s=s.replace('''            let result = async {
                let stored = tokio::select!''','''            let closed = self.callback_closed();
            let result = async {
                let stored = tokio::select!''')
s=s.replace('''            if result.is_err() {
                cancellation.fail().await;''','''            closed.await;
            if result.is_err() {
                cancellation.fail().await;''')
s=s.replace('''        let server = tiny_http::Server::http("127.0.0.1:0").expect("start callback listener");
        let listener_port = server
            .server_addr()
            .to_ip()
            .expect("resolve callback listener address")
            .port();''','''        let listener_addr = "127.0.0.1:43123".parse().expect("callback listener address");
        let listener_port = 43123;''')
s=s.replace('super::resolve_redirect_uri(&server,','super::resolve_redirect_uri(listener_addr,')
p.write_text(s, newline='\n')
