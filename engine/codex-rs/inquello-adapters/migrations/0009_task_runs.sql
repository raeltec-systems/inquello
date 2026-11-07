-- Governed creator-private Task history; receipts contain no submitted text.
CREATE TABLE task_start_history (
 task_id TEXT PRIMARY KEY NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
 intent TEXT NOT NULL CHECK(json_valid(intent))
) STRICT;
CREATE TABLE task_runs (
 principal_id TEXT NOT NULL,
 operation_id TEXT NOT NULL,
 task_id TEXT NOT NULL UNIQUE REFERENCES tasks(task_id) ON DELETE CASCADE,
 runtime_id TEXT NOT NULL,
 thread_id TEXT,
 record TEXT NOT NULL CHECK(json_valid(record)),
 PRIMARY KEY(principal_id, operation_id),
 UNIQUE(thread_id)
) STRICT;
CREATE TRIGGER task_start_history_immutable BEFORE UPDATE ON task_start_history
BEGIN SELECT RAISE(ABORT, 'private start history is immutable'); END;
CREATE TRIGGER task_runs_binding_immutable BEFORE UPDATE ON task_runs
WHEN OLD.principal_id != NEW.principal_id OR OLD.operation_id != NEW.operation_id
 OR OLD.task_id != NEW.task_id OR OLD.runtime_id != NEW.runtime_id
 OR (OLD.thread_id IS NOT NULL AND OLD.thread_id IS NOT NEW.thread_id)
 OR json_extract(OLD.record,'$.run_id') IS NOT json_extract(NEW.record,'$.run_id')
 OR json_extract(OLD.record,'$.operation_id') IS NOT json_extract(NEW.record,'$.operation_id')
 OR json_extract(OLD.record,'$.task_id') IS NOT json_extract(NEW.record,'$.task_id')
 OR json_extract(OLD.record,'$.principal_id') IS NOT json_extract(NEW.record,'$.principal_id')
 OR json_extract(OLD.record,'$.workspace_id') IS NOT json_extract(NEW.record,'$.workspace_id')
 OR json_extract(OLD.record,'$.runtime_id') IS NOT json_extract(NEW.record,'$.runtime_id')
 OR json_extract(OLD.record,'$.route_id') IS NOT json_extract(NEW.record,'$.route_id')
 OR json_extract(OLD.record,'$.configuration_revision') IS NOT json_extract(NEW.record,'$.configuration_revision')
 OR json_extract(OLD.record,'$.choices') IS NOT json_extract(NEW.record,'$.choices')
 OR (json_extract(OLD.record,'$.turn_id') IS NOT NULL AND json_extract(OLD.record,'$.turn_id') IS NOT json_extract(NEW.record,'$.turn_id'))
BEGIN SELECT RAISE(ABORT, 'task runtime association is immutable'); END;

-- Legacy attach_thread is not proof of ownership and cannot replace a binding.
CREATE TRIGGER bound_task_thread_immutable BEFORE UPDATE OF runtime_thread_id ON tasks
WHEN OLD.runtime_thread_id IS NOT NEW.runtime_thread_id
 AND EXISTS (SELECT 1 FROM task_runs WHERE task_id=OLD.task_id AND thread_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'bound Task thread is immutable'); END;
