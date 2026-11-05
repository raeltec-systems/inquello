//! Resolving a command's program in the execution environment where it runs.
//!
//! Command rules match the resolved program (Story 1.20 security fix,
//! 2026-11-05). `argv[0]` and each rule's first word are resolved once,
//! before rules match, by a [`ProgramResolver`] for the place the command
//! will run:
//!
//! - **Host** (`ExecLookup`, in `inquello_processor.rs`): this machine's
//!   working folder and the runtime's PATH, canonicalised through symlinks.
//! - **Guest** ([`GuestResolver`]): on Windows, a bounded command runs inside
//!   the Linux guest, which the host cannot inspect. The guest answers through
//!   its own executor's read-only filesystem queries ([`GuestFs`]), under the
//!   Task's sandbox, using the guest's PATH and working folder and following
//!   symlinks there. Nothing new is opened: no network, port or privilege.
//!
//! A word that does not resolve is `None`. If the environment cannot answer
//! (the guest is unreachable, a query fails other than "not found", or the
//! budget expires), every word is unresolved, so no allow rule applies and
//! the command asks.
use std::collections::HashMap;
use std::future::Future;
use std::time::Duration;

/// How long resolution may take before the command is treated as unresolved.
pub(crate) const RESOLUTION_BUDGET: Duration = Duration::from_secs(10);

/// Each program word's canonical path, or `None` when it did not resolve.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct Resolutions(HashMap<String, Option<String>>);

impl Resolutions {
    /// Nothing resolved: the environment could not answer.
    pub(crate) fn unresolved() -> Self {
        Self::default()
    }

    pub(crate) fn insert(&mut self, word: &str, resolved: Option<String>) {
        self.0.insert(word.to_string(), resolved);
    }

    /// The canonical program `word` names, if it resolved.
    pub(crate) fn get(&self, word: &str) -> Option<&str> {
        self.0.get(word).and_then(Option::as_deref)
    }
}

/// Resolves program words where a command will run.
pub(crate) trait ProgramResolver: Sync {
    /// Every word's canonical program. When the environment itself cannot
    /// answer, the result is [`Resolutions::unresolved`].
    fn resolve_all<'a>(
        &'a self,
        words: &'a [String],
    ) -> impl Future<Output = Resolutions> + Send + 'a;
}

/// [`ProgramResolver::resolve_all`] within `budget`; on expiry nothing is
/// resolved.
pub(crate) async fn resolve_within<R: ProgramResolver>(
    resolver: &R,
    words: &[String],
    budget: Duration,
) -> Resolutions {
    tokio::time::timeout(budget, resolver.resolve_all(words))
        .await
        .unwrap_or_default()
}

/// What the guest reports for one absolute path, following symlinks.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum GuestEntry {
    /// No such path, or a dangling link.
    Missing,
    /// It exists but is not a regular file.
    NotFile,
    /// A regular file, with its canonical path in the guest.
    File(String),
}

/// The guest could not answer: unreachable, or a failure other than "not
/// found" (including a path the Task's sandbox hides).
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct GuestUnavailable;

/// The guest's read-only view of its filesystem, over the existing guest
/// channel. Implemented by the executor connection and by test fakes.
pub(crate) trait GuestFs: Sync {
    fn entry<'a>(
        &'a self,
        path: &'a str,
    ) -> impl Future<Output = Result<GuestEntry, GuestUnavailable>> + Send + 'a;
}

/// Resolves programs inside the Linux guest, as the guest runtime's spawn
/// (`execvp`) would: a word holding `/` is a path relative to the guest
/// working folder; a bare word is searched along the guest PATH (empty or
/// relative entries against the working folder). Paths are guest paths and
/// are never interpreted by the host.
///
/// The guest's filesystem queries do not report execute permission, and
/// `execvp` skips a file it cannot execute. So when PATH holds regular files
/// of that name that are different programs, the word is unresolved rather
/// than guessing which one would run. Restrictive rules still match its
/// literal and file-name forms.
pub(crate) struct GuestResolver<F> {
    pub(crate) fs: F,
    /// The guest working folder (absolute).
    pub(crate) cwd: String,
    /// The guest PATH the command is given.
    pub(crate) search_path: String,
}

impl<F: GuestFs> GuestResolver<F> {
    fn anchored(&self, path: &str) -> String {
        if path.starts_with('/') {
            path.to_string()
        } else {
            format!("{}/{path}", self.cwd.trim_end_matches('/'))
        }
    }

    async fn file(&self, path: &str) -> Result<Option<String>, GuestUnavailable> {
        match self.fs.entry(path).await? {
            GuestEntry::File(canonical) if canonical.starts_with('/') => Ok(Some(canonical)),
            GuestEntry::File(_) => Err(GuestUnavailable),
            GuestEntry::Missing | GuestEntry::NotFile => Ok(None),
        }
    }

    async fn resolve_one(&self, program: &str) -> Result<Option<String>, GuestUnavailable> {
        if program.is_empty() || program.contains('\0') || !self.cwd.starts_with('/') {
            return Ok(None);
        }
        if program.contains('/') {
            return self.file(&self.anchored(program)).await;
        }
        let mut found: Option<String> = None;
        for dir in self.search_path.split(':') {
            let dir = if dir.is_empty() {
                self.cwd.clone()
            } else {
                self.anchored(dir)
            };
            let candidate = format!("{}/{program}", dir.trim_end_matches('/'));
            if let Some(canonical) = self.file(&candidate).await? {
                match &found {
                    None => found = Some(canonical),
                    Some(first) if *first == canonical => {}
                    Some(_) => return Ok(None),
                }
            }
        }
        Ok(found)
    }
}

impl<F: GuestFs> ProgramResolver for GuestResolver<F> {
    async fn resolve_all(&self, words: &[String]) -> Resolutions {
        let mut resolutions = Resolutions::default();
        for word in words {
            if resolutions.0.contains_key(word) {
                continue;
            }
            match self.resolve_one(word).await {
                Ok(resolved) => resolutions.insert(word, resolved),
                Err(GuestUnavailable) => return Resolutions::unresolved(),
            }
        }
        resolutions
    }
}

#[cfg(test)]
#[path = "inquello_program_tests.rs"]
pub(crate) mod tests;
