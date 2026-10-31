-- Governed private command history and receipts; no reusable dispatch permits.
CREATE TABLE task_lifecycle (
 principal_id TEXT NOT NULL,
 operation_id TEXT NOT NULL,
 task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
 intent TEXT NOT NULL CHECK(json_valid(intent)),
 receipt TEXT NOT NULL CHECK(json_valid(receipt)),
 PRIMARY KEY(principal_id,operation_id)
) STRICT;
CREATE TABLE task_run_history (
 task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
 run_id TEXT PRIMARY KEY NOT NULL,
 record TEXT NOT NULL CHECK(json_valid(record))
) STRICT;
CREATE TRIGGER task_run_history_immutable BEFORE UPDATE ON task_run_history
BEGIN SELECT RAISE(ABORT, 'retained run history is immutable'); END;
CREATE TRIGGER task_lifecycle_intent_immutable BEFORE UPDATE ON task_lifecycle
WHEN OLD.principal_id IS NOT NEW.principal_id OR OLD.operation_id IS NOT NEW.operation_id
 OR OLD.task_id IS NOT NEW.task_id OR OLD.intent IS NOT NEW.intent
BEGIN SELECT RAISE(ABORT, 'lifecycle identity is immutable'); END;
-- Retained resume may rotate execution incarnation, never Task/thread ownership.
DROP TRIGGER task_runs_binding_immutable;
CREATE TRIGGER task_runs_binding_immutable BEFORE UPDATE ON task_runs
WHEN OLD.principal_id != NEW.principal_id OR OLD.operation_id != NEW.operation_id
 OR OLD.task_id != NEW.task_id
 OR (OLD.thread_id IS NOT NULL AND OLD.thread_id IS NOT NEW.thread_id)
 OR json_extract(OLD.record,'$.operation_id') IS NOT json_extract(NEW.record,'$.operation_id')
 OR json_extract(OLD.record,'$.task_id') IS NOT json_extract(NEW.record,'$.task_id')
 OR json_extract(OLD.record,'$.principal_id') IS NOT json_extract(NEW.record,'$.principal_id')
 OR json_extract(OLD.record,'$.workspace_id') IS NOT json_extract(NEW.record,'$.workspace_id')
 OR json_extract(OLD.record,'$.route_id') IS NOT json_extract(NEW.record,'$.route_id')
 OR json_extract(OLD.record,'$.configuration_revision') IS NOT json_extract(NEW.record,'$.configuration_revision')
 OR json_extract(OLD.record,'$.choices') IS NOT json_extract(NEW.record,'$.choices')
 OR ((OLD.runtime_id IS NOT NEW.runtime_id
      OR json_extract(OLD.record,'$.run_id') IS NOT json_extract(NEW.record,'$.run_id')
      OR (json_extract(OLD.record,'$.turn_id') IS NOT NULL AND json_extract(OLD.record,'$.turn_id') IS NOT json_extract(NEW.record,'$.turn_id')))
     AND NOT EXISTS (SELECT 1 FROM task_lifecycle l WHERE l.principal_id=OLD.principal_id AND l.task_id=OLD.task_id
       AND json_extract(l.intent,'$.kind')='resume'
       AND json_extract(l.intent,'$.expected.run_id')=json_extract(OLD.record,'$.run_id')
       AND json_extract(l.receipt,'$.status')='dispatching'
       AND json_extract(l.receipt,'$.binding.run_id')=json_extract(NEW.record,'$.run_id')
       AND json_extract(l.receipt,'$.binding.runtime_id')=NEW.runtime_id))
BEGIN SELECT RAISE(ABORT, 'task runtime association requires retained resume'); END;
