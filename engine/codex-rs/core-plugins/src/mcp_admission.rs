//! Credential-free MCP admission metadata and checks for actual staged plugins.
use crate::manifest::PluginManifestFormat;
use crate::manifest::PluginManifestHooks;
use crate::manifest::PluginManifestMcpServers;
use crate::manifest::load_plugin_manifest_with_format;
use codex_app_server_protocol::PluginMcpAdmissionPolicy;
use codex_app_server_protocol::PluginMcpAdmissionTransport;
use codex_config::HooksFile;
use codex_mcp::parse_agent_plugin_mcp_config;
use codex_mcp::parse_plugin_mcp_config;
use std::fs;
use std::path::Path;
use codex_app_server_protocol::PluginMcpServerAdmission;
use codex_config::types::McpServerConfig;
use codex_config::types::McpServerTransportConfig;
use std::collections::HashMap;
use url::Url;

fn project_transport(name: &str, transport: &McpServerTransportConfig) -> PluginMcpServerAdmission {
    let (transport, http_origin) = match transport {
        McpServerTransportConfig::Stdio { .. } => (PluginMcpAdmissionTransport::Stdio, None),
        McpServerTransportConfig::StreamableHttp { url, http_headers_helper, .. } => {
            // Header helpers execute local programs. An HTTP-only admission must
            // never hide or authorize that separate outside-sandbox execution.
            let origin = if http_headers_helper.is_none() {
                Url::parse(url).ok().filter(|url| {
                    matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
                }).map(|url| url.origin().ascii_serialization())
            } else {
                None
            };
            if origin.is_some() {
                (PluginMcpAdmissionTransport::Http, origin)
            } else {
                (PluginMcpAdmissionTransport::Unknown, None)
            }
        }
    };
    PluginMcpServerAdmission { name: name.to_string(), transport, http_origin }
}

pub(crate) fn project_mcp_servers(servers: &HashMap<String, McpServerConfig>) -> Vec<PluginMcpServerAdmission> {
    let mut entries = servers.iter().map(|(name, server)| project_transport(name, &server.transport)).collect::<Vec<_>>();
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    entries
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("Plugin admission refused ({code})")]
pub struct PluginMcpAdmissionError {
    pub code: &'static str,
    pub host: Option<String>,
}

impl PluginMcpAdmissionError {
    fn new(code: &'static str) -> Self {
        Self { code, host: None }
    }
}

struct Inspection {
    servers: HashMap<String, McpServerConfig>,
    has_hooks: bool,
}

/// Read-only inspection using the runtime's own manifest and MCP parsers. Unlike
/// discovery, malformed/unreadable declared configuration is not silently empty.
fn inspect(plugin_root: &Path) -> Result<Inspection, &'static str> {
    let loaded = load_plugin_manifest_with_format(plugin_root)
        .ok_or("Cannot inspect plugin: missing or invalid manifest")?;
    let paths = &loaded.manifest.paths;
    let root = fs::canonicalize(plugin_root).map_err(|_| "Cannot inspect plugin root")?;
    let read = |path: &Path| -> Result<String, &'static str> {
        let metadata = fs::symlink_metadata(path).map_err(|_| "Cannot read declared plugin configuration")?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err("Plugin configuration must be a regular file");
        }
        let resolved = fs::canonicalize(path).map_err(|_| "Cannot resolve plugin configuration")?;
        if !resolved.starts_with(&root) {
            return Err("Plugin configuration is outside its installed bundle");
        }
        fs::read_to_string(resolved).map_err(|_| "Cannot read plugin configuration")
    };
    // The normal legacy resolver deliberately ignores malformed declarations.
    // Admission must distinguish absent from discarded, using the same selected
    // manifest rather than assuming that a missing resolved path means empty.
    if loaded.format == PluginManifestFormat::Legacy {
        let manifest_path = codex_utils_plugins::find_plugin_manifest_path(plugin_root)
            .ok_or("Cannot locate selected plugin manifest")?;
        let raw: serde_json::Value = serde_json::from_str(&read(&manifest_path)?)
            .map_err(|_| "Cannot parse selected plugin manifest")?;
        if let Some(declared) = raw.get("mcpServers") {
            if !(declared.is_string() || declared.is_object()) || paths.mcp_servers.is_none() {
                return Err("Invalid declared plugin MCP configuration");
            }
        }
    }
    let contents = match &paths.mcp_servers {
        Some(PluginManifestMcpServers::Object(contents)) => Some(contents.clone()),
        Some(PluginManifestMcpServers::Path(path)) => Some(read(path.as_path())?),
        None => {
            let path = root.join(".mcp.json");
            match fs::symlink_metadata(&path) {
                Ok(_) => Some(read(&path)?),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
                Err(_) => return Err("Cannot inspect plugin MCP configuration"),
            }
        }
    };
    let servers = if let Some(contents) = contents {
        let parsed = match loaded.format {
            PluginManifestFormat::Legacy => parse_plugin_mcp_config(&root, &contents),
            PluginManifestFormat::AgentPlugin => parse_agent_plugin_mcp_config(&root, &root.join(".plugin-data"), &contents),
        }.map_err(|_| "Cannot parse plugin MCP configuration")?;
        if !parsed.errors.is_empty() {
            return Err("Cannot parse every declared plugin MCP server");
        }
        parsed.servers.into_iter().collect()
    } else {
        HashMap::new()
    };
    // Agent Plugin overlays alter stdio environment only, never transport or
    // HTTP destinations; no program or environment helper is evaluated here.
    let has_hooks = if loaded.format == PluginManifestFormat::Legacy {
        match &paths.hooks {
            Some(PluginManifestHooks::Inline(files)) => files.iter().any(|file| !file.hooks.is_empty()),
            Some(PluginManifestHooks::Paths(paths)) => {
                let mut found = false;
                for path in paths {
                    let hooks: HooksFile = serde_json::from_str(&read(path.as_path())?)
                        .map_err(|_| "Cannot parse declared plugin hooks")?;
                    found |= !hooks.hooks.is_empty();
                }
                found
            }
            None => {
                let path = root.join("hooks/hooks.json");
                match fs::symlink_metadata(&path) {
                    Ok(_) => {
                        let hooks: HooksFile = serde_json::from_str(&read(&path)?)
                            .map_err(|_| "Cannot parse plugin hooks")?;
                        !hooks.hooks.is_empty()
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
                    Err(_) => return Err("Cannot inspect plugin hooks"),
                }
            }
        }
    } else {
        false
    };
    Ok(Inspection { servers, has_hooks })
}

pub(crate) fn inspect_plugin_mcp_admissions(plugin_root: &Path) -> Result<Vec<PluginMcpServerAdmission>, &'static str> {
    Ok(project_mcp_servers(&inspect(plugin_root)?.servers))
}

fn host_allowed(host: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        if let Some(base) = pattern.strip_prefix("**.") {
            !base.is_empty() && (host == base || host.ends_with(&format!(".{base}")))
        } else if let Some(base) = pattern.strip_prefix("*.") {
            !base.is_empty() && host != base && host.ends_with(&format!(".{base}"))
        } else {
            host == pattern
        }
    })
}

pub(crate) fn validate_staged_plugin(plugin_root: &Path, policy: &PluginMcpAdmissionPolicy) -> Result<(), PluginMcpAdmissionError> {
    let inspection = inspect(plugin_root).map_err(|_| PluginMcpAdmissionError::new("inspection_unavailable"))?;
    if inspection.has_hooks {
        return Err(PluginMcpAdmissionError::new("hooks_not_allowed"));
    }
    for (name, server) in &inspection.servers {
        validate_mcp_server_admission(name, server, policy)?;
    }
    Ok(())
}

/// Validate a captured effective registration immediately before discovery/sign-in.
pub fn validate_mcp_server_admission(name: &str, server: &McpServerConfig, policy: &PluginMcpAdmissionPolicy) -> Result<(), PluginMcpAdmissionError> {
    let entry = project_transport(name, &server.transport);
    if !policy.allow_tools {
        return Err(PluginMcpAdmissionError::new("tools_denied"));
    }
    match entry.transport {
        PluginMcpAdmissionTransport::Stdio => {
            if !policy.allow_local_servers {
                return Err(PluginMcpAdmissionError::new("local_servers_denied"));
            }
            if !policy.local_confirmed {
                return Err(PluginMcpAdmissionError::new("local_confirmation_required"));
            }
        }
        PluginMcpAdmissionTransport::Http => {
            let host = entry.http_origin.as_deref().and_then(|origin| Url::parse(origin).ok())
                .and_then(|url| url.host_str().map(str::to_string))
                .ok_or(PluginMcpAdmissionError::new("inspection_unavailable"))?;
            if !host_allowed(&host, &policy.allowed_domains) {
                return Err(PluginMcpAdmissionError { code: "host_not_allowed", host: Some(host) });
            }
        }
        PluginMcpAdmissionTransport::Unknown => {
            return Err(PluginMcpAdmissionError::new("unknown_transport"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn transport(value: serde_json::Value) -> McpServerTransportConfig {
        serde_json::from_value(value).unwrap_or_else(|error| panic!("{error}"))
    }

    #[test]
    fn projection_never_exports_programs_headers_credentials_or_paths() {
        let stdio = project_transport("local", &transport(json!({
            "command": "/private/secret-program", "args": ["sentinel-argument"],
            "env": { "TOKEN": "sentinel-token" }, "cwd": "/private/working-folder",
        })));
        let http = project_transport("remote", &transport(json!({
            "url": "https://sentinel-user:sentinel-password@api.example.com:8443/private?token=sentinel-query#sentinel-fragment",
            "http_headers": { "Authorization": "sentinel-header" },
            "bearer_token_env_var": "sentinel-environment-name",
        })));
        assert_eq!(stdio.transport, PluginMcpAdmissionTransport::Stdio);
        assert_eq!(stdio.http_origin, None);
        assert_eq!(http.http_origin.as_deref(), Some("https://api.example.com:8443"));
        let serialized = serde_json::to_string(&vec![stdio, http]).unwrap_or_else(|error| panic!("{error}"));
        assert!(!serialized.contains("sentinel"));
        assert!(!serialized.contains("private"));
        assert!(!serialized.contains("command"));
        assert!(!serialized.contains("headers"));
    }

    #[test]
    fn unresolved_or_executable_http_configuration_is_unknown_not_host_authorized() {
        for value in [
            json!({ "url": "not a url" }),
            json!({ "url": "file:///private/config" }),
            json!({ "url": "https://api.example.com", "http_headers_helper": "private-command" }),
        ] {
            let entry = project_transport("fixture", &transport(value));
            assert_eq!(entry.transport, PluginMcpAdmissionTransport::Unknown);
            assert_eq!(entry.http_origin, None);
        }
    }

    fn fixture(contents: serde_json::Value) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        fs::create_dir(root.path().join(".codex-plugin")).unwrap_or_else(|error| panic!("{error}"));
        fs::write(root.path().join(".codex-plugin/plugin.json"), r#"{"name":"fixture","version":"1.0.0"}"#)
            .unwrap_or_else(|error| panic!("{error}"));
        fs::write(root.path().join(".mcp.json"), contents.to_string())
            .unwrap_or_else(|error| panic!("{error}"));
        root
    }

    fn policy() -> PluginMcpAdmissionPolicy {
        PluginMcpAdmissionPolicy {
            allow_tools: true,
            allow_local_servers: false,
            local_confirmed: false,
            allowed_domains: vec!["api.example.com".to_string()],
        }
    }

    #[test]
    fn strict_inspection_and_policy_cover_tools_hosts_local_confirmation_and_parse_failure() {
        let remote = fixture(json!({ "mcpServers": { "remote": { "url": "https://api.example.com/mcp" } } }));
        assert!(validate_staged_plugin(remote.path(), &policy()).is_ok());
        let mut denied = policy();
        denied.allow_tools = false;
        assert!(validate_staged_plugin(remote.path(), &denied).is_err());
        denied = policy();
        denied.allowed_domains.clear();
        assert!(validate_staged_plugin(remote.path(), &denied).is_err());
        let local = fixture(json!({ "mcpServers": { "local": { "command": "never-run-fixture" } } }));
        assert!(validate_staged_plugin(local.path(), &policy()).is_err());
        let mut confirmed = policy();
        confirmed.allow_local_servers = true;
        assert!(validate_staged_plugin(local.path(), &confirmed).is_err());
        confirmed.local_confirmed = true;
        assert!(validate_staged_plugin(local.path(), &confirmed).is_ok());
        let malformed = fixture(json!({ "mcpServers": { "bad": { "notATransport": true } } }));
        assert!(inspect_plugin_mcp_admissions(malformed.path()).is_err());
        assert!(validate_staged_plugin(malformed.path(), &confirmed).is_err());
    }

    #[test]
    fn malformed_manifest_mcp_declarations_are_not_treated_as_absent() {
        for declaration in [json!(17), json!(true), json!(null), json!([]),
            json!(["./mcp.json"]), json!("../outside.json"), json!("relative.json")] {
            for default_present in [false, true] {
                let root = fixture(json!({ "mcpServers": {} }));
                if !default_present {
                    fs::remove_file(root.path().join(".mcp.json")).unwrap();
                }
                fs::write(root.path().join(".codex-plugin/plugin.json"), json!({
                    "name": "fixture", "mcpServers": declaration,
                }).to_string()).unwrap();
                assert!(inspect_plugin_mcp_admissions(root.path()).is_err());
                let refusal = validate_staged_plugin(root.path(), &policy()).unwrap_err();
                assert_eq!(refusal.code, "inspection_unavailable");
            }
        }
        // A genuinely absent declaration/default remains a valid empty plugin.
        let root = fixture(json!({ "mcpServers": {} }));
        fs::remove_file(root.path().join(".mcp.json")).unwrap();
        assert!(validate_staged_plugin(root.path(), &policy()).is_ok());
    }

    #[test]
    fn wildcard_hosts_match_domain_boundaries_not_similar_suffixes() {
        let subdomains = vec!["*.example.com".to_string()];
        assert!(host_allowed("api.example.com", &subdomains));
        assert!(!host_allowed("example.com", &subdomains));
        assert!(!host_allowed("notexample.com", &subdomains));
        assert!(!host_allowed("example.com.evil.test", &subdomains));
        let inclusive = vec!["**.example.com".to_string()];
        assert!(host_allowed("example.com", &inclusive));
        assert!(host_allowed("nested.api.example.com", &inclusive));
    }

    #[test]
    fn staged_gate_rejects_changed_and_same_version_content_before_cache_activation() {
        use crate::store::PluginStore;
        use codex_plugin::PluginId;
        use codex_utils_absolute_path::AbsolutePathBuf;
        let source = fixture(json!({ "mcpServers": { "remote": { "url": "https://api.example.com/mcp" } } }));
        let home = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let store = PluginStore::new(home.path().to_path_buf()).with_mcp_admission(Some(policy()));
        let id = PluginId::new("fixture".to_string(), "test-marketplace".to_string())
            .unwrap_or_else(|error| panic!("{error}"));
        let root = AbsolutePathBuf::try_from(source.path().to_path_buf()).unwrap_or_else(|error| panic!("{error}"));
        let first = store.install(root.clone(), id.clone()).unwrap_or_else(|error| panic!("{error}"));
        let original = fs::read(first.installed_path.as_path().join(".mcp.json"))
            .unwrap_or_else(|error| panic!("{error}"));
        // A prior catalog inspection allowed HTTP. Change the source before the
        // actual install; its same-version staged bytes must be checked again.
        assert_eq!(inspect_plugin_mcp_admissions(source.path()).unwrap_or_else(|error| panic!("{error}"))[0].transport, PluginMcpAdmissionTransport::Http);
        fs::write(source.path().join(".mcp.json"), json!({
            "mcpServers": { "local": { "command": "never-execute", "args": ["sentinel"] } },
        }).to_string()).unwrap_or_else(|error| panic!("{error}"));
        assert!(store.install(root, id).is_err());
        let current = fs::read(first.installed_path.as_path().join(".mcp.json"))
            .unwrap_or_else(|error| panic!("{error}"));
        assert_eq!(current, original);
    }

}
