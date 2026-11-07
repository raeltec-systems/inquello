-- Attribution is committed with the one-use permission decision, never a Task
-- review/Professional Approval marker. It contains no credentials or model prose.
CREATE TABLE automated_permission_reviews (
    invocation_id TEXT PRIMARY KEY NOT NULL CHECK(length(invocation_id) = 36),
    request_id TEXT NOT NULL UNIQUE REFERENCES permission_requests(request_id),
    attempt_id TEXT NOT NULL UNIQUE CHECK(length(attempt_id) = 36),
    attribution TEXT NOT NULL CHECK(json_valid(attribution)),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
