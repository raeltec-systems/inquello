//! A non-effect publisher. Native function output is retained in governed history.
use crate::function_tool::FunctionCallError;
use crate::tools::context::{FunctionToolOutput, ToolInvocation, ToolPayload, boxed_tool_output};
use crate::tools::registry::{CoreToolRuntime, ToolExecutor};
use codex_tools::{ResponsesApiTool, ToolName, ToolSpec};
use inquello_protocol::progress::Publication;
use serde_json::json;

pub struct InquelloProgressHandler;
impl ToolExecutor<ToolInvocation> for InquelloProgressHandler {
    fn tool_name(&self) -> ToolName { ToolName::plain("inquello_progress") }
    fn spec(&self) -> ToolSpec {
        let reference = json!({"type":"array","items":{"type":"string"}});
        let parameters = json!({"type":"object","additionalProperties":false,"required":["version","plan","results"],"properties":{
            "version":{"type":"integer","enum":[1]},
            "plan":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","revision","text","status","evidenceIds"],"properties":{
                "id":{"type":"string"},"revision":{"type":"integer"},"text":{"type":"string"},"status":{"type":"string","enum":["pending","running","completed"]},"evidenceIds":reference.clone()}}},
            "results":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","kind","text","evidenceIds"],"properties":{
                "id":{"type":"string"},"kind":{"type":"string","enum":["calculation","observation","suggestion","decision","gap"]},"text":{"type":"string"},"evidenceIds":reference,"basisId":{"type":"string"},"revision":{"type":"integer"},"state":{"type":"string","enum":["current","withdrawn"]},"changeReason":{"type":"string"}}}}
        }});
        ToolSpec::Function(ResponsesApiTool {
            name:"inquello_progress".into(),
            description:"Publish version 1 plan and results for this private Task. When the auditor corrects ordinary instructions, revise the plan and actually rerun affected analysis before claiming adapted findings. Preserve unaffected work. Keep stable step/result IDs. Increase step revision when its text changes. For each changed result increase revision and supply changeReason explaining the correction and evidenceIds identifying the reanalysis; use state current for replacement, or withdrawn for a finding no longer valid. Withdraw only an existing result with a newer revision and reason. Omitted IDs remain current, omission is not withdrawal. Prior revisions remain inspectable, separate from current findings. Give a concise conversational summary of what changed; ask a contextual question only for material ambiguity. Admission of steering is not completed adaptation. Evidence IDs must identify actual retained items in this authorized Task history. Completed steps are claims until native evidence resolves; confirmed action text must exactly equal the native command or applied edit text. Analytical findings and all revisions are unchecked, never independent verification or carried-forward signoff. Omit basisId unless it names an actual human instruction ID whose exact text is repeated by the decision. Permission to execute is not review. No artifacts or permissions are created. At most 65536 UTF-8 bytes.".into(),
            strict:false, defer_loading:None,
            parameters:serde_json::from_value(parameters).expect("fixed progress tool schema"), output_schema:None,
        })
    }
    fn handle<'a>(&'a self, invocation: ToolInvocation) -> codex_tools::ToolExecutorFuture<'a> where ToolInvocation:'a {
        Box::pin(async move {
            let authorization = invocation.turn.extension_data.get::<crate::inquello_inference::TaskAuthorizationContext>()
                .ok_or_else(|| FunctionCallError::RespondToModel("Private Task publication unavailable".into()))?;
            let ToolPayload::Function { arguments } = &invocation.payload else { return Err(FunctionCallError::RespondToModel("Publication requires structured arguments".into())); };
            let publication = Publication::parse(arguments).map_err(|message| FunctionCallError::RespondToModel(message.into()))?;
            authorization.0.before_tool("inquello_progress", arguments, &invocation.call_id).await
                .map_err(|_| FunctionCallError::RespondToModel("Current publication authority unavailable".into()))?;
            let retained = serde_json::to_string(&publication).map_err(|_| FunctionCallError::Fatal("Publication unavailable".into()))?;
            Ok(boxed_tool_output(FunctionToolOutput::from_text(retained, Some(true))))
        })
    }
}
impl CoreToolRuntime for InquelloProgressHandler {
    fn is_builtin_control_tool(&self) -> bool { true }
}

#[cfg(test)]
mod tests {
    use super::*;
    use inquello_protocol::inference::{validate_arguments,validate_schema};
    #[test]
    fn exact_publisher_schema_and_arguments_fit_current_route() {
        let ToolSpec::Function(tool)=InquelloProgressHandler.spec() else {panic!("function schema");};
        let schema=serde_json::to_value(tool.parameters).expect("actual advertised schema");
        validate_schema(&schema,0).expect("current Messages route accepts exact publisher schema");
        let arguments=json!({"version":1,"plan":[{"id":"inspect","revision":1,"text":"Inspect fictional R02 approval","status":"pending","evidenceIds":[]}],"results":[{"id":"gap","kind":"gap","text":"Approval evidence not provided","evidenceIds":[]}]});
        validate_arguments(&schema,&arguments,0).expect("model arguments accepted");
        Publication::parse(&arguments.to_string()).expect("native bounded publication accepted");
        let mut malformed=arguments;malformed["results"][0]["basisId"]=json!(null);
        assert!(validate_arguments(&schema,&malformed,0).is_err(),"omit optional basis; no unsupported nullable union");
    }
    #[test]
    fn exact_existing_question_schema_fits_current_route() {
        let ToolSpec::Function(tool)=crate::tools::handlers::RequestUserInputHandler {
            available_modes:vec![codex_protocol::config_types::ModeKind::Default],
        }.spec() else {panic!("function schema");};
        let schema=serde_json::to_value(tool.parameters).expect("actual advertised question schema");
        validate_schema(&schema,0).expect("current Messages route accepts exact existing question schema");
        validate_arguments(&schema,&json!({"questions":[{"id":"audit_scope","header":"Scope","question":"Report findings without edits?","options":[{"label":"Review only","description":"Report observations"},{"label":"Clarify","description":"Wait for instructions"}]}]}),0).expect("exact native question arguments");
    }
}
