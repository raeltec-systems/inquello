-- Content-free device-local process-lease lineage, never sufficient authority.
-- The corresponding nonce sidecar is excluded from exports and recovery.
CREATE TABLE task_runtime_leases (
 runtime_id TEXT PRIMARY KEY NOT NULL,
 lease_domain TEXT NOT NULL
) STRICT;
CREATE TRIGGER task_runtime_leases_immutable BEFORE UPDATE ON task_runtime_leases
BEGIN SELECT RAISE(ABORT, 'runtime lease lineage is immutable'); END;
