-- Local tool accounting is metadata, not retained model content. Preserve an
-- existing native draft receipt for local probes/execution; never reconstruct a
-- receipt that was already removed or classify any Task files as synthetic.
DROP TRIGGER draft_provenance_on_usage;
CREATE TRIGGER draft_provenance_on_usage AFTER INSERT ON task_usage_attempts
WHEN json_extract(NEW.record, '$.snapshot.operation_kind') IS NOT 'local-tool'
BEGIN DELETE FROM task_metadata_provenance WHERE task_id=NEW.task_id; END;
