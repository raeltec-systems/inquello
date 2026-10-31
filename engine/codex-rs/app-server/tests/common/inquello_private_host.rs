//! Shared retained-child host fixture. It answers ordinary authority/permission
//! callbacks; no model response or native effect executes in this parent process.
use app_test_support::TestAppServer;
use serde_json::{Value,json};
use std::time::Duration;
pub(super) type AuthorityCallback = std::sync::Arc<dyn Fn(Value) -> std::pin::Pin<Box<dyn std::future::Future<Output=Value> + Send>> + Send + Sync>;
pub(super) type RevokeCallback = std::sync::Arc<dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output=()> + Send>> + Send + Sync>;
pub(super) struct PrivateTaskHost {pub(super) authority_context:Value,pub(super) authority_callback:Option<AuthorityCallback>,pub(super) revoke_callback:Option<RevokeCallback>,pub(super) authority_available:bool,pub(super) workspace_id:String,pub(super) answered_questions:usize,pub(super) allow_once:bool, pub(super) lifecycle:Option<&'static str>,pub(super) policy:Value,pub(super) notifications:Vec<Value>,pub(super) denied_commands:Vec<Vec<String>>,pub(super) bound_thread:Option<String>,pub(super) pending:std::collections::HashMap<i64,Value>}
pub(super) async fn private_rpc(server:&mut TestAppServer,host:&mut PrivateTaskHost,method:&str,params:Value)->Value {
    let id=server.send_request(method,Some(params)).await.expect("send private operation");
    private_response(server,host,id).await
}
pub(super) async fn private_response(server:&mut TestAppServer,host:&mut PrivateTaskHost,id:i64)->Value {
    use codex_app_server_protocol::{JSONRPCMessage,RequestId};
    if let Some(response)=host.pending.remove(&id){return response;}
    let deadline=tokio::time::Instant::now()+Duration::from_secs(45);
    loop {
        if let Some(response)=host.pending.remove(&id){return response;}
        let message=tokio::time::timeout_at(deadline,server.read_next_message()).await.expect("private RPC deadline").expect("native message");
        match message {
            JSONRPCMessage::Response(response) if response.id==RequestId::Integer(id)=>return response.result,
            JSONRPCMessage::Error(error) if error.id==RequestId::Integer(id)=>return json!({"rpcError":error.error}),
            JSONRPCMessage::Response(response)=>{let RequestId::Integer(other)=response.id else {panic!("unexpected string response identity")};host.pending.insert(other,response.result);},
            JSONRPCMessage::Error(error)=>{let RequestId::Integer(other)=error.id else {panic!("unexpected string error identity")};host.pending.insert(other,json!({"rpcError":error.error}));},
            JSONRPCMessage::Request(request)=>match request.method.as_str() {
                "inquello/tasks/authority"=>{
                    assert_eq!(request.params.as_ref().expect("authority params")["workspaceId"],host.workspace_id);
                    let response=if !host.authority_available {json!({"workspacePolicy":null})} else if let Some(callback)=host.authority_callback.clone() { {let mut params=request.params.unwrap();params["fixtureContext"]=host.authority_context.clone();callback(params).await} } else {json!({"workspacePolicy":host.policy})};
                    server.send_response(request.id,response).await.expect("fresh host authority");
                },
                "item/tool/requestUserInput"=>{
                    let params=request.params.expect("actual scoped question");
                    let owned=Box::pin(private_rpc(server,host,"inquello/tasks/forThread",json!({"threadId":params["threadId"]}))).await;
                    assert_eq!(owned["turnId"],params["turnId"]);assert_eq!(owned["workspaceId"],host.workspace_id);
                    assert_eq!(params["questions"][0]["id"],"audit_scope");
                    assert_eq!(params["questions"][0]["options"][0]["label"],"Review only");
                    assert_eq!(params["questions"][0]["isSecret"],false);
                    host.answered_questions+=1;
                    server.send_response(request.id,json!({"answers":{"audit_scope":{"answers":["Review only"]}}})).await.expect("exact question response, not tool permission");
                },
                "execCommandApproval"=>{
                    let params=request.params.expect("approval params");
                    if host.lifecycle==Some("interrupt-between-attempts") {
                        let started=host.notifications.iter().find(|n|n["method"]=="turn/started").expect("actual started turn");
                        let interrupt=json!({"threadId":params["conversationId"],"turnId":started["params"]["turn"]["id"]});
                        assert!(interrupt["turnId"].as_str().is_some(),"interrupt the actual bound turn");
                        let response=Box::pin(private_rpc(server,host,"turn/interrupt",interrupt)).await;
                        assert!(response.get("rpcError").is_none(),"real retained interrupt: {response}");
                        server.send_response(request.id,json!({"decision":"denied"})).await.expect("close pending approval");
                        continue;
                    }
                    let thread=params["conversationId"].as_str().expect("real thread").to_owned();
                    let owned=Box::pin(private_rpc(server,host,"inquello/tasks/forThread",json!({"threadId":thread}))).await;
                    assert_eq!(owned["threadId"],thread);assert!(owned["taskId"].as_str().is_some());
                    host.authority_context["taskId"]=owned["taskId"].clone();
                    host.authority_context["runId"]=owned["runId"].clone();
                    host.authority_context["threadId"]=owned["threadId"].clone();
                    host.bound_thread=Some(thread);
                    let command:Vec<String>=serde_json::from_value(params["command"].clone()).expect("exact native argv, not split command text");
                    let permission=uuid::Uuid::new_v4().to_string();
                    let policy=host.policy.clone();
                    let recorded=Box::pin(private_rpc(server,host,"inquello/permissions/request",json!({"operationId":uuid::Uuid::new_v4().to_string(),"requestId":permission,
                        "workspacePolicy":policy,"taskId":owned["taskId"],"command":command,"origin":"runtime","ttlMs":60000}))).await;
                    assert_eq!(recorded["request"]["origin"],"runtime");
                    let allow=host.allow_once && (host.lifecycle!=Some("changed-command") || host.denied_commands.is_empty());
                    let outcome=if allow {"allowed"}else{"denied"};
                    let decided=Box::pin(private_rpc(server,host,"inquello/permissions/decide",json!({"operationId":uuid::Uuid::new_v4().to_string(),"requestId":permission,
                        "expectedRevision":1,"outcome":outcome,"actorKind":"human","actorRef":null}))).await;
                    assert_eq!(decided["request"]["decision"]["outcome"],outcome);
                    if host.lifecycle==Some("revoke-pending-permission") {
                        if let Some(revoke)=host.revoke_callback.clone(){revoke().await;}else{host.authority_available=false;}
                        let consumed=Box::pin(private_rpc(server,host,"inquello/tasks/consumePermission",json!({"taskId":owned["taskId"],"requestId":permission,"command":command,"workspacePolicy":policy}))).await;
                        assert!(consumed.get("rpcError").is_some(),"withdrawal defeats already approved permission");
                        host.denied_commands.push(command);
                        server.send_response(request.id,json!({"decision":"approved"})).await.expect("late approval is not authority");
                        continue;
                    }
                    if allow {
                        let consume=json!({"taskId":owned["taskId"],"requestId":permission,"command":command,"workspacePolicy":policy});
                        let consumed=Box::pin(private_rpc(server,host,"inquello/tasks/consumePermission",consume.clone())).await;
                        assert_eq!(consumed["accepted"],true,"normal native permission consumption");
                        let twice=Box::pin(private_rpc(server,host,"inquello/tasks/consumePermission",consume)).await;
                        assert!(twice.get("rpcError").is_some(),"same permission cannot be consumed twice");
                    }
                    host.denied_commands.push(command);
                    server.send_response(request.id,json!({"decision":if allow {"approved"}else{"denied"}})).await.expect("answer exact native action");
                },
                other=>panic!("unexpected private runtime request: {other}"),
            },
            JSONRPCMessage::Notification(notification)=>host.notifications.push(json!({"method":notification.method,"params":notification.params})),

        }
    }
}
