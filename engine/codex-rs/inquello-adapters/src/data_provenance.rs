//! Quiescent native inspection. Never migrates/restores authority from a backup.
//! Recovery additionally requires a current authenticated-service export digest receipt;
//! this parser alone does not authenticate attacker-supplied SQLite bytes.
#![expect(clippy::disallowed_methods, reason = "read-only native provenance SQLite adapter")]
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row, SqliteConnection};
use sqlx::sqlite::SqliteConnectOptions;
use std::{collections::{BTreeMap, BTreeSet}, fs, io::Read, path::{Path,PathBuf}};
use inquello_domain::routes::RouteConfigurationInput;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InspectRequest {
    pub version:u32, pub store_path:PathBuf, pub principal_id:String,
    pub task_root:Option<PathBuf>, pub runtime_home:Option<PathBuf>,
}
#[derive(Serialize)]
pub struct InspectResponse {pub version:u32,pub available:bool,pub reason:Option<String>,pub files:Vec<ProvenFile>,pub workspaces:Vec<ProvenWorkspace>}
#[derive(Clone,PartialEq,Eq,Serialize)]
pub struct ProvenFile {pub path:PathBuf,pub sha256:String,pub size:u64,pub category:String}
#[derive(Serialize)]
pub struct ProvenWorkspace {pub workspace_id:String,pub tasks:Vec<ProvenTask>}
#[derive(Serialize)]
pub struct ProvenTask {pub task_id:String,pub provenance_kind:String,pub data_tier:String,pub route_configuration:Option<RouteConfigurationInput>,
 pub route_identity:Option<inquello_domain::routes::RouteEvidenceIdentity>,pub report_digest:Option<String>,pub processing_scope:Option<String>,pub data_policy_digest:Option<String>}

const MIGRATIONS:&[&str]=&[
 include_str!("../migrations/0001_store_info_and_receipts.sql"),include_str!("../migrations/0002_engagements_folders_tasks.sql"),
 include_str!("../migrations/0003_task_states.sql"),include_str!("../migrations/0004_task_broad_modes.sql"),
 include_str!("../migrations/0005_command_rules_and_permissions.sql"),include_str!("../migrations/0006_processing_routes.sql"),
 include_str!("../migrations/0007_automated_permission_review.sql"),include_str!("../migrations/0008_task_usage.sql"),
 include_str!("../migrations/0009_task_runs.sql"),include_str!("../migrations/0010_task_data_provenance.sql"),
 include_str!("../migrations/0011_task_metadata_provenance.sql"),
];
fn failure()->String {"Native ownership/category provenance unavailable, mixed, changed or incomplete; data remains quarantined".into()}
fn uuid(value:&str)->Result<(),String>{if uuid::Uuid::parse_str(value).is_ok(){Ok(())}else{Err(failure())}}
fn digest(path:&Path,category:&str)->Result<ProvenFile,String>{
    let metadata=fs::symlink_metadata(path).map_err(|_|failure())?;
    if !metadata.is_file()||metadata.file_type().is_symlink()||metadata.len()>512*1024*1024{return Err(failure());}
    // Refuse symlinks in every ancestor; paths are host-owned, not manifest grants.
    for parent in path.ancestors().skip(1) {if fs::symlink_metadata(parent).map_err(|_|failure())?.file_type().is_symlink(){return Err(failure());}}
    let mut file=fs::File::open(path).map_err(|_|failure())?;let mut hash=Sha256::new();let mut buffer=[0u8;65536];let mut size=0;
    loop {let n=file.read(&mut buffer).map_err(|_|failure())?;if n==0{break;}size+=n as u64;if size>512*1024*1024{return Err(failure());}hash.update(&buffer[..n]);}
    Ok(ProvenFile{path:path.to_owned(),sha256:format!("{:x}",hash.finalize()),size,category:category.into()})
}
fn family(path:&Path)->Result<Vec<ProvenFile>,String>{
    let mut files=vec![digest(path,"working-store")?];
    for suffix in ["-wal","-shm"] {let path=PathBuf::from(format!("{}{suffix}",path.display()));if path.exists(){files.push(digest(&path,"working-store")?);}}
    Ok(files)
}
async fn schema(connection:&mut SqliteConnection)->Result<Vec<(String,String)>,String>{
    sqlx::query_as("SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name != '_sqlx_migrations' ORDER BY name")
        .fetch_all(connection).await.map_err(|_|failure())
}
pub async fn inspect(request:InspectRequest)->InspectResponse {
    match inspect_inner(request).await {Ok((files,workspaces))=>InspectResponse{version:1,available:true,reason:None,files,workspaces},Err(reason)=>InspectResponse{version:1,available:false,reason:Some(reason),files:vec![],workspaces:vec![]}}
}
async fn inspect_inner(request:InspectRequest)->Result<(Vec<ProvenFile>,Vec<ProvenWorkspace>),String>{
    if request.version!=1||!request.store_path.is_absolute(){return Err(failure());}uuid(&request.principal_id)?;
    let before=family(&request.store_path)?;
    let options=SqliteConnectOptions::new().filename(&request.store_path).read_only(true).create_if_missing(false).pragma("query_only","ON");
    let mut db=SqliteConnection::connect_with(&options).await.map_err(|_|failure())?;
    let mut expected=SqliteConnection::connect_with(&SqliteConnectOptions::new().in_memory(true)).await.map_err(|_|failure())?;
    for migration in MIGRATIONS {sqlx::raw_sql(*migration).execute(&mut expected).await.map_err(|_|failure())?;}
    if schema(&mut db).await?!=schema(&mut expected).await?{return Err(failure());}
    expected.close().await.map_err(|_|failure())?;
    let integrity:String=sqlx::query_scalar("PRAGMA quick_check").fetch_one(&mut db).await.map_err(|_|failure())?;
    if integrity!="ok"||!sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut db).await.map_err(|_|failure())?.is_empty(){return Err(failure());}
    let tables:Vec<String>=sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_sqlx_migrations'").fetch_all(&mut db).await.map_err(|_|failure())?;
    let mut workspaces:BTreeMap<String,Vec<ProvenTask>>=BTreeMap::new();
    for table in tables {
        // Names have already matched the compiled schema; no arbitrary SQL identifier.
        let columns=sqlx::query(sqlx::AssertSqlSafe(format!("PRAGMA table_info(\"{table}\")"))).fetch_all(&mut db).await.map_err(|_|failure())?;
        let columns: BTreeSet<String>=columns.into_iter().map(|row|row.try_get("name").map_err(|_|failure())).collect::<Result<_,_>>()?;
        let count:i64=sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT count(*) FROM \"{table}\""))).fetch_one(&mut db).await.map_err(|_|failure())?;
        if count>100000{return Err(failure());}
        for owner in ["principal_id","creator_principal_id"] {if columns.contains(owner){
            let count:i64=sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT count(*) FROM \"{table}\" WHERE \"{owner}\" IS NULL OR \"{owner}\" != ?"))).bind(&request.principal_id).fetch_one(&mut db).await.map_err(|_|failure())?;
            if count!=0{return Err(failure());}
        }}
        if columns.contains("workspace_id") {
            let ids:Vec<String>=sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT DISTINCT workspace_id FROM \"{table}\""))).fetch_all(&mut db).await.map_err(|_|failure())?;
            for id in ids {uuid(&id)?;workspaces.entry(id).or_default();}
        }
    }
    let rows=sqlx::query("SELECT t.task_id,t.workspace_id,t.runtime_thread_id,t.source_refs,t.artifact_refs,p.data_tier FROM tasks t LEFT JOIN task_data_provenance p ON p.task_id=t.task_id AND p.principal_id=t.creator_principal_id AND p.workspace_id=t.workspace_id ORDER BY t.task_id").fetch_all(&mut db).await.map_err(|_|failure())?;
    let mut threads=BTreeSet::new();let mut tasks=BTreeSet::new();
    for row in rows {
        let id:String=row.try_get("task_id").map_err(|_|failure())?;uuid(&id)?;
        let workspace:String=row.try_get("workspace_id").map_err(|_|failure())?;uuid(&workspace)?;
        let tier:Option<String>=row.try_get("data_tier").map_err(|_|failure())?;
        let (tier,provenance_kind)=if let Some(tier)=tier {
            if !matches!(tier.as_str(),"synthetic"|"real") {return Err(failure());}
            (tier,"task_content".to_string())
        } else {
            let draft:Option<i64>=sqlx::query_scalar("SELECT 1 FROM task_metadata_provenance p JOIN tasks t ON t.task_id=p.task_id AND t.creator_principal_id=p.principal_id AND t.workspace_id=p.workspace_id WHERE p.task_id=? AND p.principal_id=? AND p.provenance_kind='draft_metadata' AND t.runtime_thread_id IS NULL AND NOT EXISTS(SELECT 1 FROM task_runs r WHERE r.task_id=t.task_id) AND NOT EXISTS(SELECT 1 FROM task_start_history h WHERE h.task_id=t.task_id) AND NOT EXISTS(SELECT 1 FROM task_usage_attempts u WHERE u.task_id=t.task_id)")
                .bind(&id).bind(&request.principal_id).fetch_optional(&mut db).await.map_err(|_|failure())?;
            if draft.is_none(){return Err(failure());}
            ("not-applicable".into(),"draft_metadata".into())
        };
        for column in ["source_refs","artifact_refs"] {let refs:String=row.try_get(column).map_err(|_|failure())?;if serde_json::from_str::<serde_json::Value>(&refs).map_err(|_|failure())?!=serde_json::json!([]){return Err(failure());}}
        let thread:Option<String>=row.try_get("runtime_thread_id").map_err(|_|failure())?;
        if let Some(thread)=thread {
            let record:Option<String>=sqlx::query_scalar("SELECT record FROM task_runs WHERE task_id=? AND principal_id=? AND thread_id=? AND json_extract(record,'$.workspace_id')=? AND json_extract(record,'$.task_id')=task_id AND json_extract(record,'$.principal_id')=principal_id AND json_extract(record,'$.thread_id')=thread_id")
                .bind(&id).bind(&request.principal_id).bind(&thread).bind(&workspace).fetch_optional(&mut db).await.map_err(|_|failure())?;
            if record.is_none(){return Err(failure());}uuid(&thread)?;threads.insert(thread);
        }
        let configuration:Option<String>=sqlx::query_scalar("SELECT c.configuration FROM task_processing_routes t JOIN processing_route_candidates c ON c.principal_id=t.principal_id AND c.route_id=t.route_id AND c.revision=t.configuration_revision WHERE t.task_id=? ORDER BY t.revision DESC LIMIT 1")
            .bind(&id).fetch_optional(&mut db).await.map_err(|_|failure())?;
        let configuration=configuration.map(|s|serde_json::from_str::<RouteConfigurationInput>(&s).map_err(|_|failure())).transpose()?;
        if let Some(input)=&configuration {inquello_domain::routes::RouteConfiguration::parse(input.clone()).map_err(|_|failure())?;}
        let configuration=if provenance_kind=="draft_metadata" {None}else{configuration};
        if provenance_kind=="task_content" {tasks.insert(id.clone());}
        workspaces.entry(workspace).or_default().push(ProvenTask{task_id:id,provenance_kind,data_tier:tier,route_configuration:configuration,route_identity:None,report_digest:None,processing_scope:None,data_policy_digest:None});
    }
    db.close().await.map_err(|_|failure())?;
    if before!=family(&request.store_path)?{return Err(failure());}
    let mut files=before;
    if let Some(root)=request.task_root {for task in tasks {let dir=root.join(task);if dir.exists(){collect_files(&dir,"task-folders",&mut files)?;}}}
    if let Some(root)=request.runtime_home {
        let mut candidates=Vec::new();for name in ["sessions","archived_sessions"] {let dir=root.join(name);if dir.exists(){collect_files(&dir,"task-history",&mut candidates)?;}}
        for file in candidates {
            if file.size>64*1024*1024{return Err(failure());}
            let bytes=fs::read(&file.path).map_err(|_|failure())?;
            let first=bytes.split(|b|*b==b'\n').next().ok_or_else(failure)?;
            let header:serde_json::Value=serde_json::from_slice(first).map_err(|_|failure())?;
            if header["type"]!="session_meta"||header["payload"]["id"].as_str().is_none_or(|id|!threads.contains(id)){return Err(failure());}
            if digest(&file.path,"task-history")?!=file{return Err(failure());}files.push(file);
        }
    }
    if files.len()>10000{return Err(failure());}
    Ok((files,workspaces.into_iter().map(|(workspace_id,tasks)|ProvenWorkspace{workspace_id,tasks}).collect()))
}
fn collect_files(root:&Path,category:&str,files:&mut Vec<ProvenFile>)->Result<(),String>{
    if fs::symlink_metadata(root).map_err(|_|failure())?.file_type().is_symlink(){return Err(failure());}
    for entry in fs::read_dir(root).map_err(|_|failure())? {let entry=entry.map_err(|_|failure())?;let path=entry.path();
        if entry.file_type().map_err(|_|failure())?.is_dir(){collect_files(&path,category,files)?;}else{files.push(digest(&path,category)?);}
        if files.len()>10000{return Err(failure());}
    }Ok(())
}
