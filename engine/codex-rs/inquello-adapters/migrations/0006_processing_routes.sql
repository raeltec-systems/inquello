-- Story 1.22. Configuration carries no credential or eligibility. Selection is
-- creator-private and has a revision independent of Task organisation/state.
CREATE TABLE processing_route_candidates (
    principal_id TEXT NOT NULL CHECK(length(principal_id) = 36),
    route_id TEXT NOT NULL CHECK(route_id IN ('codex-responses', 'claude-api-key')),
    revision INTEGER NOT NULL CHECK(revision >= 1),
    configuration TEXT NOT NULL CHECK(json_valid(configuration)),
    recorded_at_ms INTEGER NOT NULL,
    PRIMARY KEY(principal_id, route_id, revision)
) STRICT;

CREATE TABLE task_processing_routes (
    task_id TEXT NOT NULL REFERENCES tasks(task_id),
    revision INTEGER NOT NULL CHECK(revision >= 1),
    principal_id TEXT NOT NULL CHECK(length(principal_id) = 36),
    route_id TEXT NOT NULL CHECK(route_id IN ('codex-responses', 'claude-api-key')),
    configuration_revision INTEGER NOT NULL CHECK(configuration_revision >= 1),
    recorded_at_ms INTEGER NOT NULL,
    PRIMARY KEY(task_id, revision),
    FOREIGN KEY(principal_id, route_id, configuration_revision)
        REFERENCES processing_route_candidates(principal_id, route_id, revision)
) STRICT;

CREATE TABLE processing_route_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK(length(principal_id) = 36),
    command TEXT NOT NULL CHECK(command IN ('configure_route', 'set_task_route')),
    scope_id TEXT NOT NULL,
    expected_revision INTEGER NOT NULL CHECK(expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK(resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK(json_valid(request)),
    status TEXT NOT NULL CHECK(status = 'applied'),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
