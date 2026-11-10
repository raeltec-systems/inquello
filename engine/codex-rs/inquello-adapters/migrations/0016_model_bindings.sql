-- Immutable configurations and Task foreign keys remain untouched. Eligibility
-- still requires trusted credentials, policy and exact-build qualification.
CREATE TABLE processing_model_bindings (
    principal_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    configuration_revision INTEGER NOT NULL,
    binding_id TEXT NOT NULL UNIQUE CHECK(length(binding_id) = 36),
    state TEXT NOT NULL CHECK(state IN ('active', 'revoked', 'legacy-superseded')),
    revision INTEGER NOT NULL CHECK(revision >= 1),
    PRIMARY KEY(principal_id, route_id, configuration_revision),
    FOREIGN KEY(principal_id, route_id, configuration_revision)
        REFERENCES processing_route_candidates(principal_id, route_id, revision)
) STRICT;

INSERT INTO processing_model_bindings
SELECT c.principal_id, c.route_id, c.revision,
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-8' ||
    substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    CASE WHEN c.revision = (SELECT MAX(other.revision) FROM processing_route_candidates other
        WHERE other.principal_id = c.principal_id AND other.route_id = c.route_id)
        THEN 'active' ELSE 'legacy-superseded' END, 1
FROM processing_route_candidates c;

-- Rebuild only the receipt table to widen its command constraint. Explicit
-- columns preserve historical request bytes, timestamps and interpretation.
CREATE TABLE processing_route_receipts_model_bindings (
    operation_id TEXT PRIMARY KEY NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK(length(principal_id) = 36),
    command TEXT NOT NULL CHECK(command IN ('configure_route', 'set_task_route', 'resolve_model_binding', 'revoke_model_binding', 'revalidate_model_binding')),
    scope_id TEXT NOT NULL,
    expected_revision INTEGER NOT NULL CHECK(expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK(resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK(json_valid(request)),
    status TEXT NOT NULL CHECK(status = 'applied'),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
INSERT INTO processing_route_receipts_model_bindings
    SELECT operation_id, principal_id, command, scope_id, expected_revision,
        resulting_revision, request, status, recorded_at_ms FROM processing_route_receipts;
DROP TABLE processing_route_receipts;
ALTER TABLE processing_route_receipts_model_bindings RENAME TO processing_route_receipts;

-- A terminal conversation may explicitly select another exact binding. The
-- immutable prior run remains in task_run_history; a pending run cannot change.
DROP TRIGGER task_runs_binding_immutable;
CREATE TRIGGER task_runs_binding_immutable BEFORE UPDATE ON task_runs
WHEN OLD.principal_id != NEW.principal_id OR OLD.operation_id != NEW.operation_id
 OR OLD.task_id != NEW.task_id
 OR (OLD.thread_id IS NOT NULL AND OLD.thread_id IS NOT NEW.thread_id)
 OR json_extract(OLD.record,'$.operation_id') IS NOT json_extract(NEW.record,'$.operation_id')
 OR json_extract(OLD.record,'$.task_id') IS NOT json_extract(NEW.record,'$.task_id')
 OR json_extract(OLD.record,'$.principal_id') IS NOT json_extract(NEW.record,'$.principal_id')
 OR json_extract(OLD.record,'$.workspace_id') IS NOT json_extract(NEW.record,'$.workspace_id')
 OR ((json_extract(OLD.record,'$.route_id') IS NOT json_extract(NEW.record,'$.route_id')
      OR json_extract(OLD.record,'$.configuration_revision') IS NOT json_extract(NEW.record,'$.configuration_revision'))
     AND (json_extract(OLD.record,'$.status') NOT IN ('completed','failed','cancelled','setup-failed')
       OR NOT EXISTS(SELECT 1 FROM task_processing_routes selected JOIN processing_model_bindings binding
         ON binding.principal_id=selected.principal_id AND binding.route_id=selected.route_id
         AND binding.configuration_revision=selected.configuration_revision AND binding.state='active'
         WHERE selected.task_id=OLD.task_id AND selected.principal_id=OLD.principal_id
           AND selected.revision=(SELECT MAX(latest.revision) FROM task_processing_routes latest WHERE latest.task_id=OLD.task_id)
           AND selected.route_id=json_extract(NEW.record,'$.route_id')
           AND selected.configuration_revision=json_extract(NEW.record,'$.configuration_revision'))))
 OR (json_extract(OLD.record,'$.choices') IS NOT json_extract(NEW.record,'$.choices')
     AND (json_extract(OLD.record,'$.status') NOT IN ('completed','failed','cancelled','setup-failed')
       OR NOT EXISTS(SELECT 1 FROM task_usage_settings settings WHERE settings.task_id=OLD.task_id
         AND settings.revision=(SELECT MAX(latest.revision) FROM task_usage_settings latest WHERE latest.task_id=OLD.task_id)
         AND json_extract(settings.record,'$.choices')=json_extract(NEW.record,'$.choices'))))
 OR ((OLD.runtime_id IS NOT NEW.runtime_id
      OR json_extract(OLD.record,'$.run_id') IS NOT json_extract(NEW.record,'$.run_id')
      OR (json_extract(OLD.record,'$.turn_id') IS NOT NULL AND json_extract(OLD.record,'$.turn_id') IS NOT json_extract(NEW.record,'$.turn_id')))
     AND NOT EXISTS (SELECT 1 FROM task_lifecycle l WHERE l.principal_id=OLD.principal_id AND l.task_id=OLD.task_id
       AND json_extract(l.intent,'$.kind')='resume'
       AND json_extract(l.intent,'$.expected.run_id')=json_extract(OLD.record,'$.run_id')
       AND json_extract(l.receipt,'$.status')='dispatching'
       AND json_extract(l.receipt,'$.binding.run_id')=json_extract(NEW.record,'$.run_id')
       AND json_extract(l.receipt,'$.binding.runtime_id')=NEW.runtime_id))
BEGIN SELECT RAISE(ABORT, 'task runtime association requires exact model selection or retained resume'); END;
