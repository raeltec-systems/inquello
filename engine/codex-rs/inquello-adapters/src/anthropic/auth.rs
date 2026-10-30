//! Volatile private-RPC handoff. No Serialize/Debug implementation contains a key.
use inquello_protocol::inference::Binding;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthScope {
    pub principal_id: String,
    pub route_id: String,
    pub account_ref: String,
    pub generation: u64,
}
struct Secret(Vec<u8>);
impl Drop for Secret { fn drop(&mut self) { self.0.fill(0); } }
struct Credential { scope: AuthScope, key: Secret, cancelled: CancellationToken }
struct State {
    credentials: HashMap<(String, String), Credential>,
    generations: HashMap<(String, String), u64>,
    attempts: HashMap<String, (String, String, CancellationToken)>,
    used_attempts: HashSet<String>,
}
#[derive(Clone)]
pub struct AuthStore { state: Arc<Mutex<State>> }
impl Default for AuthStore {
    fn default() -> Self { Self { state: Arc::new(Mutex::new(State {
        credentials: HashMap::new(), generations: HashMap::new(),
        attempts: HashMap::new(), used_attempts: HashSet::new(),
    })) } }
}
impl std::fmt::Debug for AuthStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str("AuthStore([private])") }
}
impl Drop for State {
    fn drop(&mut self) {
        for credential in self.credentials.values() { credential.cancelled.cancel(); }
        for (_, _, cancellation) in self.attempts.values() { cancellation.cancel(); }
    }
}
impl AuthStore {
    /// Only the bound-principal private stdio handler may call this. No policy or
    /// evidence is established by a successful credential handoff.
    pub fn install(&self, scope: AuthScope, key: String) -> Result<(), &'static str> {
        let secret = Secret(key.into_bytes());
        if scope.route_id != "claude-api-key" || uuid::Uuid::parse_str(&scope.principal_id).is_err()
            || uuid::Uuid::parse_str(&scope.account_ref).is_err() || scope.generation == 0
            || !(16..=4096).contains(&secret.0.len()) || !secret.0.starts_with(b"sk-ant-")
            || !secret.0.iter().all(|b| (0x21..=0x7e).contains(b)) {
            return Err("invalid private provider handoff");
        }
        let mut state = self.state.lock().map_err(|_| "private provider state unavailable")?;
        let id = (scope.principal_id.clone(), scope.route_id.clone());
        if state.generations.get(&id).is_some_and(|generation| scope.generation <= *generation) {
            return Err("stale private provider generation");
        }
        if (state.credentials.len() >= 16 && !state.credentials.contains_key(&id))
            || (state.generations.len() >= 1024 && !state.generations.contains_key(&id)) {
            return Err("private provider capacity reached");
        }
        if let Some(previous) = state.credentials.remove(&id) { previous.cancelled.cancel(); }
        state.generations.insert(id.clone(), scope.generation);
        state.credentials.insert(id, Credential { scope, key: secret, cancelled: CancellationToken::new() });
        Ok(())
    }
    pub fn invalidate(&self, principal_id: &str, route_id: &str, generation: u64) -> Result<(), &'static str> {
        let mut state = self.state.lock().map_err(|_| "private provider state unavailable")?;
        let id = (principal_id.to_string(), route_id.to_string());
        if state.generations.get(&id).is_some_and(|current| generation < *current) {
            return Err("stale private provider generation");
        }
        if state.generations.len() >= 1024 && !state.generations.contains_key(&id) {
            return Err("private provider capacity reached");
        }
        state.generations.insert(id.clone(), generation);
        if let Some(previous) = state.credentials.remove(&id) { previous.cancelled.cancel(); }
        Ok(())
    }
    pub fn invalidate_principal(&self, principal_id: &str) {
        if let Ok(mut state) = self.state.lock() {
            state.credentials.retain(|(principal, _), credential| {
                if principal == principal_id { credential.cancelled.cancel(); false } else { true }
            });
            for (principal, _, cancellation) in state.attempts.values() {
                if principal == principal_id { cancellation.cancel(); }
            }
        }
    }
    pub fn cancel_task(&self, principal_id: &str, task_id: &str) {
        if let Ok(state) = self.state.lock() {
            for (principal, task, cancellation) in state.attempts.values() {
                if principal == principal_id && task == task_id { cancellation.cancel(); }
            }
        }
    }
    pub fn lease(&self, binding: &Binding) -> Result<AttemptLease, &'static str> {
        binding.validate()?;
        let mut state = self.state.lock().map_err(|_| "private provider state unavailable")?;
        if state.used_attempts.contains(&binding.attempt_id) { return Err("attempt already dispatched"); }
        // Never evict replay protection and accidentally authorize another dispatch.
        if state.used_attempts.len() >= 100_000 || state.attempts.len() >= 64 {
            return Err("inference attempt capacity reached");
        }
        let credential = state.credentials.get(&(binding.principal_id.clone(), binding.route_id.clone()))
            .ok_or("private provider credential unavailable")?;
        if credential.scope.generation != binding.credential_generation
            || credential.scope.account_ref != binding.account_ref || credential.cancelled.is_cancelled() {
            return Err("stale private provider credential");
        }
        let cancelled = credential.cancelled.child_token();
        state.used_attempts.insert(binding.attempt_id.clone());
        state.attempts.insert(binding.attempt_id.clone(),
            (binding.principal_id.clone(), binding.task_id.clone(), cancelled.clone()));
        Ok(AttemptLease { store: self.clone(), binding: binding.clone(), cancelled })
    }
}
/// Non-cloneable one-dispatch authority; never constructed from serialized input.
pub struct AttemptLease { store: AuthStore, binding: Binding, cancelled: CancellationToken }
impl AttemptLease {
    pub fn binding(&self) -> &Binding { &self.binding }
    pub fn cancellation(&self) -> CancellationToken { self.cancelled.clone() }
    pub fn is_current(&self) -> bool { !self.cancelled.is_cancelled() }
    pub(crate) fn authorize(&self, builder: reqwest::RequestBuilder) -> Result<reqwest::RequestBuilder, &'static str> {
        if !self.is_current() { return Err("inference attempt cancelled"); }
        let state = self.store.state.lock().map_err(|_| "private provider state unavailable")?;
        let credential = state.credentials.get(&(self.binding.principal_id.clone(), self.binding.route_id.clone()))
            .ok_or("private provider credential unavailable")?;
        if credential.scope.generation != self.binding.credential_generation || credential.cancelled.is_cancelled() {
            return Err("stale private provider credential");
        }
        let mut header = reqwest::header::HeaderValue::from_bytes(&credential.key.0)
            .map_err(|_| "invalid private provider handoff")?;
        header.set_sensitive(true);
        Ok(builder.header("x-api-key", header))
    }
}
impl Drop for AttemptLease {
    fn drop(&mut self) {
        if let Ok(mut state) = self.store.state.lock() { state.attempts.remove(&self.binding.attempt_id); }
    }
}
