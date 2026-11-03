//! Isolated storage evidence only: no credentials, provider calls or renderer claims.
use inquello_adapters::{SqliteWorkingStore, SystemClock};
use inquello_domain::organise::{
    Actor, CreateTask, OrganiseRecord, PrincipalId, Task, create_task,
};
use inquello_domain::routes::*;
use inquello_domain::usage::*;
use inquello_domain::{DomainError, Revision};
use uuid::Uuid;
fn ok<T, E: std::fmt::Debug>(r: Result<T, E>) -> T {
    r.unwrap_or_else(|e| panic!("{e:?}"))
}
/// Test-only connection shim for injecting lock/trigger failures into an already
/// initialized temporary store. Production connections remain in src/sqlite.rs.
#[expect(
    clippy::disallowed_methods,
    reason = "fixture-only SQLite fault injection shim"
)]
async fn fixture_pool(path: &std::path::Path) -> sqlx::SqlitePool {
    ok(sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(false),
        )
        .await)
}
fn actor(n: u8) -> Actor {
    Actor {
        principal_id: PrincipalId::from_uuid(Uuid::from_bytes([n; 16])),
    }
}
async fn task(s: &SqliteWorkingStore, a: Actor) -> Task {
    let o = ok(create_task(
        s,
        &SystemClock,
        a,
        CreateTask {
            operation_id: Uuid::new_v4().to_string(),
            expected_revision: Revision::ZERO,
            workspace_id: "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),
            engagement_id: None,
            folder_id: None,
            title: "Usage fixture".into(),
        },
    )
    .await);
    match o.record {
        OrganiseRecord::Task(t) => t,
        _ => panic!("Task required"),
    }
}
fn snapshot(a: Actor, t: &Task) -> AttemptSnapshot {
    AttemptSnapshot {
        attempt_id: Uuid::new_v4().to_string(),
        task_id: t.task_id.to_string(),
        principal_id: a.principal_id.to_string(),
        run_id: Uuid::new_v4().to_string(),
        runtime_id: "old-runtime".into(),
        operation_kind: OperationKind::LocalTool,
        route_id: None,
        model: None,
        api_version: None,
        configuration_revision: 0,
        route_revision: 0,
        settings_revision: 0,
        requested: Choices::default(),
        effective: Choices::default(),
        started_at_ms: 100,
    }
}
async fn configure(s: &SqliteWorkingStore, a: Actor, t: &Task) {
    ok(configure_route(
        s,
        &SystemClock,
        a,
        ConfigureRoute {
            operation_id: "configure".into(),
            expected_revision: Revision::ZERO,
            configuration: RouteConfigurationInput {
                route_id: "claude-api-key".into(),
                deployment: "anthropic-direct".into(),
                model: CLAUDE_MODEL.into(),
                api_version: CLAUDE_API_VERSION.into(),
                account_ref: Uuid::new_v4().to_string(),
                region: None,
            },
        },
    )
    .await);
    ok(set_task_route(
        s,
        &SystemClock,
        a,
        SetTaskRoute {
            operation_id: "select".into(),
            expected_revision: Revision::ZERO,
            task_id: t.task_id.to_string(),
            route_id: "claude-api-key".into(),
            configuration_revision: Revision::new(1),
        },
    )
    .await);
}
#[tokio::test]
async fn local_tool_accounting_preserves_owned_draft_metadata_without_classifying_content() {
    let dir = ok(tempfile::tempdir());
    let path = dir.path().join("work.db");
    let s = ok(SqliteWorkingStore::open(&path, &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    ok(s.begin_usage_attempt(snapshot(a, &t)).await);
    assert!(ok(s
        .task_is_native_draft(a.principal_id, &t.task_id.to_string())
        .await));
    assert!(!ok(s
        .task_is_native_draft(actor(2).principal_id, &t.task_id.to_string())
        .await));
    assert_eq!(
        ok(s.task_data_tier(a.principal_id, &t.task_id.to_string())
            .await),
        None
    );
    s.close().await;
    // A local tool may have written files. Metadata access must not turn those
    // unclassified files into exportable synthetic content.
    let inspected = inquello_adapters::data_provenance::inspect(
        inquello_adapters::data_provenance::InspectRequest {
            version: 1,
            store_path: path.clone(),
            principal_id: a.principal_id.to_string(),
            task_root: None,
            runtime_home: None,
        },
    )
    .await;
    assert!(!inspected.available);
    let s = ok(SqliteWorkingStore::open(&path, &[]).await);
    assert!(ok(s
        .task_is_native_draft(a.principal_id, &t.task_id.to_string())
        .await));
    configure(&s, a, &t).await;
    let allowed = vec!["default".into()];
    ok(set_task_usage_settings(
        &s,
        a,
        SetUsageSettings {
            operation_id: "model-defaults".into(),
            task_id: t.task_id.to_string(),
            expected_revision: 0,
            route_revision: 1,
            choices: Choices::default(),
        },
        &allowed,
        &allowed,
    )
    .await);
    let mut model_attempt = snapshot(a, &t);
    model_attempt.operation_kind = OperationKind::HumanRequestedModel;
    model_attempt.route_id = Some("claude-api-key".into());
    model_attempt.model = Some(CLAUDE_MODEL.into());
    model_attempt.api_version = Some(CLAUDE_API_VERSION.into());
    model_attempt.route_revision = 1;
    model_attempt.configuration_revision = 1;
    model_attempt.settings_revision = 1;
    ok(s.begin_usage_attempt(model_attempt).await);
    assert!(!ok(s
        .task_is_native_draft(a.principal_id, &t.task_id.to_string())
        .await));
}

#[tokio::test]
async fn defaults_replay_privacy_and_revision_conflict() {
    let dir = ok(tempfile::tempdir());
    let s = ok(SqliteWorkingStore::open(&dir.path().join("work.db"), &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    configure(&s, a, &t).await;
    let c = SetUsageSettings {
        operation_id: "defaults".into(),
        task_id: t.task_id.to_string(),
        expected_revision: 0,
        route_revision: 1,
        choices: Choices::default(),
    };
    let allowed = vec!["default".into()];
    let (x, y) = tokio::join!(
        set_task_usage_settings(&s, a, c.clone(), &allowed, &allowed),
        set_task_usage_settings(&s, a, c.clone(), &allowed, &allowed)
    );
    assert_eq!(ok(x), ok(y));
    assert_eq!(
        task_usage(&s, actor(2), &t.task_id.to_string()).await,
        Err(DomainError::NotFound)
    );
    assert_eq!(
        set_task_usage_settings(&s, actor(2), c.clone(), &allowed, &allowed).await,
        Err(DomainError::NotFound)
    );
    let mut stale = c.clone();
    stale.operation_id = "stale".into();
    assert!(matches!(
        set_task_usage_settings(&s, a, stale, &allowed, &allowed).await,
        Err(DomainError::RevisionConflict { .. })
    ));
    let mut bad = c;
    bad.choices.speed = "fast".into();
    assert!(
        set_task_usage_settings(&s, a, bad, &allowed, &allowed)
            .await
            .is_err()
    );
}
#[tokio::test]
async fn local_tools_without_model_route_retained_across_restart_and_no_replay() {
    let dir = ok(tempfile::tempdir());
    let path = dir.path().join("work.db");
    let s = ok(SqliteWorkingStore::open(&path, &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    let first = snapshot(a, &t);
    ok(s.begin_usage_attempt(first.clone()).await);
    assert!(s.begin_usage_attempt(first.clone()).await.is_err());
    let mut second = snapshot(a, &t);
    second.runtime_id = "still-live".into();
    ok(s.begin_usage_attempt(second.clone()).await);
    ok(s.finish_usage_attempt(
        a.principal_id,
        t.task_id,
        &second.attempt_id,
        FinishAttempt {
            status: AttemptStatus::Failed,
            ended_at_ms: 150,
            elapsed_ms: 50,
            output_ref: Some("output-reference".into()),
        },
    )
    .await);
    s.close().await;
    let s = ok(SqliteWorkingStore::open(&path, &[]).await);
    assert_eq!(ok(s.recover_usage_runtime("old-runtime").await), 1);
    let records = ok(task_usage(&s, a, &t.task_id.to_string()).await).attempts;
    assert_eq!(records.len(), 2);
    let old = records
        .iter()
        .find(|r| r.snapshot.attempt_id == first.attempt_id)
        .unwrap();
    assert_eq!(old.status, AttemptStatus::Uncertain);
    assert_eq!(old.usage.input_tokens, None);
    let failed = records
        .iter()
        .find(|r| r.snapshot.attempt_id == second.attempt_id)
        .unwrap();
    assert_eq!(failed.status, AttemptStatus::Failed);
    assert_eq!(failed.elapsed_ms, Some(50));
    let fabricated = UsageEvent {
        event_id: "fabricated".into(),
        sequence: 1,
        kind: UsageEventKind::Cumulative,
        usage: Consumption {
            input_tokens: Some(1),
            ..Default::default()
        },
    };
    assert!(
        s.record_usage_event(a.principal_id, t.task_id, &first.attempt_id, fabricated)
            .await
            .is_err()
    );
}
#[tokio::test]
async fn trusted_cumulative_events_deduplicate_and_late_usage_does_not_recover_status() {
    let dir = ok(tempfile::tempdir());
    let s = ok(SqliteWorkingStore::open(&dir.path().join("work.db"), &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    configure(&s, a, &t).await;
    let allowed = vec!["default".into()];
    ok(set_task_usage_settings(
        &s,
        a,
        SetUsageSettings {
            operation_id: "defaults".into(),
            task_id: t.task_id.to_string(),
            expected_revision: 0,
            route_revision: 1,
            choices: Choices::default(),
        },
        &allowed,
        &allowed,
    )
    .await);
    let mut snap = snapshot(a, &t);
    snap.operation_kind = OperationKind::AutomatedPermissionReview;
    snap.route_id = Some("claude-api-key".into());
    snap.model = Some(CLAUDE_MODEL.into());
    snap.api_version = Some(CLAUDE_API_VERSION.into());
    snap.route_revision = 1;
    snap.configuration_revision = 1;
    snap.settings_revision = 1;
    ok(s.begin_usage_attempt(snap.clone()).await);
    let event = |id: &str, sequence, n| UsageEvent {
        event_id: id.into(),
        sequence,
        kind: UsageEventKind::Cumulative,
        usage: Consumption {
            input_tokens: Some(n),
            cache_read_tokens: Some(2),
            ..Default::default()
        },
    };
    let newer = event("second", 2, 20);
    ok(
        s.record_usage_event(a.principal_id, t.task_id, &snap.attempt_id, newer.clone())
            .await,
    );
    ok(
        s.record_usage_event(a.principal_id, t.task_id, &snap.attempt_id, newer)
            .await,
    );
    ok(s.recover_usage_runtime("old-runtime").await);
    ok(s.record_usage_event(
        a.principal_id,
        t.task_id,
        &snap.attempt_id,
        event("first", 1, 10),
    )
    .await);
    let result = ok(task_usage(&s, a, &t.task_id.to_string()).await);
    assert_eq!(result.attempts[0].usage.input_tokens, Some(20));
    assert_eq!(result.attempts[0].events.len(), 2);
    assert_eq!(result.attempts[0].status, AttemptStatus::Uncertain);
    assert!(
        s.record_usage_event(
            a.principal_id,
            t.task_id,
            &snap.attempt_id,
            event("second", 2, 99)
        )
        .await
        .is_err()
    );
}

#[tokio::test]
async fn one_choice_selection_aligns_settings_for_next_native_dispatch() {
    let dir = ok(tempfile::tempdir());
    let s = ok(SqliteWorkingStore::open(&dir.path().join("work.db"), &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    configure(&s, a, &t).await;
    let allowed = vec!["default".into()];
    ok(set_task_usage_settings(
        &s,
        a,
        SetUsageSettings {
            operation_id: "before-choice".into(),
            task_id: t.task_id.to_string(),
            expected_revision: 0,
            route_revision: 1,
            choices: Choices::default(),
        },
        &allowed,
        &allowed,
    )
    .await);
    ok(set_task_route_with_usage(
        &s,
        &SystemClock,
        a,
        SetTaskRoute {
            operation_id: "one-choice".into(),
            expected_revision: Revision::new(1),
            task_id: t.task_id.to_string(),
            route_id: "claude-api-key".into(),
            configuration_revision: Revision::new(1),
        },
        Some(selection_caps()),
    )
    .await);
    let settings = ok(task_usage(&s, a, &t.task_id.to_string()).await)
        .settings
        .unwrap();
    let mut next = snapshot(a, &t);
    next.operation_kind = OperationKind::HumanRequestedModel;
    next.route_id = Some("claude-api-key".into());
    next.model = Some(CLAUDE_MODEL.into());
    next.api_version = Some(CLAUDE_API_VERSION.into());
    next.route_revision = 2;
    next.configuration_revision = 1;
    next.settings_revision = settings.revision;
    // The next-Send native accounting fence must admit the same preserved choices.
    // This performs no provider call and must not weaken that fence.
    ok(s.begin_usage_attempt(next).await);
    assert_eq!(settings.route_revision, 2);
    assert_eq!(settings.revision, 2);
    assert_eq!(settings.choices, Choices::default());
}

fn selection_caps() -> SelectionUsageCapabilities {
    SelectionUsageCapabilities {
        reasoning: vec!["default".into(), "high".into()],
        speeds: vec!["default".into()],
        defaults: Choices::default(),
    }
}
fn selection(t: &Task, id: &str, expected: u64) -> SetTaskRoute {
    SetTaskRoute {
        operation_id: id.into(),
        expected_revision: Revision::new(expected),
        task_id: t.task_id.to_string(),
        route_id: "claude-api-key".into(),
        configuration_revision: Revision::new(1),
    }
}
#[tokio::test]
async fn one_choice_is_atomic_replayable_private_and_task_scoped() {
    let dir = ok(tempfile::tempdir());
    let s = ok(SqliteWorkingStore::open(&dir.path().join("work.db"), &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    let other = task(&s, a).await;
    configure(&s, a, &t).await;
    ok(set_task_route(&s, &SystemClock, a, selection(&other, "other-route", 0)).await);
    let choices = Choices {
        reasoning: "high".into(),
        speed: "default".into(),
    };
    for (task, id) in [(&t, "settings-a"), (&other, "settings-b")] {
        ok(set_task_usage_settings(
            &s,
            a,
            SetUsageSettings {
                operation_id: id.into(),
                task_id: task.task_id.to_string(),
                expected_revision: 0,
                route_revision: 1,
                choices: choices.clone(),
            },
            &selection_caps().reasoning,
            &selection_caps().speeds,
        )
        .await);
    }
    let other_before = ok(task_usage(&s, a, &other.task_id.to_string()).await);
    let command = selection(&t, "same-pending-uuid", 1);
    let (x, y) = tokio::join!(
        set_task_route_with_usage(&s, &SystemClock, a, command.clone(), Some(selection_caps())),
        set_task_route_with_usage(&s, &SystemClock, a, command.clone(), Some(selection_caps()))
    );
    assert_eq!(ok(x).receipt, ok(y).receipt);
    let after = ok(task_usage(&s, a, &t.task_id.to_string()).await);
    let settings = after.settings.as_ref().unwrap();
    assert_eq!(settings.revision, 2);
    assert_eq!(settings.route_revision, 2);
    assert_eq!(settings.choices, choices);
    assert_eq!(
        ok(task_usage(&s, a, &other.task_id.to_string()).await),
        other_before
    );
    // Receipt replay does not apply settings twice, even if current discovery is absent.
    assert!(
        ok(set_task_route_with_usage(&s, &SystemClock, a, command.clone(), None).await).replayed
    );
    assert_eq!(ok(task_usage(&s, a, &t.task_id.to_string()).await), after);
    assert!(
        set_task_route_with_usage(&s, &SystemClock, actor(2), command, Some(selection_caps()))
            .await
            .is_err()
    );
    let before_route = ok(task_route(&s, a, &t.task_id.to_string()).await);
    let mut unsupported = selection_caps();
    unsupported.reasoning = vec!["default".into()];
    assert!(
        set_task_route_with_usage(
            &s,
            &SystemClock,
            a,
            selection(&t, "unsupported", 2),
            Some(unsupported)
        )
        .await
        .is_err()
    );
    assert!(
        set_task_route_with_usage(
            &s,
            &SystemClock,
            a,
            selection(&t, "stale-cas", 1),
            Some(selection_caps())
        )
        .await
        .is_err()
    );
    assert_eq!(
        ok(task_route(&s, a, &t.task_id.to_string()).await),
        before_route
    );
    assert_eq!(ok(task_usage(&s, a, &t.task_id.to_string()).await), after);
    assert!(
        ok(
            s.find_route_receipt(&inquello_domain::OperationId::parse("unsupported").unwrap())
                .await
        )
        .is_none()
    );
    assert!(
        ok(
            s.find_route_receipt(&inquello_domain::OperationId::parse("stale-cas").unwrap())
                .await
        )
        .is_none()
    );
}
#[tokio::test]
async fn one_choice_initializes_only_unstarted_defaults_and_refuses_stale_settings() {
    let dir = ok(tempfile::tempdir());
    let s = ok(SqliteWorkingStore::open(&dir.path().join("work.db"), &[]).await);
    let a = actor(1);
    let t = task(&s, a).await;
    configure(&s, a, &t).await;
    ok(set_task_route_with_usage(
        &s,
        &SystemClock,
        a,
        selection(&t, "initial-defaults", 1),
        Some(selection_caps()),
    )
    .await);
    let initialized = ok(task_usage(&s, a, &t.task_id.to_string()).await)
        .settings
        .unwrap();
    assert_eq!(
        initialized,
        TaskUsageSettings {
            revision: 1,
            route_revision: 2,
            choices: Choices::default()
        }
    );
    // Legacy explicit selection can leave stale settings; do not silently heal them.
    ok(set_task_route(&s, &SystemClock, a, selection(&t, "legacy-selection", 2)).await);
    assert!(
        set_task_route_with_usage(
            &s,
            &SystemClock,
            a,
            selection(&t, "stale-settings", 3),
            Some(selection_caps())
        )
        .await
        .is_err()
    );
    assert_eq!(
        ok(task_usage(&s, a, &t.task_id.to_string()).await)
            .settings
            .unwrap(),
        initialized
    );
    assert_eq!(
        ok(task_route(&s, a, &t.task_id.to_string()).await).revision,
        Revision::new(3)
    );
}

#[tokio::test]
async fn one_choice_retained_missing_pending_and_failed_commit_have_no_partial_effect() {
    let dir = ok(tempfile::tempdir());
    let path = dir.path().join("work.db");
    let s = ok(SqliteWorkingStore::open(&path, &[]).await);
    let db = fixture_pool(&path).await;
    let a = actor(1);
    let t = task(&s, a).await;
    configure(&s, a, &t).await;
    // Owned historical storage fixture, not a fabricated runtime authorization.
    let run = serde_json::json!({"run_id":"retained","status":"completed",
        "choices":{"reasoning":"default","speed":"default"}});
    ok(sqlx::query("INSERT INTO task_runs(principal_id,operation_id,task_id,runtime_id,thread_id,record) VALUES(?,?,?,?,NULL,?)")
        .bind(a.principal_id.to_string()).bind("historical").bind(t.task_id.to_string())
        .bind("historical-runtime").bind(run.to_string()).execute(&db).await);
    let before = ok(task_route(&s, a, &t.task_id.to_string()).await);
    assert!(
        set_task_route_with_usage(
            &s,
            &SystemClock,
            a,
            selection(&t, "missing", 1),
            Some(selection_caps())
        )
        .await
        .is_err()
    );
    assert!(
        ok(task_usage(&s, a, &t.task_id.to_string()).await)
            .settings
            .is_none()
    );
    assert_eq!(ok(task_route(&s, a, &t.task_id.to_string()).await), before);
    let caps = selection_caps();
    ok(set_task_usage_settings(
        &s,
        a,
        SetUsageSettings {
            operation_id: "initialize-historical-fixture".into(),
            task_id: t.task_id.to_string(),
            expected_revision: 0,
            route_revision: 1,
            choices: Choices::default(),
        },
        &caps.reasoning,
        &caps.speeds,
    )
    .await);
    let settings = ok(task_usage(&s, a, &t.task_id.to_string()).await);
    ok(sqlx::query("INSERT INTO task_lifecycle VALUES(?,?,?,?,?)")
        .bind(a.principal_id.to_string())
        .bind("pending-command")
        .bind(t.task_id.to_string())
        .bind("{}")
        .bind(r#"{"status":"uncertain"}"#)
        .execute(&db)
        .await);
    assert!(
        set_task_route_with_usage(
            &s,
            &SystemClock,
            a,
            selection(&t, "pending", 1),
            Some(selection_caps())
        )
        .await
        .is_err()
    );
    assert_eq!(
        ok(task_usage(&s, a, &t.task_id.to_string()).await),
        settings
    );
    // Test-owned fixture cleanup only, before a forced final receipt insert failure.
    ok(
        sqlx::query("DELETE FROM task_lifecycle WHERE operation_id='pending-command'")
            .execute(&db)
            .await,
    );
    ok(sqlx::query("CREATE TRIGGER fixture_fail_selection BEFORE INSERT ON processing_route_receipts WHEN NEW.operation_id='rollback-choice' BEGIN SELECT RAISE(ABORT,'fixture receipt failure'); END").execute(&db).await);
    assert!(
        set_task_route_with_usage(
            &s,
            &SystemClock,
            a,
            selection(&t, "rollback-choice", 1),
            Some(selection_caps())
        )
        .await
        .is_err()
    );
    assert_eq!(
        ok(task_usage(&s, a, &t.task_id.to_string()).await),
        settings
    );
    assert_eq!(ok(task_route(&s, a, &t.task_id.to_string()).await), before);
    for id in ["missing", "pending", "rollback-choice"] {
        assert!(
            ok(
                s.find_route_receipt(&inquello_domain::OperationId::parse(id).unwrap())
                    .await
            )
            .is_none()
        );
    }
}
