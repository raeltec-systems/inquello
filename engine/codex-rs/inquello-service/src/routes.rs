//! The `/v1` routes.
//!
//! Bodies are parsed here rather than with axum's `Json` extractor so a malformed
//! body always gets the fixed `unsupported_contract` answer: a parser message
//! could otherwise echo part of the request, credentials included. Every response
//! is marked `Cache-Control: no-store`.

use crate::commands;
use crate::error::ApiError;
use crate::login;
use crate::server::AppState;
use crate::sessions;
use crate::workspace_commands;
use crate::workspaces;
use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::Path;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::http::HeaderValue;
use axum::http::header::AUTHORIZATION;
use axum::http::header::CACHE_CONTROL;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use inquello_protocol::PROTOCOL_MAJOR;
use inquello_protocol::SCHEMA_VERSION;
use inquello_protocol::command::Capabilities;
use inquello_protocol::session::RevokeFamilyRequest;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::sync::Arc;

type SharedState = State<Arc<AppState>>;

pub(crate) fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/capabilities", get(capabilities))
        .route("/v1/login/transactions", post(create_login_transaction))
        .route("/v1/login/bootstrap", post(bootstrap))
        .route("/v1/login/abandon", post(abandon))
        .route("/v1/session", get(session_view))
        .route("/v1/session/refresh", post(refresh))
        .route("/v1/session/refresh-family/revoke", post(revoke_family))
        .route("/v1/session/commands", post(session_command))
        .route("/v1/memberships", get(memberships))
        .route("/v1/workspaces", get(list_workspaces))
        .route("/v1/workspaces/{workspace_id}/roles", get(workspace_roles))
        .route(
            "/v1/workspaces/{workspace_id}/commands",
            post(workspace_command),
        )
        .route(
            "/v1/workspaces/{workspace_id}/access-checks",
            post(access_check),
        )
        .route("/v1/invites/{invite_id}/accept", post(accept_invite))
        .layer(axum::middleware::map_response(no_store))
        .with_state(state)
}

async fn no_store(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

fn parse<T: DeserializeOwned>(body: &Bytes) -> Result<T, ApiError> {
    serde_json::from_slice(body)
        .map_err(|_| ApiError::unsupported_contract("malformed request body"))
}

/// The bearer access credential, if the request carries a well-formed one.
fn bearer(headers: &HeaderMap) -> Result<Option<&str>, ApiError> {
    let Some(value) = headers.get(AUTHORIZATION) else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| ApiError::unauthenticated("malformed authorization header"))?;
    let (scheme, credential) = value
        .split_once(' ')
        .ok_or_else(|| ApiError::unauthenticated("malformed authorization header"))?;
    if !scheme.eq_ignore_ascii_case("bearer") || credential.is_empty() {
        return Err(ApiError::unauthenticated("malformed authorization header"));
    }
    Ok(Some(credential))
}

fn required_bearer(headers: &HeaderMap) -> Result<&str, ApiError> {
    bearer(headers)?.ok_or_else(|| ApiError::unauthenticated("no access credential"))
}

fn respond<T: Serialize>(result: Result<T, ApiError>) -> Response {
    match result {
        Ok(value) => Json(value).into_response(),
        Err(error) => error.into_response(),
    }
}

async fn capabilities(State(state): SharedState) -> Response {
    let result = async {
        let mut conn = state.pool.acquire().await?;
        let command_epoch = commands::current_epoch(&mut conn, false).await?;
        Ok(Capabilities {
            protocol_major: PROTOCOL_MAJOR,
            schema_version: SCHEMA_VERSION,
            command_epoch,
        })
    }
    .await;
    respond(result)
}

async fn create_login_transaction(State(state): SharedState, body: Bytes) -> Response {
    let result = async { login::create_transaction(&state, parse(&body)?).await }.await;
    respond(result)
}

async fn bootstrap(State(state): SharedState, body: Bytes) -> Response {
    let result = async { login::bootstrap(&state, parse(&body)?).await }.await;
    respond(result)
}

async fn abandon(State(state): SharedState, body: Bytes) -> Response {
    let result = async { login::abandon(&state, parse(&body)?).await }.await;
    respond(result)
}

async fn session_view(State(state): SharedState, headers: HeaderMap) -> Response {
    let result = async { sessions::session_view(&state, required_bearer(&headers)?).await }.await;
    respond(result)
}

async fn memberships(State(state): SharedState, headers: HeaderMap) -> Response {
    let result =
        async { sessions::memberships_view(&state, required_bearer(&headers)?).await }.await;
    respond(result)
}

async fn refresh(State(state): SharedState, body: Bytes) -> Response {
    let result = async { sessions::refresh(&state, parse(&body)?).await }.await;
    respond(result)
}

async fn revoke_family(State(state): SharedState, headers: HeaderMap, body: Bytes) -> Response {
    let result = async {
        let request: RevokeFamilyRequest = if body.is_empty() {
            RevokeFamilyRequest::default()
        } else {
            parse(&body)?
        };
        sessions::revoke_family(&state, bearer(&headers)?, request).await
    }
    .await;
    respond(result)
}

async fn session_command(State(state): SharedState, headers: HeaderMap, body: Bytes) -> Response {
    let result = async {
        let access = required_bearer(&headers)?;
        commands::handle_session_command(&state, access, parse(&body)?).await
    }
    .await;
    respond(result)
}

async fn list_workspaces(State(state): SharedState, headers: HeaderMap) -> Response {
    let result = async {
        let access = required_bearer(&headers).map_err(ApiError::on_workspace_route)?;
        workspaces::list_workspaces(&state, access).await
    }
    .await;
    respond(result)
}

async fn workspace_roles(
    State(state): SharedState,
    Path(workspace_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    let result = async {
        let access = required_bearer(&headers).map_err(ApiError::on_workspace_route)?;
        let workspace_id = workspaces::path_id(&workspace_id)?;
        workspaces::roles(&state, access, workspace_id).await
    }
    .await;
    respond(result)
}

async fn workspace_command(
    State(state): SharedState,
    Path(workspace_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result = async {
        let access = required_bearer(&headers).map_err(ApiError::on_workspace_route)?;
        let workspace_id = workspaces::path_id(&workspace_id)?;
        workspace_commands::handle(&state, access, workspace_id, parse(&body)?).await
    }
    .await;
    respond(result)
}

async fn access_check(
    State(state): SharedState,
    Path(workspace_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result = async {
        let access = required_bearer(&headers).map_err(ApiError::on_workspace_route)?;
        let workspace_id = workspaces::path_id(&workspace_id)?;
        workspaces::access_check(&state, access, workspace_id, parse(&body)?).await
    }
    .await;
    respond(result)
}

/// The accept body is empty or `{}`: the invite is named by the path and the
/// principal by the credential.
async fn accept_invite(
    State(state): SharedState,
    Path(invite_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result = async {
        let access = required_bearer(&headers).map_err(ApiError::on_workspace_route)?;
        let invite_id = workspaces::path_id(&invite_id)?;
        if !body.is_empty() {
            let object: serde_json::Map<String, serde_json::Value> = parse(&body)?;
            if !object.is_empty() {
                return Err(ApiError::unsupported_contract("unexpected accept body"));
            }
        }
        workspaces::accept_invite(&state, access, invite_id).await
    }
    .await;
    respond(result)
}
