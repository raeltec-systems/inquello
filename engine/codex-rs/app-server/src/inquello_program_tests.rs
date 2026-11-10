//! Guest program resolution against a fake guest channel. The real channel
//! (the WSL executor's filesystem queries) cannot run on this Linux host.
use super::*;
use std::sync::Mutex;

/// A fake guest filesystem: regular files, symlinks and directories by
/// absolute guest path, and the queries it answered.
#[derive(Default)]
pub(crate) struct FakeGuest {
    pub(crate) files: Vec<&'static str>,
    pub(crate) links: HashMap<&'static str, &'static str>,
    pub(crate) dirs: Vec<&'static str>,
    pub(crate) unreachable: bool,
    pub(crate) hang: bool,
    pub(crate) queries: Mutex<Vec<String>>,
}

impl FakeGuest {
    fn canonical(&self, path: &str) -> Option<String> {
        // Normalise `.`/`..` and follow links component by component.
        let mut out: Vec<String> = Vec::new();
        let mut pending: Vec<String> = path.split('/').rev().map(str::to_string).collect();
        let mut hops = 0;
        while let Some(part) = pending.pop() {
            match part.as_str() {
                "" | "." => continue,
                ".." => {
                    out.pop();
                    continue;
                }
                _ => {}
            }
            out.push(part);
            let current = format!("/{}", out.join("/"));
            if let Some(target) = self.links.get(current.as_str()) {
                hops += 1;
                if hops > 16 {
                    return None;
                }
                out.clear();
                pending.extend(target.split('/').rev().map(str::to_string));
            }
        }
        Some(format!("/{}", out.join("/")))
    }
}

impl GuestFs for FakeGuest {
    async fn entry(&self, path: &str) -> Result<GuestEntry, GuestUnavailable> {
        self.queries
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push(path.to_string());
        if self.hang {
            std::future::pending::<()>().await;
        }
        if self.unreachable {
            return Err(GuestUnavailable);
        }
        let Some(canonical) = self.canonical(path) else {
            return Ok(GuestEntry::Missing);
        };
        if self.files.contains(&canonical.as_str()) {
            Ok(GuestEntry::File(canonical))
        } else if self.dirs.contains(&canonical.as_str()) {
            Ok(GuestEntry::NotFile)
        } else {
            Ok(GuestEntry::Missing)
        }
    }
}

/// A merged-/usr Ubuntu guest: `/bin` links to `usr/bin`; `sh` is `dash`;
/// `true` in the Task folder links to `touch`.
pub(crate) fn ubuntu() -> FakeGuest {
    FakeGuest {
        files: vec![
            "/usr/bin/sh",
            "/usr/bin/dash",
            "/usr/bin/true",
            "/usr/bin/touch",
        ],
        links: HashMap::from([
            ("/bin", "/usr/bin"),
            ("/usr/bin/sh", "/usr/bin/dash"),
            ("/var/lib/inquello/tasks/s/t/true", "/usr/bin/touch"),
        ]),
        dirs: vec!["/usr/bin", "/var/lib/inquello/tasks/s/t", "/usr/bin/sub"],
        ..FakeGuest::default()
    }
}

/// The resolver a bounded Windows Task uses, over a fake guest channel.
pub(crate) fn guest(fs: FakeGuest) -> GuestResolver<FakeGuest> {
    GuestResolver {
        fs,
        cwd: "/var/lib/inquello/tasks/s/t".into(),
        search_path: "/usr/bin:/bin".into(),
    }
}

fn words(words: &[&str]) -> Vec<String> {
    words.iter().map(|word| (*word).to_string()).collect()
}

#[tokio::test]
async fn guest_paths_resolve_through_the_guest_path_cwd_and_symlinks() {
    let resolver = guest(ubuntu());
    let resolved = resolver
        .resolve_all(&words(&[
            "sh",
            "/bin/sh",
            "/usr/bin/sh",
            "./true",
            "true",
            "missing",
            "/usr/bin/sub",
            "",
        ]))
        .await;
    // The bare name, /bin and the /usr/bin link all reach the same program.
    assert_eq!(resolved.get("sh"), Some("/usr/bin/dash"));
    assert_eq!(resolved.get("/bin/sh"), Some("/usr/bin/dash"));
    assert_eq!(resolved.get("/usr/bin/sh"), Some("/usr/bin/dash"));
    // A path with `/` is relative to the guest working folder, not the host's.
    assert_eq!(resolved.get("./true"), Some("/usr/bin/touch"));
    // A bare name is searched only along the guest PATH, never the cwd.
    assert_eq!(resolved.get("true"), Some("/usr/bin/true"));
    assert_eq!(resolved.get("missing"), None);
    assert_eq!(
        resolved.get("/usr/bin/sub"),
        None,
        "a directory is no program"
    );
    assert_eq!(resolved.get(""), None);
    // Nothing was looked up on this host: every query was a guest path.
    let queries = resolver
        .fs
        .queries
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    assert!(
        queries.iter().all(|path| path.starts_with('/')),
        "{queries:?}"
    );
    assert!(queries.contains(&"/var/lib/inquello/tasks/s/t/./true".to_string()));
}

#[tokio::test]
async fn different_programs_of_one_name_on_the_guest_path_stay_unresolved() {
    // Execute bits are not reported, so execvp's choice cannot be known.
    let mut fs = ubuntu();
    fs.links.remove("/bin");
    fs.files.push("/bin/tool");
    fs.files.push("/usr/bin/tool");
    fs.dirs.push("/bin");
    let resolved = guest(fs).resolve_all(&words(&["tool", "/bin/tool"])).await;
    assert_eq!(resolved.get("tool"), None);
    assert_eq!(resolved.get("/bin/tool"), Some("/bin/tool"));
}

#[tokio::test]
async fn an_unreachable_or_slow_guest_leaves_every_word_unresolved() {
    let mut fs = ubuntu();
    fs.unreachable = true;
    assert_eq!(
        guest(fs).resolve_all(&words(&["sh", "/bin/sh"])).await,
        Resolutions::unresolved()
    );
    let mut fs = ubuntu();
    fs.hang = true;
    let resolved = resolve_within(
        &guest(fs),
        &words(&["sh"]),
        std::time::Duration::from_millis(50),
    )
    .await;
    assert_eq!(resolved, Resolutions::unresolved());
    assert_eq!(resolved.get("sh"), None);
}

#[tokio::test]
async fn one_failed_guest_query_leaves_every_word_unresolved() {
    // A guest that cannot answer for one word answers for none: a rule word
    // that failed must not leave the command half-resolved.
    struct Partial(FakeGuest);
    impl GuestFs for Partial {
        async fn entry(&self, path: &str) -> Result<GuestEntry, GuestUnavailable> {
            if path.starts_with("/bin/") {
                Err(GuestUnavailable)
            } else {
                self.0.entry(path).await
            }
        }
    }
    let resolver = GuestResolver {
        fs: Partial(ubuntu()),
        cwd: "/var/lib/inquello/tasks/s/t".into(),
        search_path: "/usr/bin".into(),
    };
    assert_eq!(
        resolver.resolve_all(&words(&["sh", "/bin/sh"])).await,
        Resolutions::unresolved()
    );
}

#[tokio::test]
async fn a_relative_guest_path_without_a_known_guest_folder_is_unresolved() {
    let mut resolver = guest(ubuntu());
    resolver.cwd = String::new();
    let resolved = resolver.resolve_all(&words(&["./true", "sh"])).await;
    assert_eq!(resolved.get("./true"), None);
    assert_eq!(resolved.get("sh"), None);
}
