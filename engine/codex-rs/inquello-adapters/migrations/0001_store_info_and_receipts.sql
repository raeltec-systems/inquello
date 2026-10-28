-- Inquello working store, schema version 1.
-- Holds the single store_info record and durable operation receipts only.

CREATE TABLE store_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    store_id TEXT NOT NULL CHECK (length(store_id) = 36),
    schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE operation_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    command TEXT NOT NULL CHECK (command IN ('initialize_store')),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
