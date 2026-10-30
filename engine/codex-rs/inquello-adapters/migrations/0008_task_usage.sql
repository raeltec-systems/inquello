-- Private Task metadata: cascades with Task deletion; no prompts or credentials.
CREATE TABLE task_usage_settings (
 task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision > 0),
 record TEXT NOT NULL CHECK(json_valid(record)),
 PRIMARY KEY(task_id, revision)
) STRICT;
CREATE TABLE task_usage_receipts (
 operation_id TEXT PRIMARY KEY NOT NULL,
 task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
 principal_id TEXT NOT NULL,
 request TEXT NOT NULL CHECK(json_valid(request)),
 result TEXT NOT NULL CHECK(json_valid(result))
) STRICT;
CREATE TABLE task_usage_attempts (
 attempt_id TEXT PRIMARY KEY NOT NULL,
 task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
 principal_id TEXT NOT NULL,
 runtime_id TEXT NOT NULL,
 started_at_ms INTEGER NOT NULL,
 record TEXT NOT NULL CHECK(json_valid(record))
) STRICT;
CREATE INDEX task_usage_attempts_history ON task_usage_attempts(task_id, started_at_ms DESC);
-- Updates may add trusted events/terminal state, never rewrite historical choices.
CREATE TRIGGER task_usage_snapshot_immutable BEFORE UPDATE ON task_usage_attempts
WHEN OLD.attempt_id != NEW.attempt_id OR OLD.task_id != NEW.task_id
 OR OLD.principal_id != NEW.principal_id OR OLD.runtime_id != NEW.runtime_id
 OR OLD.started_at_ms != NEW.started_at_ms
 OR json_extract(OLD.record, '$.snapshot') != json_extract(NEW.record, '$.snapshot')
BEGIN SELECT RAISE(ABORT, 'usage attempt snapshot is immutable'); END;
CREATE TRIGGER task_usage_settings_immutable BEFORE UPDATE ON task_usage_settings
BEGIN SELECT RAISE(ABORT, 'usage settings revisions are immutable'); END;
CREATE TRIGGER task_usage_receipts_immutable BEFORE UPDATE ON task_usage_receipts
BEGIN SELECT RAISE(ABORT, 'usage operation receipts are immutable'); END;
