-- Native-classified only; old Tasks deliberately remain unknown/quarantined.
CREATE TABLE task_data_provenance (
 task_id TEXT PRIMARY KEY NOT NULL REFERENCES tasks(task_id),
 principal_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL,
 data_tier TEXT NOT NULL CHECK(data_tier IN ('synthetic','real')),
 recorded_at_ms INTEGER NOT NULL
) STRICT;
CREATE TRIGGER task_data_provenance_immutable BEFORE UPDATE ON task_data_provenance
BEGIN SELECT RAISE(ABORT, 'native Task classification is immutable'); END;
