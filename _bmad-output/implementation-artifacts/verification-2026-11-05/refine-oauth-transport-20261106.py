from pathlib import Path
p=Path(r'D:\Projects\inquello\engine\codex-rs\rmcp-client\src\oauth_callback_transport.rs')
s=p.read_text().replace('    addr: SocketAddr,','    _addr: SocketAddr,').replace('CallbackPeer { addr, pending }','CallbackPeer { _addr: addr, pending }').replace('            addr: self.listener.local_addr()?,','            _addr: self.listener.local_addr()?,')
s=s.replace('    cancelled: Pin<Box<dyn Future<Output = ()> + Send>>,','    cancelled: Pin<Box<dyn Future<Output = ()> + Send>>,\n    cancellation_observed: bool,')
s=s.replace('cancelled: Box::pin(self.shutdown.clone().cancelled_owned()),','cancelled: Box::pin(self.shutdown.clone().cancelled_owned()),\n                        cancellation_observed: false,')
s=s.replace('cancelled: Box::pin(cancel.clone().cancelled_owned()),','cancelled: Box::pin(cancel.clone().cancelled_owned()),\n            cancellation_observed: false,')
s=s.replace('''        self.cancelled.as_mut().poll(cx).is_ready()''','''        if !self.cancellation_observed {
            self.cancellation_observed = self.cancelled.as_mut().poll(cx).is_ready();
        }
        self.cancellation_observed''')
p.write_text(s,newline='\n')
