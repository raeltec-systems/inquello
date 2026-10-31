-- Native human-authored draft metadata is owned independently of model eligibility.
-- It never grants a synthetic classification or permission to dispatch inference.
CREATE TABLE task_metadata_provenance (
 task_id TEXT PRIMARY KEY NOT NULL REFERENCES tasks(task_id),
 principal_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL,
 provenance_kind TEXT NOT NULL CHECK(provenance_kind='draft_metadata')
) STRICT;
CREATE TRIGGER draft_provenance_on_task_change AFTER UPDATE ON tasks
WHEN NEW.runtime_thread_id IS NOT NULL OR NEW.source_refs != '[]' OR NEW.artifact_refs != '[]'
 OR NEW.workspace_id != OLD.workspace_id OR NEW.creator_principal_id != OLD.creator_principal_id
BEGIN DELETE FROM task_metadata_provenance WHERE task_id=NEW.task_id; END;
CREATE TRIGGER draft_provenance_on_run AFTER INSERT ON task_runs
BEGIN DELETE FROM task_metadata_provenance WHERE task_id=NEW.task_id; END;
CREATE TRIGGER draft_provenance_on_history AFTER INSERT ON task_start_history
BEGIN DELETE FROM task_metadata_provenance WHERE task_id=NEW.task_id; END;
CREATE TRIGGER draft_provenance_on_data_tier AFTER INSERT ON task_data_provenance
BEGIN DELETE FROM task_metadata_provenance WHERE task_id=NEW.task_id; END;
CREATE TRIGGER draft_provenance_on_usage AFTER INSERT ON task_usage_attempts
BEGIN DELETE FROM task_metadata_provenance WHERE task_id=NEW.task_id; END;
