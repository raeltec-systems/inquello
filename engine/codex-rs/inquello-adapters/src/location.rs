//! Store location checks and owner-only file creation.

use crate::error::OpenError;
use std::fs::OpenOptions;
use std::io::ErrorKind;
use std::path::Path;
use std::path::PathBuf;

/// Resolves `path` to the canonical store file path and refuses any location inside
/// an agent-writable root.
///
/// The parent directory must exist. Symbolic links in the parent, in the roots and
/// at the store path itself are resolved before comparing, so a link cannot smuggle
/// the store into (or out of) a writable root.
pub(crate) fn resolve_protected_store_path(
    path: &Path,
    agent_writable_roots: &[PathBuf],
) -> Result<PathBuf, OpenError> {
    let invalid = |reason: &str| OpenError::InvalidPath {
        path: path.to_path_buf(),
        reason: reason.to_string(),
    };
    let file_name = path
        .file_name()
        .ok_or_else(|| invalid("the path does not name a file"))?;
    let parent = match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent,
        _ => Path::new("."),
    };
    let parent = std::fs::canonicalize(parent)?;
    let joined = parent.join(file_name);
    let resolved = match std::fs::symlink_metadata(&joined) {
        Ok(metadata) if metadata.file_type().is_symlink() => match std::fs::canonicalize(&joined) {
            Ok(target) => target,
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Err(invalid("the path is a dangling symbolic link"));
            }
            Err(error) => return Err(error.into()),
        },
        Ok(metadata) if metadata.is_dir() => return Err(invalid("the path is a directory")),
        Ok(_) => joined,
        Err(error) if error.kind() == ErrorKind::NotFound => joined,
        Err(error) => return Err(error.into()),
    };

    for root in agent_writable_roots {
        let root = resolve_root(root)?;
        if resolved.starts_with(&root) {
            return Err(OpenError::StoreLocationNotProtected {
                path: resolved,
                root,
            });
        }
    }
    Ok(resolved)
}

/// Canonicalizes a root, or makes it absolute when it does not exist yet.
fn resolve_root(root: &Path) -> Result<PathBuf, OpenError> {
    match std::fs::canonicalize(root) {
        Ok(root) => Ok(root),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(std::path::absolute(root)?),
        Err(error) => Err(error.into()),
    }
}

/// Creates the store file with owner-only permissions on Unix, or tightens an
/// existing file to owner-only. SQLite gives its `-wal` and `-shm` files the same
/// permissions as the database file.
pub(crate) fn ensure_owner_only_file(path: &Path) -> Result<(), OpenError> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(path) {
        Ok(_) => Ok(()),
        Err(error) if error.kind() == ErrorKind::AlreadyExists => restrict_existing(path),
        Err(error) => Err(error.into()),
    }
}

#[cfg(unix)]
fn restrict_existing(path: &Path) -> Result<(), OpenError> {
    use std::os::unix::fs::PermissionsExt;
    let mode = std::fs::metadata(path)?.permissions().mode();
    if mode & 0o077 != 0 {
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode & 0o700))?;
    }
    Ok(())
}

#[cfg(not(unix))]
fn restrict_existing(_path: &Path) -> Result<(), OpenError> {
    Ok(())
}
