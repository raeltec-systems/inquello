//! Story 1.22 persistence/privacy/race tests. These do not prove live inference.
use inquello_adapters::{SqliteWorkingStore, SystemClock};
use inquello_domain::organise::{
    Actor, CreateTask, OrganiseRecord, OrganiseStore, PrincipalId, Task, create_task,
};
use inquello_domain::routes::*;
use inquello_domain::{DomainError, Revision};
use tempfile::TempDir;
use uuid::Uuid;

#[tokio::test]
#[expect(
    clippy::disallowed_methods,
    reason = "isolated legacy-schema migration fixture"
)]
async fn migration_preserves_legacy_bytes_receipts_foreign_keys_and_requires_exact_revalidation() {
    use sqlx::{Connection, Row};
    let dir = ok(TempDir::new());
    let path = dir.path().join("working.sqlite");
    let mut db =
        ok(sqlx::SqliteConnection::connect(&format!("sqlite:{}?mode=rwc", path.display())).await);
    // Build the exact historical schema, without opening/migrating a user profile.
    for sql in [
        include_str!("../migrations/0001_store_info_and_receipts.sql"),
        include_str!("../migrations/0002_engagements_folders_tasks.sql"),
        include_str!("../migrations/0003_task_states.sql"),
        include_str!("../migrations/0004_task_broad_modes.sql"),
        include_str!("../migrations/0005_command_rules_and_permissions.sql"),
        include_str!("../migrations/0006_processing_routes.sql"),
        include_str!("../migrations/0007_automated_permission_review.sql"),
        include_str!("../migrations/0008_task_usage.sql"),
        include_str!("../migrations/0009_task_runs.sql"),
        include_str!("../migrations/0010_task_data_provenance.sql"),
        include_str!("../migrations/0011_task_metadata_provenance.sql"),
        include_str!("../migrations/0012_task_lifecycle.sql"),
        include_str!("../migrations/0013_task_runtime_leases.sql"),
        include_str!("../migrations/0014_task_navigation.sql"),
        include_str!("../migrations/0015_local_tool_metadata_provenance.sql"),
    ] {
        ok(sqlx::raw_sql(sql).execute(&mut db).await);
    }
    let principal = actor(1).principal_id.to_string();
    let task_id = Uuid::new_v4().to_string();
    ok(sqlx::query("INSERT INTO tasks(task_id,workspace_id,creator_principal_id,engagement_id,folder_id,title,source_refs,artifact_refs,visibility,revision,created_at_ms,updated_at_ms) VALUES(?, ?, ?, NULL,NULL,'Fictional legacy task','[]','[]','private',1,17,17)")
        .bind(&task_id).bind("5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e").bind(&principal).execute(&mut db).await);
    let original = format!(
        " {} ",
        serde_json::to_string(&configuration(RouteId::CodexResponses)).unwrap()
    );
    for revision in [1i64, 2] {
        ok(sqlx::query(
            "INSERT INTO processing_route_candidates VALUES(?,'codex-responses',?,?,17)",
        )
        .bind(&principal)
        .bind(revision)
        .bind(&original)
        .execute(&mut db)
        .await);
    }
    ok(
        sqlx::query("INSERT INTO task_processing_routes VALUES(?,1,?,'codex-responses',1,19)")
            .bind(&task_id)
            .bind(&principal)
            .execute(&mut db)
            .await,
    );
    let request = " { \"legacy\" : true } ";
    ok(sqlx::query("INSERT INTO processing_route_receipts VALUES('legacy-op',?,'set_task_route',?,0,1,?,'applied',23)").bind(&principal).bind(&task_id).bind(request).execute(&mut db).await);
    let before = ok(sqlx::query("SELECT * FROM processing_route_receipts")
        .fetch_one(&mut db)
        .await);
    let mut tx = ok(db.begin().await);
    ok(
        sqlx::raw_sql(include_str!("../migrations/0016_model_bindings.sql"))
            .execute(&mut *tx)
            .await,
    );
    ok(tx.commit().await);
    let after = ok(sqlx::query("SELECT * FROM processing_route_receipts")
        .fetch_one(&mut db)
        .await);
    for key in [
        "operation_id",
        "principal_id",
        "command",
        "scope_id",
        "request",
        "status",
    ] {
        assert_eq!(before.get::<String, _>(key), after.get::<String, _>(key));
    }
    for key in ["expected_revision", "resulting_revision", "recorded_at_ms"] {
        assert_eq!(before.get::<i64, _>(key), after.get::<i64, _>(key));
    }
    let configurations = ok(sqlx::query_scalar::<_, String>(
        "SELECT configuration FROM processing_route_candidates ORDER BY revision",
    )
    .fetch_all(&mut db)
    .await);
    assert_eq!(configurations, vec![original.clone(), original]);
    let states = ok(sqlx::query_scalar::<_, String>(
        "SELECT state FROM processing_model_bindings ORDER BY configuration_revision",
    )
    .fetch_all(&mut db)
    .await);
    assert_eq!(states, ["legacy-superseded", "active"]);
    assert!(
        ok(sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&mut db)
            .await)
        .is_empty()
    );
    assert_eq!(
        ok(sqlx::query_scalar::<_, i64>(
            "SELECT configuration_revision FROM task_processing_routes"
        )
        .fetch_one(&mut db)
        .await),
        1
    );
}

#[tokio::test]
async fn same_provider_old_binding_can_start_after_b_and_pending_switch_is_denied() {
    use inquello_domain::tasks::{
        NativeTaskDataTier, StartTaskIntent, TaskLifecycleIntent, TaskLifecycleKind,
        TaskLifecycleStore, TaskRunStatus, TaskRunStore,
    };
    use inquello_domain::usage::{Choices, SetUsageSettings, UsageStore, set_task_usage_settings};
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let version = "a".repeat(64);
    let choice_a = "b".repeat(64);
    let choice_b = "c".repeat(64);
    let mut a = configure("resolve-a", 0, RouteId::CodexResponses);
    a.configuration.model = "gpt-6.1-terra".into();
    let resolved =
        ok(
            resolve_model_binding(&store, &SystemClock, owner, a.clone(), &version, &choice_a)
                .await,
        );
    assert_eq!(resolved.receipt.command, RESOLVE_MODEL_BINDING_COMMAND);
    assert!(
        ok(
            resolve_model_binding(&store, &SystemClock, owner, a.clone(), &version, &choice_a)
                .await
        )
        .replayed
    );
    assert!(matches!(
        resolve_model_binding(&store, &SystemClock, owner, a.clone(), &version, &choice_b).await,
        Err(DomainError::OperationConflict { .. })
    ));
    assert!(matches!(
        configure_route(&store, &SystemClock, owner, a).await,
        Err(DomainError::OperationConflict { .. })
    ));
    let mut b = configure("resolve-b", 1, RouteId::CodexResponses);
    b.configuration.model = "gpt-6.1-sol".into();
    ok(resolve_model_binding(&store, &SystemClock, owner, b, &version, &choice_b).await);
    let run = ok(store
        .reserve_task_run(
            owner.principal_id,
            StartTaskIntent {
                operation_id: "start-a-after-b".into(),
                workspace_id: "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),
                engagement_id: None,
                folder_id: None,
                request: "Fictional A request".into(),
                route_id: "codex-responses".into(),
                configuration_revision: 1,
                choices: Choices::default(),
            },
            "fixture-runtime",
            1,
            NativeTaskDataTier::Synthetic,
        )
        .await);
    let task = ok(store
        .load_task(ok(inquello_domain::organise::TaskId::parse(&run.task_id)))
        .await)
    .unwrap();
    assert_eq!(
        ok(task_route(&store, owner, &run.task_id).await)
            .current
            .unwrap()
            .configuration
            .model(),
        "gpt-6.1-terra"
    );
    assert!(
        set_task_route(
            &store,
            &SystemClock,
            owner,
            select("pending-switch", 1, &task, RouteId::CodexResponses, 2)
        )
        .await
        .is_err()
    );
    assert!(
        ok(store
            .find_route_receipt(&ok(inquello_domain::OperationId::parse("pending-switch")))
            .await)
        .is_none()
    );
    ok(store
        .bind_task_thread(
            owner.principal_id,
            &run.operation_id,
            "fixture-runtime",
            "fixture-thread",
        )
        .await);
    ok(store
        .claim_task_dispatch(owner.principal_id, &run.operation_id, "fixture-runtime")
        .await);
    ok(store
        .mark_task_run(
            owner.principal_id,
            &run.operation_id,
            TaskRunStatus::Completed,
            Some("fixture-turn"),
        )
        .await);
    let executed = ok(store
        .find_task_run(owner.principal_id, &run.operation_id)
        .await)
    .unwrap();
    let switched = ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("explicit-switch", 1, &task, RouteId::CodexResponses, 2),
    )
    .await);
    assert_eq!(switched.record.revision, Revision::new(2));
    let current = ok(store
        .find_task_run(owner.principal_id, &run.operation_id)
        .await)
    .unwrap();
    assert_eq!(current.configuration_revision, 2);
    let settings = ok(set_task_usage_settings(
        &store,
        owner,
        SetUsageSettings {
            operation_id: "confirm-compatible-settings".into(),
            task_id: run.task_id.clone(),
            expected_revision: 1,
            route_revision: 2,
            choices: Choices::default(),
        },
        &["default".into()],
        &["default".into()],
    )
    .await);
    assert_eq!(settings.revision, 2);
    assert_eq!(settings.route_revision, 2);
    assert_eq!(
        ok(store.read_usage(owner.principal_id, task.task_id).await).settings,
        Some(settings)
    );
    let selected = ok(store
        .find_task_run(owner.principal_id, &run.operation_id)
        .await)
    .unwrap();
    let intent = TaskLifecycleIntent {
        operation_id: "resume-switched".into(),
        kind: TaskLifecycleKind::Resume,
        guidance: Some("Fictional completed-run follow-up".into()),
        expected: selected,
        runtime_id: "continued-runtime".into(),
    };
    ok(store
        .reserve_task_lifecycle_fenced(owner.principal_id, intent, |_| async { Ok(()) })
        .await);
    let continued = ok(store
        .claim_task_lifecycle_fenced(owner.principal_id, "resume-switched", |_| async { Ok(()) })
        .await);
    assert_eq!(continued.binding.configuration_revision, 2);
    assert_ne!(continued.binding.run_id, executed.run_id);
    assert_eq!(continued.binding.thread_id, executed.thread_id);
    let history = ok(store
        .prior_task_runs(owner.principal_id, &run.task_id)
        .await);
    assert_eq!(
        history.iter().find(|b| b.run_id == executed.run_id),
        Some(&executed)
    );
    ok(store
        .mark_task_run(
            owner.principal_id,
            &run.operation_id,
            TaskRunStatus::Completed,
            Some("continued-turn"),
        )
        .await);
    let executed_settings = ok(store
        .find_task_run(owner.principal_id, &run.operation_id)
        .await)
    .unwrap();
    let high = Choices {
        reasoning: "high".into(),
        speed: "default".into(),
    };
    ok(set_task_usage_settings(
        &store,
        owner,
        SetUsageSettings {
            operation_id: "future-settings-only".into(),
            task_id: run.task_id.clone(),
            expected_revision: 2,
            route_revision: 2,
            choices: high.clone(),
        },
        &["default".into(), "high".into()],
        &["default".into()],
    )
    .await);
    let staged = ok(store
        .find_task_run(owner.principal_id, &run.operation_id)
        .await)
    .unwrap();
    assert_eq!(staged.choices, high);
    let history = ok(store
        .prior_task_runs(owner.principal_id, &run.task_id)
        .await);
    assert_eq!(
        history
            .iter()
            .find(|b| b.run_id == executed_settings.run_id),
        Some(&executed_settings)
    );
    ok(store
        .reserve_task_lifecycle_fenced(
            owner.principal_id,
            TaskLifecycleIntent {
                operation_id: "resume-new-settings".into(),
                kind: TaskLifecycleKind::Resume,
                guidance: Some("Fictional completed-run follow-up".into()),
                expected: staged,
                runtime_id: "third-runtime".into(),
            },
            |_| async { Ok(()) },
        )
        .await);
    let next = ok(store
        .claim_task_lifecycle_fenced(owner.principal_id, "resume-new-settings", |_| async {
            Ok(())
        })
        .await);
    assert_eq!(next.binding.choices, high);
    assert_eq!(next.binding.thread_id, executed.thread_id);
    assert_eq!(
        ok(store
            .prior_task_runs(owner.principal_id, &run.task_id)
            .await),
        history
    );
    assert_eq!(
        ok(store
            .tasks_for_model_binding(
                owner.principal_id,
                RouteId::CodexResponses,
                Revision::new(1)
            )
            .await),
        vec![task.task_id]
    );
    let refs = ok(store
        .task_model_disclosure_bindings(owner.principal_id, task.task_id)
        .await);
    assert_eq!(
        refs,
        vec![
            (RouteId::CodexResponses, Revision::new(1), true),
            (RouteId::CodexResponses, Revision::new(2), true)
        ]
    );
    assert!(
        ok(store
            .task_model_disclosure_bindings(actor(2).principal_id, task.task_id)
            .await)
        .is_empty()
    );
    let binding = ok(store.list_model_bindings(owner.principal_id).await)
        .into_iter()
        .find(|b| b.candidate.revision == Revision::new(1))
        .unwrap();
    ok(change_model_binding_state(
        &store,
        &SystemClock,
        owner,
        "revoke-executed-history",
        &binding.binding_id,
        Revision::new(1),
        ModelBindingState::Revoked,
    )
    .await);
    assert!(
        !ok(store
            .task_model_disclosure_bindings(owner.principal_id, task.task_id)
            .await)[0]
            .2
    );
}

#[tokio::test]
#[expect(
    clippy::disallowed_methods,
    reason = "isolated legacy binding-state fixture only"
)]
async fn deliberate_legacy_revalidation_keeps_the_same_exact_configuration_without_credential_grants()
 {
    use sqlx::Connection;
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let task = task(&store, owner).await;
    ok(configure_route(
        &store,
        &SystemClock,
        owner,
        configure("legacy-a", 0, RouteId::CodexResponses),
    )
    .await);
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("legacy-select", 0, &task, RouteId::CodexResponses, 1),
    )
    .await);
    let original = ok(task_route(&store, owner, &task.task_id.to_string()).await)
        .current
        .unwrap();
    let binding = ok(store
        .load_configuration_binding(
            owner.principal_id,
            RouteId::CodexResponses,
            Revision::new(1),
        )
        .await)
    .unwrap();
    let mut fixture = ok(sqlx::SqliteConnection::connect(&format!(
        "sqlite:{}",
        dir.path().join("working.sqlite").display()
    ))
    .await);
    ok(sqlx::query(
        "UPDATE processing_model_bindings SET state='legacy-superseded' WHERE binding_id=?",
    )
    .bind(&binding.binding_id)
    .execute(&mut fixture)
    .await);
    assert!(ok(task_route(&store, owner, &task.task_id.to_string()).await).stale_configuration);
    assert!(
        set_task_route(
            &store,
            &SystemClock,
            owner,
            select(
                "no-implicit-revalidation",
                1,
                &task,
                RouteId::CodexResponses,
                1
            )
        )
        .await
        .is_err()
    );
    let validated = ok(change_model_binding_state(
        &store,
        &SystemClock,
        owner,
        "explicit-exact-revalidation",
        &binding.binding_id,
        Revision::new(1),
        ModelBindingState::Active,
    )
    .await);
    assert_eq!(
        validated.binding.candidate.configuration,
        original.configuration
    );
    let selected = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert_eq!(selected.current, Some(original));
    assert!(!selected.stale_configuration);
    assert!(
        !selected
            .eligibility(false, true, DataTier::Synthetic)
            .enabled
    );
}

fn ok<T, E: std::fmt::Debug>(value: Result<T, E>) -> T {
    value.unwrap_or_else(|error| panic!("unexpected error: {error:?}"))
}
fn actor(n: u8) -> Actor {
    Actor {
        principal_id: PrincipalId::from_uuid(Uuid::from_bytes([n; 16])),
    }
}
async fn open(dir: &TempDir) -> SqliteWorkingStore {
    ok(SqliteWorkingStore::open(&dir.path().join("working.sqlite"), &[]).await)
}
async fn task(store: &SqliteWorkingStore, actor: Actor) -> Task {
    let outcome = ok(create_task(
        store,
        &SystemClock,
        actor,
        CreateTask {
            operation_id: format!("task-{}", Uuid::new_v4()),
            expected_revision: Revision::ZERO,
            workspace_id: "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),
            engagement_id: None,
            folder_id: None,
            title: "Private route task".into(),
        },
    )
    .await);
    match outcome.record {
        OrganiseRecord::Task(task) => task,
        other => panic!("not a Task: {other:?}"),
    }
}
fn configuration(route_id: RouteId) -> RouteConfigurationInput {
    match route_id {
        RouteId::ClaudeApiKey => RouteConfigurationInput {
            route_id: route_id.as_str().into(),
            deployment: "anthropic-direct".into(),
            model: CLAUDE_MODEL.into(),
            api_version: CLAUDE_API_VERSION.into(),
            account_ref: "11111111-1111-4111-8111-111111111111".into(),
            region: None,
        },
        RouteId::CodexResponses => RouteConfigurationInput {
            route_id: route_id.as_str().into(),
            deployment: "openai-api".into(),
            model: "fixture-model-20261030".into(),
            api_version: "responses-v1".into(),
            account_ref: "22222222-2222-4222-8222-222222222222".into(),
            region: None,
        },
    }
}
fn configure(id: &str, revision: u64, route_id: RouteId) -> ConfigureRoute {
    ConfigureRoute {
        operation_id: id.into(),
        expected_revision: Revision::new(revision),
        configuration: configuration(route_id),
    }
}
fn select(
    id: &str,
    revision: u64,
    task: &Task,
    route_id: RouteId,
    configuration_revision: u64,
) -> SetTaskRoute {
    SetTaskRoute {
        operation_id: id.into(),
        expected_revision: Revision::new(revision),
        task_id: task.task_id.to_string(),
        route_id: route_id.as_str().into(),
        configuration_revision: Revision::new(configuration_revision),
    }
}

#[tokio::test]
async fn explicit_selection_reopens_without_changing_task_organisation_revision() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let task = task(&store, owner).await;
    let before = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert_eq!(before.revision, Revision::ZERO);
    assert_eq!(before.current, None);
    assert!(
        set_task_route(
            &store,
            &SystemClock,
            owner,
            select("missing", 0, &task, RouteId::ClaudeApiKey, 0)
        )
        .await
        .is_err()
    );
    for id in RouteId::ALL {
        ok(configure_route(&store, &SystemClock, owner, configure(id.as_str(), 0, id)).await);
    }
    let first = ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("select-claude", 0, &task, RouteId::ClaudeApiKey, 1),
    )
    .await);
    assert_eq!(first.record.configuration.endpoint(), CLAUDE_ENDPOINT);
    assert_eq!(first.record.configuration.region(), None);
    let second = ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("select-codex", 1, &task, RouteId::CodexResponses, 1),
    )
    .await);
    assert_eq!(second.record.revision, Revision::new(2));
    store.close().await;
    let reopened = open(&dir).await;
    let selected = ok(task_route(&reopened, owner, &task.task_id.to_string()).await);
    assert_eq!(selected.current, Some(second.record));
    assert!(!selected.stale_configuration);
    // Organisation is never written by either route command.
    let task_row =
        ok(reopened.load_task(task.task_id).await).unwrap_or_else(|| panic!("Task missing"));
    assert_eq!(task_row.revision, task.revision);
}

#[tokio::test]
async fn other_principal_is_unknown_even_with_real_operation_id() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let other = actor(2);
    let task = task(&store, owner).await;
    ok(configure_route(
        &store,
        &SystemClock,
        owner,
        configure("candidate", 0, RouteId::ClaudeApiKey),
    )
    .await);
    let command = select("selection", 0, &task, RouteId::ClaudeApiKey, 1);
    ok(set_task_route(&store, &SystemClock, owner, command.clone()).await);
    assert_eq!(
        task_route(&store, other, &task.task_id.to_string()).await,
        Err(DomainError::NotFound)
    );
    assert_eq!(
        set_task_route(&store, &SystemClock, other, command).await,
        Err(DomainError::NotFound)
    );
    assert!(ok(candidate_routes(&store, other).await).is_empty());
}

#[tokio::test]
async fn creating_binding_b_preserves_a_and_explicit_switch_increments_selection() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let task = task(&store, owner).await;
    ok(configure_route(
        &store,
        &SystemClock,
        owner,
        configure("candidate", 0, RouteId::ClaudeApiKey),
    )
    .await);
    let selected = ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("selection", 0, &task, RouteId::ClaudeApiKey, 1),
    )
    .await);
    let mut replacement = configure("replace", 1, RouteId::ClaudeApiKey);
    replacement.configuration.account_ref = "33333333-3333-4333-8333-333333333333".into();
    ok(configure_route(&store, &SystemClock, owner, replacement).await);
    let stale = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert!(!stale.stale_configuration);
    assert_eq!(stale.current, Some(selected.record));
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("stale", 1, &task, RouteId::ClaudeApiKey, 1),
    )
    .await);
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("reselect", 2, &task, RouteId::ClaudeApiKey, 2),
    )
    .await);
    assert!(!ok(task_route(&store, owner, &task.task_id.to_string()).await).stale_configuration);
}

#[tokio::test]
async fn binding_revoke_is_scoped_cas_owned_and_receipted_across_commands() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let a = task(&store, owner).await;
    let b = task(&store, owner).await;
    ok(configure_route(
        &store,
        &SystemClock,
        owner,
        configure("model-a", 0, RouteId::CodexResponses),
    )
    .await);
    let mut model_b = configure("model-b", 1, RouteId::CodexResponses);
    model_b.configuration.model = "fixture-second-model".into();
    ok(configure_route(&store, &SystemClock, owner, model_b).await);
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("a-choice", 0, &a, RouteId::CodexResponses, 1),
    )
    .await);
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("b-choice", 0, &b, RouteId::CodexResponses, 2),
    )
    .await);
    let binding = ok(store
        .load_configuration_binding(
            owner.principal_id,
            RouteId::CodexResponses,
            Revision::new(1),
        )
        .await)
    .unwrap();
    assert_eq!(
        change_model_binding_state(
            &store,
            &SystemClock,
            actor(2),
            "revoke",
            &binding.binding_id,
            Revision::new(1),
            ModelBindingState::Revoked
        )
        .await,
        Err(DomainError::NotFound)
    );
    assert!(matches!(
        change_model_binding_state(
            &store,
            &SystemClock,
            owner,
            "revoke",
            &binding.binding_id,
            Revision::ZERO,
            ModelBindingState::Revoked
        )
        .await,
        Err(DomainError::RevisionConflict { .. })
    ));
    let result = ok(change_model_binding_state(
        &store,
        &SystemClock,
        owner,
        "revoke",
        &binding.binding_id,
        Revision::new(1),
        ModelBindingState::Revoked,
    )
    .await);
    assert_eq!(result.binding.revision, Revision::new(2));
    assert!(
        ok(change_model_binding_state(
            &store,
            &SystemClock,
            owner,
            "revoke",
            &binding.binding_id,
            Revision::new(1),
            ModelBindingState::Revoked
        )
        .await)
        .replayed
    );
    assert!(ok(task_route(&store, owner, &a.task_id.to_string()).await).stale_configuration);
    assert!(!ok(task_route(&store, owner, &b.task_id.to_string()).await).stale_configuration);
    assert!(
        set_task_route(
            &store,
            &SystemClock,
            owner,
            select("revoked-select", 1, &a, RouteId::CodexResponses, 1)
        )
        .await
        .is_err()
    );
    assert!(
        change_model_binding_state(
            &store,
            &SystemClock,
            owner,
            "reactivate",
            &binding.binding_id,
            Revision::new(2),
            ModelBindingState::Active
        )
        .await
        .is_err()
    );
    assert!(matches!(
        configure_route(
            &store,
            &SystemClock,
            owner,
            configure("revoke", 2, RouteId::CodexResponses)
        )
        .await,
        Err(DomainError::OperationConflict { .. })
    ));
    assert!(matches!(
        change_model_binding_state(
            &store,
            &SystemClock,
            owner,
            "model-b",
            &binding.binding_id,
            Revision::new(2),
            ModelBindingState::Revoked
        )
        .await,
        Err(DomainError::OperationConflict { .. })
    ));
}

#[tokio::test]
async fn same_operation_is_replayed_once_and_different_payload_is_refused() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let task = task(&store, owner).await;
    let config = configure("candidate", 0, RouteId::ClaudeApiKey);
    let first = ok(configure_route(&store, &SystemClock, owner, config.clone()).await);
    let replay = ok(configure_route(&store, &SystemClock, owner, config.clone()).await);
    assert!(replay.replayed);
    assert_eq!(first.record, replay.record);
    let mut changed = config;
    changed.configuration.account_ref = "33333333-3333-4333-8333-333333333333".into();
    assert!(matches!(
        configure_route(&store, &SystemClock, owner, changed).await,
        Err(DomainError::OperationConflict { .. })
    ));
    let selection = select("selection", 0, &task, RouteId::ClaudeApiKey, 1);
    let (left, right) = tokio::join!(
        set_task_route(&store, &SystemClock, owner, selection.clone()),
        set_task_route(&store, &SystemClock, owner, selection.clone()),
    );
    let left = ok(left);
    let right = ok(right);
    assert_eq!(left.record, right.record);
    assert_ne!(left.replayed, right.replayed);
    assert_eq!(
        ok(task_route(&store, owner, &task.task_id.to_string()).await).revision,
        Revision::new(1)
    );
    let mut different = selection;
    different.expected_revision = Revision::new(1);
    assert!(matches!(
        set_task_route(&store, &SystemClock, owner, different).await,
        Err(DomainError::OperationConflict { .. })
    ));
}

#[tokio::test]
async fn competing_selections_have_one_atomic_winner_and_receipt() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let task = task(&store, owner).await;
    for id in RouteId::ALL {
        ok(configure_route(&store, &SystemClock, owner, configure(id.as_str(), 0, id)).await);
    }
    let (left, right) = tokio::join!(
        set_task_route(
            &store,
            &SystemClock,
            owner,
            select("left", 0, &task, RouteId::ClaudeApiKey, 1)
        ),
        set_task_route(
            &store,
            &SystemClock,
            owner,
            select("right", 0, &task, RouteId::CodexResponses, 1)
        ),
    );
    assert_ne!(left.is_ok(), right.is_ok());
    let error = if let Err(error) = left {
        error
    } else {
        right
            .err()
            .unwrap_or_else(|| panic!("one conflict required"))
    };
    assert!(matches!(error, DomainError::RevisionConflict { .. }));
    let selection = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert_eq!(selection.revision, Revision::new(1));
    let winner = selection
        .current
        .unwrap_or_else(|| panic!("selection missing"));
    assert!(
        !route_eligibility(Some(&winner.configuration), true, true, DataTier::Synthetic).enabled
    );
}

#[tokio::test]
async fn rejected_config_does_not_record_receipt_or_change_selection() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let mut command = configure("invalid", 0, RouteId::ClaudeApiKey);
    command.configuration.account_ref = "sk-ant-secret-sentinel".into();
    assert!(
        configure_route(&store, &SystemClock, owner, command)
            .await
            .is_err()
    );
    assert!(ok(candidate_routes(&store, owner).await).is_empty());
    assert!(
        ok(store
            .find_candidate_route_receipt(&ok(inquello_domain::OperationId::parse("invalid")))
            .await)
        .is_none()
    );
}

#[tokio::test]
async fn candidate_configuration_race_and_failed_commit_are_atomic() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let command = configure("configure-once", 0, RouteId::ClaudeApiKey);
    let (left, right) = tokio::join!(
        configure_route(&store, &SystemClock, owner, command.clone()),
        configure_route(&store, &SystemClock, owner, command),
    );
    let left = ok(left);
    let right = ok(right);
    assert_eq!(left.record, right.record);
    assert_ne!(left.replayed, right.replayed);
    let invalid = CandidateRouteChange {
        expected_revision: Revision::new(1),
        record: left.record.clone(),
        receipt: left.receipt.clone(),
    };
    assert!(store.commit_candidate_route(invalid).await.is_err());
    let current = ok(candidate_routes(&store, owner).await);
    assert_eq!(current, vec![left.record]);
}

#[tokio::test]
async fn selecting_one_task_leaves_other_task_route_and_revision_unchanged() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let first = task(&store, owner).await;
    let second = task(&store, owner).await;
    for id in RouteId::ALL {
        ok(configure_route(&store, &SystemClock, owner, configure(id.as_str(), 0, id)).await);
    }
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("first-initial", 0, &first, RouteId::ClaudeApiKey, 1),
    )
    .await);
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("second-initial", 0, &second, RouteId::ClaudeApiKey, 1),
    )
    .await);
    let second_before = ok(task_route(&store, owner, &second.task_id.to_string()).await);
    ok(set_task_route(
        &store,
        &SystemClock,
        owner,
        select("first-switch", 1, &first, RouteId::CodexResponses, 1),
    )
    .await);
    assert_eq!(
        ok(task_route(&store, owner, &second.task_id.to_string()).await),
        second_before
    );
    assert_eq!(
        ok(task_route(&store, owner, &first.task_id.to_string()).await).revision,
        Revision::new(2)
    );
    assert_eq!(
        ok(store
            .tasks_for_model_binding(owner.principal_id, RouteId::ClaudeApiKey, Revision::new(1))
            .await),
        vec![second.task_id],
        "a never-executed old selection is not a retained disclosure dependency"
    );
    assert_eq!(
        ok(store
            .task_model_disclosure_bindings(owner.principal_id, first.task_id)
            .await),
        vec![(RouteId::CodexResponses, Revision::new(1), true)]
    );
}

#[tokio::test]
async fn stale_configuration_draft_cannot_overwrite_a_newer_window() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    ok(configure_route(
        &store,
        &SystemClock,
        owner,
        configure("initial", 0, RouteId::ClaudeApiKey),
    )
    .await);
    let stale_draft = configure("stale-draft", 1, RouteId::ClaudeApiKey);
    let mut newer = configure("other-window", 1, RouteId::ClaudeApiKey);
    newer.configuration.account_ref = "33333333-3333-4333-8333-333333333333".into();
    let current = ok(configure_route(&store, &SystemClock, owner, newer).await);
    assert!(
        matches!(configure_route(&store, &SystemClock, owner, stale_draft).await,
        Err(DomainError::RevisionConflict { expected, actual })
        if expected == Revision::new(1) && actual == Revision::new(2))
    );
    assert_eq!(
        ok(candidate_routes(&store, owner).await),
        vec![current.record]
    );
    assert!(
        ok(store
            .find_candidate_route_receipt(&ok(inquello_domain::OperationId::parse("stale-draft")))
            .await)
        .is_none()
    );
}
