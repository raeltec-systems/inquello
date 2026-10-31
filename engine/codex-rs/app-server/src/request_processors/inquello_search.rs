//! Private saved-work search. Every candidate is authorized before history reads;
//! results are not grants and activation repeats the exact Task/turn/item checks.
use super::*;
use codex_app_server_protocol::*;
use inquello_domain::organise::{OrganiseStore,EngagementId};
use inquello_domain::tasks::TaskRunBinding;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

const MAX_CANDIDATES:usize=2000;
const MAX_HITS:usize=10_000;
const PAGE_SIZE:usize=50;
#[derive(Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
struct SearchCursor { workspace:String, query:String, archived:bool, digest:String, offset:usize }

#[derive(Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
struct SavedTaskFence {id:String,revision:u64,thread:Option<String>,lineage:Option<String>,history:Option<String>}
#[derive(Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct SavedDisclosureFence {pub(super) inventory:SavedInventory,principal:String,workspace:String,tasks:Vec<SavedTaskFence>,engagements:Vec<(String,u64)>}
fn lineage_digest(lineage:&[TaskRunBinding])->Result<String,JSONRPCErrorError>{Ok(format!("{:x}",Sha256::digest(serde_json::to_vec(lineage).map_err(|_|unavailable())?)))}
fn saved_history_matches(expected_lineage:&str,expected_history:&str,current:&[TaskRunBinding],current_history:&str)->Result<bool,JSONRPCErrorError>{
    Ok(lineage_digest(current)?==expected_lineage&&current_history==expected_history)
}
fn task_fence(task:&organise::Task,lineage:Option<&[TaskRunBinding]>,history:Option<&str>)->Result<SavedTaskFence,JSONRPCErrorError>{
    Ok(SavedTaskFence{id:task.task_id.to_string(),revision:task.revision.get(),thread:task.runtime_thread_id.clone(),lineage:lineage.map(lineage_digest).transpose()?,history:history.map(str::to_owned)})
}
fn query_valid(query:&str)->bool { !query.trim().is_empty() && query.len()<=256 && !query.chars().any(char::is_control) }
fn snippet(text:&str,query:&str)->Option<String> {codex_rollout::retained_conversation_snippet(text,query).ok().flatten()}
fn conversation_text(item:&ThreadItem)->Option<String> {
    codex_thread_store::searchable_conversation_text(item).map(|text|text.into_owned())
}
/// Matching may normalize Markdown; inspection preserves the retained message.
fn retained_message_text(item:&ThreadItem)->Option<String> {
    match item {
        ThreadItem::UserMessage{content,..} => Some(content.iter().filter_map(|input|match input {
            UserInput::Text{text,..}=>Some(text.as_str()),_=>None,
        }).collect::<Vec<_>>().join("\n")),
        ThreadItem::AgentMessage{text,..} => Some(text.clone()),
        _=>None,
    }
}
#[derive(Clone,Serialize,Deserialize)]
pub(super) struct SavedInventory {workspace:String,snapshot:String,engagements:HashSet<String>}
struct InventoryRequestCleanup {outgoing:std::sync::Arc<crate::outgoing_message::OutgoingMessageSender>,id:Option<codex_app_server_protocol::RequestId>}
impl Drop for InventoryRequestCleanup {fn drop(&mut self){if let Some(id)=self.id.take(){let outgoing=self.outgoing.clone();tokio::spawn(async move{outgoing.cancel_request(&id).await;});}}}
pub(crate) struct SavedQueueLease {
    _history:Option<codex_thread_store::SavedHistoryLease>,
    _working:inquello_adapters::SavedQueueGuard,
}
fn unavailable()->JSONRPCErrorError {refusal("not_found","Saved work is unavailable in the current context")}

impl InquelloRequestProcessor {
    pub(super) fn saved_tree_fence(&self,actor:Actor,inventory:SavedInventory,tasks:&[organise::Task],engagements:&[organise::Engagement])->Result<String,JSONRPCErrorError>{
        let fence=SavedDisclosureFence{principal:actor.principal_id.to_string(),workspace:inventory.workspace.clone(),inventory,
            tasks:tasks.iter().map(|task|task_fence(task,None,None)).collect::<Result<Vec<_>,_>>()?,
            engagements:engagements.iter().map(|e|(e.engagement_id.to_string(),e.revision.get())).collect()};
        serde_json::to_string(&fence).map_err(|_|unavailable())
    }

    pub(super) async fn saved_inventory(&self,connection:ConnectionId,actor:Actor,workspace:&str,expected:Option<&str>)->Result<SavedInventory,JSONRPCErrorError> {
        let outgoing=self.task_outgoing.as_ref().ok_or_else(unavailable)?;
        let (id,response)=outgoing.send_request_to_connections(Some(&[connection]),ServerRequestPayload::InquelloContextAuthorize(InquelloContextAuthorizeParams {
            workspace_id:workspace.into(),expected_snapshot:expected.map(str::to_owned),
        }),None).await;
        let mut cleanup=InventoryRequestCleanup{outgoing:outgoing.clone(),id:Some(id.clone())};
        let reply=tokio::time::timeout(std::time::Duration::from_secs(10),response).await;
        outgoing.cancel_request(&id).await;cleanup.id=None;
        let view=reply.ok().and_then(|v|v.ok()).and_then(|v|v.ok())
            .and_then(|v|serde_json::from_value::<InquelloContextAuthorizeResponse>(v).ok()).ok_or_else(unavailable)?;
        let snapshot=view.snapshot.filter(|s|!s.is_empty()&&s.len()<=256).ok_or_else(unavailable)?;
        if !view.available || view.service_engagement_ids.len()>MAX_CANDIDATES || view.service_engagement_ids.iter().any(|id|id.len()>256)
            || expected.is_some_and(|expected|expected!=snapshot) || self.actor(connection)?!=actor {return Err(unavailable());}
        Ok(SavedInventory{workspace:workspace.into(),snapshot,engagements:view.service_engagement_ids.into_iter().collect()})
    }
    pub(super) fn authorize_saved_context(&self,inventory:&SavedInventory,workspace:&str,engagement:Option<&str>)->Result<(),JSONRPCErrorError> {
        if inventory.workspace!=workspace || engagement.is_some_and(|id|!inventory.engagements.contains(id)){return Err(unavailable());}Ok(())
    }
    pub(super) async fn authorize_saved_task(&self,connection:ConnectionId,actor:Actor,task:&organise::Task,inventory:&SavedInventory)->Result<(),JSONRPCErrorError> {
        if task.creator_principal_id!=actor.principal_id {return Err(unavailable());}
        let store=self.store().await?;
        let engagement=if let Some(id)=task.engagement_id {
            let engagement=store.load_engagement(id).await.map_err(|_|unavailable())?.filter(|e|e.workspace_id==task.workspace_id).ok_or_else(unavailable)?;
            Some(engagement.service_engagement_id.to_string())
        }else{None};
        self.authorize_saved_context(inventory,&task.workspace_id.to_string(),engagement.as_deref())?;
        self.authorize_task_metadata(connection,actor,&task.task_id.to_string()).await?;
        let current=store.load_task(task.task_id).await.map_err(|_|unavailable())?.ok_or_else(unavailable)?;
        if current!=*task || self.actor(connection)?!=actor {return Err(refusal("stale","Saved Task changed; refresh navigation"));}
        Ok(())
    }
    async fn saved_lineage(&self,connection:ConnectionId,actor:Actor,task:&organise::Task,inventory:&SavedInventory)->Result<Vec<TaskRunBinding>,JSONRPCErrorError> {
        self.authorize_saved_task(connection,actor,task,inventory).await?;
        let store=self.store().await?;
        let mut lineage=store.prior_task_runs(actor.principal_id,&task.task_id.to_string()).await.map_err(domain_error)?;
        let current=store.find_task_current_run(actor.principal_id,&task.task_id.to_string()).await.map_err(domain_error)?.ok_or_else(unavailable)?;
        lineage.push(current);
        for run in &lineage {
            if run.task_id!=task.task_id.to_string() || run.principal_id!=actor.principal_id.to_string() || run.workspace_id!=task.workspace_id.to_string() || run.thread_id!=task.runtime_thread_id {return Err(unavailable());}
            self.authorize_run_route_disclosure(connection,actor,run).await?;
        }
        Ok(lineage)
    }
    /// Run after the generic post-request Workspace fence, immediately before queuing disclosure.
    /// Search has multiple contributing Tasks; a Workspace-only final check is insufficient.
    pub(crate) async fn saved_read_fence(&self,connection:ConnectionId)->Result<inquello_adapters::SavedReadFence,JSONRPCErrorError>{
        self.actor(connection)?;
        self.store().await?.saved_read_fence().await.map_err(|_|unavailable())
    }
    pub(crate) async fn guard_saved_disclosure(&self,connection:ConnectionId,response:&ClientResponsePayload,threads:&super::super::ThreadRequestProcessor,read_fence:&mut inquello_adapters::SavedReadFence)->Result<SavedQueueLease,JSONRPCErrorError> {
        let serialized=match response {
            ClientResponsePayload::InquelloWorkspaceSearch(view)=>&view.internal_disclosure_fence,
            ClientResponsePayload::InquelloTaskReopen(view)=>&view.internal_disclosure_fence,
            ClientResponsePayload::InquelloWorkspaceTree(view)=>&view.internal_disclosure_fence,
            _=>return Err(unavailable()),
        };
        let fence:SavedDisclosureFence=serde_json::from_str(serialized).map_err(|_|unavailable())?;
        let (store,actor)=self.context(connection).await?;
        if fence.principal!=actor.principal_id.to_string(){return Err(unavailable());}
        // Finish ALL network authority checks before taking local writer leases.
        self.current_workspace_metadata(connection,actor,&fence.workspace).await?;
        for original in &fence.tasks {
            let task=store.load_task(TaskId::parse(&original.id).map_err(domain_error)?).await.map_err(|_|unavailable())?.ok_or_else(unavailable)?;
            self.authorize_saved_task(connection,actor,&task,&fence.inventory).await?;
            if original.lineage.is_some(){self.saved_lineage(connection,actor,&task,&fence.inventory).await?;}
        }
        self.saved_inventory(connection,actor,&fence.workspace,Some(&fence.inventory.snapshot)).await?;
        let ids=fence.tasks.iter().filter(|task|task.history.is_some()).filter_map(|task|task.thread.as_ref())
            .map(|id|codex_protocol::ThreadId::from_string(id).map_err(|_|unavailable())).collect::<Result<Vec<_>,_>>()?;
        let history=if ids.is_empty(){None}else{
            let local=threads.thread_store.as_any().downcast_ref::<codex_thread_store::LocalThreadStore>().ok_or_else(unavailable)?;
            Some(local.saved_history_lease(ids).await.map_err(|_|unavailable())?)
        };
        // The entire contributor set (not just this page) is now revalidated.
        // Working-store data_version spans initial reads and every await above;
        // normal retained writers/deletion are coordinated by the history lease.
        for (id,revision) in &fence.engagements {
            let engagement=store.load_engagement(EngagementId::parse(id).map_err(domain_error)?).await.map_err(|_|unavailable())?.ok_or_else(unavailable)?;
            if engagement.workspace_id.to_string()!=fence.workspace||engagement.revision.get()!=*revision{return Err(unavailable());}
            self.authorize_saved_context(&fence.inventory,&fence.workspace,Some(&engagement.service_engagement_id.to_string()))?;
        }
        for original in &fence.tasks {
            let task=store.load_task(TaskId::parse(&original.id).map_err(domain_error)?).await.map_err(|_|unavailable())?.ok_or_else(unavailable)?;
            if task.creator_principal_id!=actor.principal_id||task.workspace_id.to_string()!=fence.workspace||task.revision.get()!=original.revision||task.runtime_thread_id!=original.thread{return Err(unavailable());}
            if let (Some(lineage),Some(revision))=(&original.lineage,&original.history) {
                let mut current=store.prior_task_runs(actor.principal_id,&original.id).await.map_err(domain_error)?;
                current.push(store.find_task_current_run(actor.principal_id,&original.id).await.map_err(domain_error)?.ok_or_else(unavailable)?);
                let current_history=threads.inquello_saved_revision(original.thread.as_ref().ok_or_else(unavailable)?).await?;
                if !saved_history_matches(lineage,revision,&current,&current_history)?{return Err(refusal("stale_snapshot","Saved context changed before disclosure"));}
            }else if original.lineage.is_some()||original.history.is_some(){return Err(unavailable());}
        }
        let working=store.seal_saved_read(read_fence).await.map_err(|_|refusal("stale_snapshot","Saved inventory changed during inspection; refresh"))?;
        if self.actor(connection)?!=actor{return Err(unavailable());}
        Ok(SavedQueueLease{_history:history,_working:working})
    }
    pub(crate) async fn task_set_navigation(&self,connection:ConnectionId,params:InquelloTaskSetNavigationParams)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        let inventory=self.saved_inventory(connection,actor,&params.workspace_id,None).await?;
        let task=store.load_task(TaskId::parse(&params.task_id).map_err(domain_error)?).await.map_err(|_|unavailable())?.filter(|t|t.workspace_id.to_string()==params.workspace_id).ok_or_else(unavailable)?;
        self.authorize_saved_task(connection,actor,&task,&inventory).await?;
        let outcome=organise::set_task_navigation(&store,&SystemClock,actor,organise::SetTaskNavigation {
            operation_id:params.operation_id,expected_revision:Revision::new(params.expected_revision),workspace_id:params.workspace_id,task_id:params.task_id,pinned:params.pinned,archived:params.archived,
        }).await.map_err(domain_error)?;
        if let OrganiseRecord::Task(task)=&outcome.record {self.authorize_saved_task(connection,actor,task,&inventory).await?;}
        self.saved_inventory(connection,actor,&inventory.workspace,Some(&inventory.snapshot)).await?;
        let response=task_response(&outcome)?;
        Ok(Some(ClientResponsePayload::InquelloTaskSetNavigation(response)))
    }
    pub(crate) async fn workspace_search(&self,connection:ConnectionId,params:InquelloWorkspaceSearchParams,threads:&super::super::ThreadRequestProcessor)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        if !query_valid(&params.query) || params.cursor.as_ref().is_some_and(|c|c.len()>4096) {return Err(refusal("invalid","Enter nonempty text of at most 256 UTF-8 bytes, without control characters"));}
        let (store,actor)=self.context(connection).await?;
        self.current_workspace_metadata(connection,actor,&params.workspace_id).await?;
        let inventory=self.saved_inventory(connection,actor,&params.workspace_id,None).await?;
        let tree=organise::workspace_tree(&store,actor,&params.workspace_id).await.map_err(domain_error)?;
        if tree.tasks.len()+tree.engagements.len()>MAX_CANDIDATES {return Err(refusal("search_unavailable","Workspace inventory exceeds the bounded search scope"));}
        let deadline=std::time::Instant::now()+std::time::Duration::from_secs(20);
        let mut conversation_fences=Vec::new();
        let mut items=Vec::new();let mut unavailable_scope=false;let mut disclosed_tasks=Vec::new();let mut disclosed_engagements=Vec::new();
        for engagement in &tree.engagements {
            if std::time::Instant::now()>=deadline{return Err(refusal("search_unavailable","Search exceeded its time bound; narrow the query or try again"));}
            let id=engagement.service_engagement_id.to_string();
            if self.authorize_saved_context(&inventory,&params.workspace_id,Some(&id)).is_err(){unavailable_scope=true;continue;}
            let view=engagement_view(engagement);
            let text=[Some(view.name.clone()),Some(view.objectives),Some(view.scope),view.client_entity,view.period_start,view.period_end].into_iter().flatten().collect::<Vec<_>>().join("\n");
            if let Some(matched)=snippet(&text,&params.query) {
                items.push(InquelloSearchItem{kind:"engagement".into(),task_id:None,engagement_id:Some(view.engagement_id),title:view.name,snippet:Some(matched),turn_id:None,item_id:None,archived:false});
                disclosed_engagements.push(id);
            }
        }
        let mut tasks=tree.tasks;tasks.sort_by_key(|t|t.task_id.to_string());
        for task in tasks {
            if std::time::Instant::now()>=deadline{return Err(refusal("search_unavailable","Search exceeded its time bound; try again"));}
            if task.archived && !params.include_archived {continue;}
            if self.authorize_saved_task(connection,actor,&task,&inventory).await.is_err(){unavailable_scope=true;continue;}
            let start=items.len();let mut searched_history=false;
            let base=InquelloSearchItem{kind:"task".into(),task_id:Some(task.task_id.to_string()),engagement_id:task.engagement_id.map(|v|v.to_string()),title:task.title.clone(),snippet:None,turn_id:None,item_id:None,archived:task.archived};
            if let Some(matched)=snippet(&task.title,&params.query){let mut hit=base.clone();hit.snippet=Some(matched);items.push(hit);}
            if let Some(thread)=&task.runtime_thread_id {
                let result:Result<Vec<InquelloSearchItem>,JSONRPCErrorError>=async {
                    let lineage=self.saved_lineage(connection,actor,&task,&inventory).await?;
                    let turns:HashSet<_>=lineage.iter().filter_map(|r|r.turn_id.clone()).collect();
                    let local=threads.thread_store.as_any().downcast_ref::<codex_thread_store::LocalThreadStore>().ok_or_else(unavailable)?;
                    let read_lease=local.saved_history_lease(vec![codex_protocol::ThreadId::from_string(thread).map_err(|_|unavailable())?]).await.map_err(|_|unavailable())?;
                    let revision=threads.inquello_saved_revision(thread).await?;
                    let mut matches=Vec::new();
                    if let Some(legacy)=threads.inquello_legacy_conversation(thread).await? {
                        for (turn,item) in legacy {
                            if !turns.contains(&turn){return Err(unavailable());}
                            if conversation_text(&item).is_some() {if let Some(matched)=codex_thread_store::conversation_match_snippet(&item,&params.query){let mut hit=base.clone();hit.kind="conversation".into();hit.turn_id=Some(turn);hit.item_id=Some(item.id().into());hit.snippet=Some(matched);matches.push(hit);}}
                        }
                    } else {
                        let mut cursor=None;let mut seen=HashSet::new();let mut matched_items=HashSet::new();
                        loop {
                            if std::time::Instant::now()>=deadline{return Err(refusal("search_unavailable","Conversation search exceeded its time bound"));}
                            let page=threads.thread_search_occurrences_response_inner(ThreadSearchOccurrencesParams{thread_id:thread.clone(),search_term:params.query.clone(),cursor,limit:Some(100)}).await?;
                            for entry in page.data {
                                if !turns.contains(&entry.turn_id){return Err(unavailable());}
                                // One first native occurrence per exact item: activation
                                // uses that same matcher, including for long messages.
                                if !matched_items.insert((entry.turn_id.clone(),entry.item_id.clone())){continue;}
                                let mut hit=base.clone();hit.kind="conversation".into();hit.turn_id=Some(entry.turn_id);hit.item_id=Some(entry.item_id);hit.snippet=Some(entry.snippet);matches.push(hit);
                            }
                            if matches.len()>MAX_HITS {return Err(refusal("search_unavailable","Conversation match bound reached"));}
                            cursor=page.next_cursor;
                            match &cursor {None=>break,Some(c) if !seen.insert(c.clone()) || seen.len()>100=>return Err(unavailable()),_=>{}}
                        }
                    }
                    if matches.len()>MAX_HITS || threads.inquello_saved_revision(thread).await?!=revision {return Err(refusal("stale","Saved conversation changed during search"));}
                    drop(read_lease);
                    if self.saved_lineage(connection,actor,&task,&inventory).await?!=lineage {return Err(unavailable());}
                    // A successful zero-match observation contributes to counts,
                    // completeness and the cursor just as a positive hit does.
                    conversation_fences.push((task.clone(),lineage,revision));
                    Ok(matches)
                }.await;
                match result {Ok(matches)=>{searched_history=true;items.extend(matches);},Err(_)=>unavailable_scope=true}
            }
            if items.len()>MAX_HITS {return Err(refusal("search_unavailable","Workspace match bound reached; narrow your query"));}
            if items.len()>start || searched_history {disclosed_tasks.push(task);}
        }
        items.sort_by(|a,b|(&a.kind,&a.task_id,&a.engagement_id,&a.turn_id,&a.item_id,&a.snippet).cmp(&(&b.kind,&b.task_id,&b.engagement_id,&b.turn_id,&b.item_id,&b.snippet)));
        let cursor_tasks=disclosed_tasks.iter().map(|task|{
            let retained=conversation_fences.iter().find(|(row,_,_)|row.task_id==task.task_id);
            task_fence(task,retained.map(|(_,lineage,_)|lineage.as_slice()),retained.map(|(_,_,revision)|revision.as_str()))
        }).collect::<Result<Vec<_>,_>>()?;
        let cursor_engagements=tree.engagements.iter().map(|e|(e.engagement_id.to_string(),e.revision.get())).collect::<Vec<_>>();
        let digest=format!("{:x}",Sha256::digest(serde_json::to_vec(&(&items,&inventory.snapshot,&cursor_tasks,&cursor_engagements)).map_err(|_|unavailable())?));
        let offset=if let Some(cursor)=params.cursor {let cursor:SearchCursor=serde_json::from_str(&cursor).map_err(|_|refusal("invalid","Invalid search page"))?;
            if cursor.workspace!=params.workspace_id || cursor.query!=params.query || cursor.archived!=params.include_archived || cursor.digest!=digest || cursor.offset>items.len(){return Err(refusal("stale_snapshot","Search changed; refresh the first page"));}cursor.offset
        }else{0};
        let end=(offset+PAGE_SIZE).min(items.len());
        let next_cursor=if end<items.len(){Some(serde_json::to_string(&SearchCursor{workspace:params.workspace_id.clone(),query:params.query.clone(),archived:params.include_archived,digest,offset:end}).map_err(|_|unavailable())?)}else{None};
        let disclosure=SavedDisclosureFence{
            inventory,principal:actor.principal_id.to_string(),workspace:params.workspace_id.clone(),
            tasks:disclosed_tasks.iter().map(|task|{
                let retained=conversation_fences.iter().find(|(row,_,_)|row.task_id==task.task_id);
                task_fence(task,retained.map(|(_,lineage,_)|lineage.as_slice()),retained.map(|(_,_,revision)|revision.as_str()))
            }).collect::<Result<Vec<_>,_>>()?,
            engagements:tree.engagements.iter().filter(|e|disclosed_engagements.contains(&e.service_engagement_id.to_string())).map(|e|(e.engagement_id.to_string(),e.revision.get())).collect(),
        };
        let internal_disclosure_fence=serde_json::to_string(&disclosure).map_err(|_|unavailable())?;
        let items=items.drain(offset..end).collect();
        Ok(Some(InquelloWorkspaceSearchResponse{internal_disclosure_fence,workspace_id:params.workspace_id,query:params.query,items,next_cursor,unavailable:unavailable_scope,coverage:vec!["Accessible Engagement name, objectives, scope, entity and period; your Task titles and retained user/assistant conversations".into(),"Files, artifacts, hidden reasoning, tools, plans and system/developer instructions are not searched".into()]}.into()))
    }
    pub(crate) async fn task_reopen(&self,connection:ConnectionId,params:InquelloTaskReopenParams,threads:&super::super::ThreadRequestProcessor)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        let inventory=self.saved_inventory(connection,actor,&params.workspace_id,None).await?;
        let task=store.load_task(TaskId::parse(&params.task_id).map_err(domain_error)?).await.map_err(|_|unavailable())?.filter(|t|t.workspace_id.to_string()==params.workspace_id).ok_or_else(unavailable)?;
        self.authorize_saved_task(connection,actor,&task,&inventory).await?;
        let mut hit_fence=None;
        let hit=match (&params.turn_id,&params.item_id,&params.query) {
            (None,None,None)=>None,
            (Some(turn),Some(item),Some(query)) if query_valid(query) && turn.len()<=256 && item.len()<=256=>{
                let lineage=self.saved_lineage(connection,actor,&task,&inventory).await?;
                if !lineage.iter().any(|r|r.turn_id.as_ref()==Some(turn)){return Err(unavailable());}
                let thread=task.runtime_thread_id.as_ref().ok_or_else(unavailable)?;
                let local=threads.thread_store.as_any().downcast_ref::<codex_thread_store::LocalThreadStore>().ok_or_else(unavailable)?;
                let read_lease=local.saved_history_lease(vec![codex_protocol::ThreadId::from_string(thread).map_err(|_|unavailable())?]).await.map_err(|_|unavailable())?;
                let revision=threads.inquello_saved_revision(thread).await?;
                let (selected,matched)=if let Some(legacy)=threads.inquello_legacy_conversation(thread).await? {
                    let selected=legacy.into_iter().find(|(t,i)|t==turn && i.id()==item).map(|(_,i)|i).ok_or_else(unavailable)?;
                    let matched=codex_thread_store::conversation_match_snippet(&selected,query).ok_or_else(||refusal("stale_hit","The selected text no longer matches; search again"))?;
                    (selected,matched)
                }else{
                    let selected=threads.thread_items_read_response_inner(ThreadItemsReadParams{thread_id:thread.clone(),turn_id:turn.clone(),item_ids:vec![item.clone()]}).await?.data.into_iter().find(|e|e.turn_id==*turn && e.item.id()==item).map(|e|e.item).ok_or_else(unavailable)?;
                    let matched=codex_thread_store::conversation_match_snippet(&selected,query)
                        .ok_or_else(||refusal("stale_hit","The selected text no longer matches; search again"))?;
                    (selected,matched)
                };
                let text=retained_message_text(&selected).ok_or_else(unavailable)?;
                // Match-centered bounded context reaches old messages without truncating to the recent tail.
                let truncated=text.chars().count()>4096;
                let text=if truncated {matched}else{text};
                if threads.inquello_saved_revision(thread).await?!=revision {return Err(refusal("stale_hit","Saved message changed while reopening"));}
                drop(read_lease);
                if self.saved_lineage(connection,actor,&task,&inventory).await?!=lineage {return Err(unavailable());}
                hit_fence=Some((lineage,revision));
                Some(InquelloSavedHit{turn_id:turn.clone(),item_id:item.clone(),text,truncated})
            },
            _=>return Err(refusal("invalid","Exact saved hits require their query, turn and item")),
        };
        self.authorize_saved_task(connection,actor,&task,&inventory).await?;
        let disclosure=SavedDisclosureFence{inventory,principal:actor.principal_id.to_string(),workspace:params.workspace_id,
            tasks:vec![task_fence(&task,hit_fence.as_ref().map(|(lineage,_)|lineage.as_slice()),hit_fence.as_ref().map(|(_,revision)|revision.as_str()))?],engagements:Vec::new()};
        let internal_disclosure_fence=serde_json::to_string(&disclosure).map_err(|_|unavailable())?;
        Ok(Some(InquelloTaskReopenResponse{task:task_view(&task),hit,internal_disclosure_fence}.into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn saved_response_fence_never_crosses_wire() {
        let response=InquelloWorkspaceSearchResponse{workspace_id:"workspace".into(),query:"invoice".into(),items:Vec::new(),next_cursor:None,unavailable:false,coverage:Vec::new(),internal_disclosure_fence:"INTERNAL-LINEAGE-ONLY".into()};
        let wire=serde_json::to_string(&response).unwrap();
        assert!(!wire.contains("INTERNAL-LINEAGE-ONLY"));assert!(!wire.contains("internalDisclosureFence"));
        let restored:InquelloWorkspaceSearchResponse=serde_json::from_str(&wire).unwrap();assert!(restored.internal_disclosure_fence.is_empty(),"wire data cannot mint the native sidecar");
    }
    #[test] fn final_disclosure_rejects_removed_rotated_or_changed_prior_lineage() {
        let prior:TaskRunBinding=serde_json::from_value(serde_json::json!({"operation_id":"start","task_id":"task","run_id":"old-run","principal_id":"creator","workspace_id":"workspace","runtime_id":"old-runtime","thread_id":"thread","turn_id":"old-turn","status":"completed","route_id":"codex-responses","configuration_revision":1,"choices":{"reasoning":"medium","speed":"standard"}})).unwrap();
        let mut current=prior.clone();current.run_id="current-run".into();current.turn_id=Some("current-turn".into());
        let original=vec![prior.clone(),current.clone()];let digest=lineage_digest(&original).unwrap();
        assert!(saved_history_matches(&digest,"revision-1",&original,"revision-1").unwrap());
        assert!(!saved_history_matches(&digest,"revision-1",&[current.clone()],"revision-1").unwrap(),"the generic scope await cannot erase prior-turn binding requirements");
        let mut rotated=original.clone();rotated[0].turn_id=Some("replacement-turn".into());assert!(!saved_history_matches(&digest,"revision-1",&rotated,"revision-1").unwrap());
        rotated=original.clone();rotated[0].configuration_revision=2;assert!(!saved_history_matches(&digest,"revision-1",&rotated,"revision-1").unwrap());
        assert!(!saved_history_matches(&digest,"revision-1",&original,"revision-2").unwrap());
    }
    #[test] fn exact_retained_message_preserves_markdown_while_matching_visible_text() {
        let original="Vendor **evidence** required: [invoice](https://example.invalid/invoice)";
        let item:ThreadItem=serde_json::from_value(serde_json::json!({"type":"agentMessage","id":"retained-item","text":original})).unwrap();
        assert!(codex_thread_store::conversation_match_snippet(&item,"Vendor evidence required").is_some());
        assert_eq!(retained_message_text(&item).as_deref(),Some(original));
    }
    #[test] fn saved_search_bounds_and_unicode() {
        assert!(!query_valid(""));assert!(!query_valid("  "));assert!(!query_valid("invoice\n"));
        assert!(!query_valid(&"é".repeat(129)));assert!(query_valid("INV-104"));
        let text=format!("{} potential K12,480 {}","old ".repeat(5000),"tail ".repeat(5000));
        let matched=snippet(&text,"POTENTIAL K12,480").unwrap();
        assert!(matched.contains("potential K12,480"));assert!(matched.chars().count()<300);
    }
    #[test] fn saved_search_only_user_assistant_text() {
        let agent:ThreadItem=serde_json::from_value(serde_json::json!({"type":"agentMessage","id":"old-item","text":"Invoice INV-104"})).unwrap();
        assert_eq!(conversation_text(&agent).as_deref(),Some("Invoice INV-104"));
        let plan:ThreadItem=serde_json::from_value(serde_json::json!({"type":"plan","id":"hidden-plan","text":"Invoice INV-104"})).unwrap();
        assert!(conversation_text(&plan).is_none());
    }
    #[test] fn saved_search_cursor_is_query_scope_and_snapshot_bound() {
        let c=SearchCursor{workspace:"w".into(),query:"invoice".into(),archived:true,digest:"changed-text-invalidates".into(),offset:50};
        let wire=serde_json::to_string(&c).unwrap();let parsed:SearchCursor=serde_json::from_str(&wire).unwrap();
        assert_eq!(parsed.query,"invoice");assert_eq!(parsed.offset,PAGE_SIZE);
        assert!(serde_json::from_str::<SearchCursor>(r#"{"workspace":"w","query":"x","archived":false,"digest":"d","offset":0,"grant":true}"#).is_err());
    }
}
