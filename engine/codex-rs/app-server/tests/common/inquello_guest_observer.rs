//! Test-only observer for synthetic Task markers and actual Linux process
//! identity. This is never registered as an application/model capability.
#![allow(clippy::expect_used, clippy::unwrap_used)]
use std::path::{Path, PathBuf};

pub fn task_output(root: &Path, task: &str, principal: &str) -> PathBuf {
    #[cfg(windows)]
    {
        use sha2::{Digest, Sha256};
        uuid::Uuid::parse_str(task).expect("fixture Task identity");
        let parent = std::fs::canonicalize(root.join("tasks")).expect("fixture Task parent");
        let normalized = parent
            .to_string_lossy()
            .replace('\\', "/")
            .trim_start_matches("//?/")
            .to_lowercase();
        let scope = format!("{:x}", Sha256::digest(format!("{normalized}\0{principal}")));
        PathBuf::from(format!("/var/lib/inquello/tasks/{scope}/{task}/output"))
    }
    #[cfg(not(windows))]
    {
        let _ = principal;
        root.join("tasks").join(task).join("output")
    }
}

#[cfg(windows)]
pub fn observe(operation: &str, argument: &str, value: &str) -> serde_json::Value {
    observe_result(operation, argument, value).expect("fixed guest fixture observation")
}
#[cfg(windows)]
fn observe_result(
    operation: &str,
    argument: &str,
    value: &str,
) -> Result<serde_json::Value, String> {
    const SCRIPT: &str = r#"
import base64, json, os, pathlib, signal, sys
operation, argument, value = sys.argv[1:]
if operation == 'erase-scope':
    assert len(argument) == 64 and all(c in '0123456789abcdef' for c in argument)
    __import__('uuid').UUID(value)
    response = __import__('subprocess').run(['/usr/bin/python3','-I','/usr/local/libexec/inquello-broker.py','scope',argument,'00000000-0000-0000-0000-000000000000',value], input='{"action":"erase"}', text=True, capture_output=True)
    assert response.returncode == 0, response.stderr
    result = json.loads(response.stdout)
elif operation in ['exists', 'read', 'write']:
    path = pathlib.Path(argument)
    parts = path.parts
    assert parts[:5] == ('/', 'var', 'lib', 'inquello', 'tasks')
    assert len(parts) == 9 and len(parts[5]) == 64 and parts[7] == 'output'
    assert all(c in '0123456789abcdef' for c in parts[5])
    __import__('uuid').UUID(parts[6])
    assert parts[8] in ['pid.txt','pid-namespace.txt','started.txt','release.txt','late.txt','authorized.txt']
    if operation == 'exists': result = path.exists()
    elif operation == 'read':
        with path.open('rb') as source: data = source.read(4097)
        assert len(data) <= 4096
        result = data.decode()
    else:
        assert parts[8] == 'release.txt'
        data = base64.b64decode(value, validate=True)
        assert len(data) <= 4096
        path.write_bytes(data)
        result = True
elif operation == 'resolve-pid':
    inner = int(argument)
    assert value.startswith('pid:[') and value.endswith(']') and value[5:-1].isdigit()
    matches = []
    for entry in pathlib.Path('/proc').iterdir():
        if not entry.name.isdigit(): continue
        try:
            if os.readlink(entry / 'ns/pid') != value: continue
            status = (entry / 'status').read_text()
            ids = next(line.split()[1:] for line in status.splitlines() if line.startswith('NSpid:'))
            if int(ids[-1]) == inner: matches.append(int(entry.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError): continue
    assert len(matches) == 1, 'fixture namespace/PID is not uniquely observable'
    result = matches[0]
else:
    pid = int(argument)
    assert pid > 1
    if operation == 'process':
        try: result = pathlib.Path(f'/proc/{pid}/stat').read_text()
        except FileNotFoundError: result = None
    elif operation == 'command': result = pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().decode()
    elif operation == 'cleanup':
        try:
            fd = os.pidfd_open(pid)
            signal.pidfd_send_signal(fd, signal.SIGKILL)
            os.close(fd)
        except ProcessLookupError: pass
        result = True
    else: raise ValueError('unknown fixture observation')
print(json.dumps(result))
"#;
    let result = running_guest_command()?
        .args([
            "/usr/bin/python3",
            "-I",
            "-c",
            SCRIPT,
            operation,
            argument,
            value,
        ])
        .output()
        .map_err(|error| error.to_string())?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).into_owned());
    }
    serde_json::from_slice(&result.stdout).map_err(|error| error.to_string())
}

#[cfg(windows)]
fn running_guest_command() -> Result<std::process::Command, String> {
    let system = std::env::var("SystemRoot").expect("Windows SystemRoot");
    // Observation/cleanup must never boot a stopped guest and bypass native
    // storage preflight. Listing running distros is a host-only operation.
    let running =
        codex_utils_process::background_command(Path::new(&system).join("System32/wsl.exe"))
            .env_clear()
            .env("SystemRoot", &system)
            .env("WINDIR", &system)
            .env("TEMP", "D:\\Inquello\\tmp")
            .env("TMP", "D:\\Inquello\\tmp")
            .current_dir("D:\\Inquello\\tmp")
            .args(["--list", "--running", "--quiet"])
            .output()
            .map_err(|error| error.to_string())?;
    if !running.status.success() {
        return Err("cannot inspect running guest".into());
    }
    let names = if running.stdout.contains(&0) {
        String::from_utf16_lossy(
            &running
                .stdout
                .chunks_exact(2)
                .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
                .collect::<Vec<_>>(),
        )
    } else {
        String::from_utf8_lossy(&running.stdout).into_owned()
    };
    if !names
        .lines()
        .any(|name| name.trim().trim_start_matches('\u{feff}') == "Inquello-Engine")
    {
        return Err("guest fixture observer cannot launch an inactive guest".into());
    }
    let mut command =
        codex_utils_process::background_command(Path::new(&system).join("System32/wsl.exe"));
    command
        .env_clear()
        .env("SystemRoot", &system)
        .env("WINDIR", &system)
        .env("TEMP", "D:\\Inquello\\tmp")
        .env("TMP", "D:\\Inquello\\tmp")
        .current_dir("D:\\Inquello\\tmp")
        .args([
            "-d",
            "Inquello-Engine",
            "--user",
            "inquello",
            "--cd",
            "/",
            "--exec",
            "/usr/bin/env",
            "-i",
            "PATH=/usr/bin:/bin",
            "LANG=C.UTF-8",
        ]);
    Ok(command)
}

#[cfg(windows)]
struct GuestKeepalive(std::process::Child);
#[cfg(windows)]
impl Drop for GuestKeepalive {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Declared before the native server so it drops after server shutdown, but
/// before TempDir removes the canonical profile locator used to derive scope.
pub struct FixtureScope {
    root: PathBuf,
    principal: String,
    #[cfg(windows)]
    keepalive: Option<GuestKeepalive>,
}
impl FixtureScope {
    pub fn new(root: &Path, principal: &str) -> Self {
        Self {
            root: root.to_owned(),
            principal: principal.to_owned(),
            #[cfg(windows)]
            keepalive: None,
        }
    }

    /// The admission-timeout witness deliberately outlasts WSL idle shutdown.
    /// Hold only an already validated, running guest until scoped cleanup ends.
    /// This cannot boot a stopped guest and grants no Task execution authority.
    pub fn keep_running(&mut self) {
        #[cfg(windows)]
        {
            let child = running_guest_command()
                .expect("native execution already started the validated guest")
                .args(["/usr/bin/sleep", "300"])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
                .expect("bounded fixture guest keepalive");
            self.keepalive = Some(GuestKeepalive(child));
        }
    }
}
impl Drop for FixtureScope {
    fn drop(&mut self) {
        #[cfg(windows)]
        {
            if !self.root.join("tasks").is_dir() {
                return;
            }
            let output = task_output(
                &self.root,
                "00000000-0000-0000-0000-000000000000",
                &self.principal,
            );
            let scope = output
                .to_string_lossy()
                .replace('\\', "/")
                .split('/')
                .nth(5)
                .unwrap()
                .to_owned();
            let profile = Path::new("D:\\Inquello\\profiles").join(&scope);
            if !profile.exists() {
                return;
            }
            let result: Result<(), String> = (|| {
                let proof: serde_json::Value = serde_json::from_slice(
                    &std::fs::read("D:\\Inquello\\runtime\\storage-proof.json")
                        .map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
                let boot = proof["bootId"]
                    .as_str()
                    .ok_or("storage boot identity missing")?;
                let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
                loop {
                    match observe_result("erase-scope", &scope, boot) {
                        Ok(value) if value["erased"] == true => break,
                        result if std::time::Instant::now() >= deadline => {
                            return Err(format!("guest fixture cleanup unconfirmed: {result:?}"));
                        }
                        _ => std::thread::sleep(std::time::Duration::from_millis(100)),
                    }
                }
                let actual = std::fs::canonicalize(&profile)
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .replace('\\', "/")
                    .trim_start_matches("//?/")
                    .to_lowercase();
                if actual != format!("d:/inquello/profiles/{scope}") {
                    return Err("fixture profile deletion redirected".into());
                }
                std::fs::remove_dir_all(&profile).map_err(|e| e.to_string())
            })();
            if let Err(error) = result {
                if std::thread::panicking() {
                    eprintln!("retained failed fixture scope {scope}: {error}");
                } else {
                    panic!("fixture scope cleanup: {error}");
                }
            }
        }
        #[cfg(not(windows))]
        {
            let _ = (&self.root, &self.principal);
        }
    }
}

pub fn exists(path: PathBuf) -> bool {
    #[cfg(windows)]
    {
        observe("exists", &path.to_string_lossy().replace('\\', "/"), "")
            .as_bool()
            .unwrap()
    }
    #[cfg(not(windows))]
    {
        path.exists()
    }
}
pub fn read(path: PathBuf) -> std::io::Result<String> {
    #[cfg(windows)]
    {
        Ok(
            observe("read", &path.to_string_lossy().replace('\\', "/"), "")
                .as_str()
                .unwrap()
                .to_owned(),
        )
    }
    #[cfg(not(windows))]
    {
        std::fs::read_to_string(path)
    }
}
pub fn write(path: PathBuf, bytes: &[u8]) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use base64::Engine;
        observe(
            "write",
            &path.to_string_lossy().replace('\\', "/"),
            &base64::engine::general_purpose::STANDARD.encode(bytes),
        );
        Ok(())
    }
    #[cfg(not(windows))]
    {
        std::fs::write(path, bytes)
    }
}
pub fn pid(output: &Path) -> u32 {
    let inner = read(output.join("pid.txt"))
        .unwrap()
        .trim()
        .parse::<u32>()
        .unwrap();
    #[cfg(windows)]
    {
        observe(
            "resolve-pid",
            &inner.to_string(),
            read(output.join("pid-namespace.txt")).unwrap().trim(),
        )
        .as_u64()
        .unwrap()
        .try_into()
        .unwrap()
    }
    #[cfg(not(windows))]
    {
        inner
    }
}
