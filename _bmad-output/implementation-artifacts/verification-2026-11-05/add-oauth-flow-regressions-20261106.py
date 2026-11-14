from pathlib import Path
p=Path(r'D:\Projects\inquello\engine\codex-rs\rmcp-client\src\perform_oauth_login.rs')
s=p.read_text()
s=s.replace('''fn local_redirect_uri(addr: SocketAddr) -> Result<String> {
    Ok(format!("http://{addr}/callback"))
}''','''fn local_redirect_uri(addr: SocketAddr) -> String {
    format!("http://{addr}/callback")
}''')
s=s.replace('return local_redirect_uri(addr);','return Ok(local_redirect_uri(addr));')
s=s.replace('''        let callback = timeout(self.timeout, &mut self.rx)
            .await
            .context("timed out waiting for OAuth callback")?
            .context("OAuth callback was cancelled")?;
        self.complete_callback(callback).await''','''        let callback = timeout(self.timeout, &mut self.rx)
            .await
            .context("timed out waiting for OAuth callback")
            .and_then(|callback| callback.context("OAuth callback was cancelled"));
        match callback {
            Ok(callback) => self.complete_callback(callback).await,
            Err(error) => {
                drop(self.guard);
                self.callback_closed.cancelled().await;
                Err(error)
            }
        }''')
s=s.replace('''        let listener_addr = "127.0.0.1:43123"
            .parse()
            .expect("callback listener address");
        let listener_port = 43123;''','''        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("callback listener");
        let listener_addr = listener.local_addr().expect("callback listener address");
        let listener_port = listener_addr.port();''')
a=s.index('    async fn cancelled_oauth_login_closes_callback_and_never_persists()')
b=s.index('        let closed = flow.callback_closed();',a)
s=s[:b]+'''        use tokio::io::AsyncReadExt;
        use tokio::io::AsyncWriteExt;
        let callback = Url::parse(&flow.redirect_uri)?;
        let addr = format!("{}:{}", callback.host_str().unwrap(), callback.port().unwrap());
        let mut idle = tokio::net::TcpStream::connect(&addr).await?;
        let mut partial = tokio::net::TcpStream::connect(&addr).await?;
        partial.write_all(b"GET /callback HTTP/1.1\\r\\nHost:").await?;
'''+s[b:]
b=s.index('        assert!(\n            stored_oauth_credentials(',b)
s=s[:b]+'''        assert!(tokio::net::TcpStream::connect(&addr).await.is_err());
        for stream in [&mut idle, &mut partial] {
            let mut byte = [0];
            match tokio::time::timeout(std::time::Duration::from_secs(2), stream.read(&mut byte)).await? {
                Ok(0) | Err(_) => {}
                Ok(_) => panic!("callback socket survived cancellation"),
            }
        }
'''+s[b:]
# Reuse exactly the same isolated fixture constructor for timeout/drop boundaries.
a=s.index('        let (base_url, _registration_requests) = spawn_oauth_metadata_server().await;', s.index('async fn cancelled_oauth_login_closes_callback'))
b=s.index('        use tokio::io::AsyncReadExt;',a)
constructor=s[a:b].replace('Some(/*timeout_secs*/ 5)','Some(timeout_secs)')
extra='''    async fn callback_test_flow(timeout_secs: i64) -> anyhow::Result<OauthLoginFlow> {
'''+constructor+'''        Ok(flow)
    }

    #[tokio::test]
    async fn timeout_and_dropped_flow_close_actual_callback_listener() -> anyhow::Result<()> {
        let _env = TempCodexHome::new();
        for timed_out in [false, true] {
            let flow = callback_test_flow(1).await?;
            let callback = Url::parse(&flow.redirect_uri)?;
            let addr = format!("{}:{}", callback.host_str().unwrap(), callback.port().unwrap());
            let closed = flow.callback_closed();
            if timed_out {
                let result = tokio::time::timeout(std::time::Duration::from_secs(3), flow.complete(false)).await?;
                assert!(result.unwrap_err().to_string().contains("timed out"));
            } else {
                drop(flow);
            }
            tokio::time::timeout(std::time::Duration::from_secs(2), closed).await?;
            assert!(tokio::net::TcpStream::connect(&addr).await.is_err());
            let rebound = tokio::net::TcpListener::bind(&addr).await?;
            drop(rebound);
        }
        Ok(())
    }

'''
idx=s.index('    #[tokio::test]\n    async fn configured_client_preserves_exact_scopes')
s=s[:idx]+extra+s[idx:]
p.write_text(s,newline='\n')
