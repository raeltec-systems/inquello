use super::*;
use pretty_assertions::assert_eq;
use serde_json::json;
use std::collections::BTreeSet;
use uuid::Uuid;

fn policy_json() -> serde_json::Value {
    json!({
        "policy_version": 1,
        "roles": [
            {
                "id": "audit_lead",
                "kind": "audit_team",
                "label": "Audit lead",
                "actions": ["read", "comment", "manage_membership"]
            },
            {
                "id": "auditor",
                "kind": "audit_team",
                "label": "Auditor",
                "actions": ["read", "derive", "comment"]
            },
            {
                "id": "reviewer",
                "kind": "reviewer",
                "label": "Reviewer",
                "actions": ["read", "submit_review", "issue_notes"]
            }
        ]
    })
}

fn policy() -> WorkspacePolicy {
    WorkspacePolicy::from_value(&policy_json()).expect("valid policy")
}

fn with_role(mutate: impl FnOnce(&mut serde_json::Value)) -> Result<WorkspacePolicy, PolicyError> {
    let mut value = policy_json();
    mutate(&mut value);
    WorkspacePolicy::from_value(&value)
}

// ---- policy validation ----------------------------------------------------

#[test]
fn a_valid_policy_parses_and_round_trips_canonically() {
    let policy = policy();
    assert_eq!(policy.roles().len(), 3);
    let lead = policy.role("audit_lead").expect("role");
    assert_eq!(lead.kind, RoleKind::AuditTeam);
    assert!(lead.permits(Action::ManageMembership));
    assert_eq!(
        policy.administrator_roles(),
        vec![RoleId::parse("audit_lead").expect("id")]
    );
    let again = WorkspacePolicy::from_value(&policy.to_value()).expect("canonical form parses");
    assert_eq!(again, policy);
    let text = serde_json::to_string(&policy_json()).expect("json");
    assert_eq!(WorkspacePolicy::parse(&text).expect("text parses"), policy);
}

#[test]
fn a_guest_role_kind_rejects_the_policy_naming_the_kind() {
    let error = with_role(|v| v["roles"][2]["kind"] = json!("guest")).expect_err("guest");
    assert_eq!(
        error,
        PolicyError::UnknownRoleKind {
            kind: "guest".to_string()
        }
    );
    assert!(error.to_string().contains("`guest`"), "{error}");
    for kind in ["partner", "admin", "Audit_Team", "", "external_auditor"] {
        assert!(
            matches!(
                with_role(|v| v["roles"][1]["kind"] = json!(kind)),
                Err(PolicyError::UnknownRoleKind { .. })
            ),
            "{kind}"
        );
    }
}

#[test]
fn unknown_actions_are_refused_not_ignored() {
    assert_eq!(
        with_role(|v| v["roles"][1]["actions"] = json!(["read", "approve"])),
        Err(PolicyError::UnknownAction {
            role: "auditor".to_string(),
            action: "approve".to_string()
        })
    );
    assert_eq!(
        with_role(|v| v["roles"][1]["actions"] = json!([])),
        Err(PolicyError::NoActions("auditor".to_string()))
    );
}

#[test]
fn structural_errors_are_refused() {
    assert!(matches!(
        with_role(|v| v["policy_version"] = json!(2)),
        Err(PolicyError::UnsupportedVersion(_))
    ));
    assert!(matches!(
        with_role(|v| v["policy_version"] = json!("1")),
        Err(PolicyError::UnsupportedVersion(_))
    ));
    assert_eq!(
        with_role(|v| v["roles"] = json!([])),
        Err(PolicyError::RoleCount)
    );
    assert_eq!(
        with_role(|v| v["roles"][1]["id"] = json!("audit_lead")),
        Err(PolicyError::DuplicateRole("audit_lead".to_string()))
    );
    for bad in ["", "Lead", "1st", "lead-x", "lead x"] {
        assert_eq!(
            with_role(|v| v["roles"][1]["id"] = json!(bad)),
            Err(PolicyError::InvalidRoleId(bad.to_string())),
            "{bad:?}"
        );
    }
    assert_eq!(
        with_role(|v| v["roles"][1]["label"] = json!("  ")),
        Err(PolicyError::InvalidLabel("auditor".to_string()))
    );
    assert!(matches!(
        with_role(|v| v["roles"][1]["colour"] = json!("red")),
        Err(PolicyError::Malformed(_))
    ));
    assert!(matches!(
        with_role(|v| v["extra"] = json!(1)),
        Err(PolicyError::Malformed(_))
    ));
    assert!(matches!(
        with_role(|v| {
            v.as_object_mut().expect("object").remove("roles");
        }),
        Err(PolicyError::Malformed(_))
    ));
    assert!(matches!(
        WorkspacePolicy::parse("not json"),
        Err(PolicyError::Malformed(_))
    ));
}

#[test]
fn a_policy_without_an_administrator_is_refused() {
    assert_eq!(
        with_role(|v| v["roles"][0]["actions"] = json!(["read"])),
        Err(PolicyError::NoAdministrator)
    );
}

#[test]
fn external_audit_attributes_are_route_not_available() {
    assert_eq!(
        with_role(|v| v["client"] = json!("Acme")),
        Err(PolicyError::RouteNotAvailable("client".to_string()))
    );
    assert_eq!(
        with_role(|v| v["roles"][2]["independence"] = json!("required")),
        Err(PolicyError::RouteNotAvailable("independence".to_string()))
    );
    assert!(matches!(
        with_role(|v| v["client_independence_policy"] = json!({})),
        Err(PolicyError::RouteNotAvailable(_))
    ));
}

#[test]
fn only_audit_team_and_reviewer_kinds_exist() {
    assert_eq!(RoleKind::parse("audit_team"), Some(RoleKind::AuditTeam));
    assert_eq!(RoleKind::parse("reviewer"), Some(RoleKind::Reviewer));
    assert_eq!(RoleKind::parse("guest"), None);
    for role in policy().roles() {
        assert!(matches!(
            role.kind,
            RoleKind::AuditTeam | RoleKind::Reviewer
        ));
    }
}

#[test]
fn workspace_kinds_and_actions_parse_closed() {
    assert_eq!(
        WorkspaceKind::parse("internal_company"),
        Some(WorkspaceKind::InternalCompany)
    );
    assert_eq!(
        WorkspaceKind::parse("external_audit"),
        Some(WorkspaceKind::ExternalAudit)
    );
    assert_eq!(WorkspaceKind::parse("client"), None);
    assert!(WorkspaceKind::InternalCompany.is_enabled());
    assert!(!WorkspaceKind::ExternalAudit.is_enabled());
    for action in Action::ALL {
        assert_eq!(Action::parse(action.as_str()), Some(action));
    }
    assert_eq!(Action::parse("approve"), None);
    assert!(Action::ManageMembership.is_administrative());
    assert!(
        Action::ALL
            .into_iter()
            .filter(|a| a.is_administrative())
            .eq([Action::ManageMembership])
    );
}

#[test]
fn bindings_to_roles_the_policy_lacks_grant_nothing() {
    let policy = policy();
    assert!(!policy.permits(&["owner".to_string()], Action::Read));
    assert!(policy.permits(&["owner".to_string(), "auditor".to_string()], Action::Read));
}

// ---- decisions ------------------------------------------------------------

struct World {
    policy: WorkspacePolicy,
    me: Uuid,
    other: Uuid,
    roles: Vec<String>,
    engagements: BTreeSet<Uuid>,
    kind: Option<WorkspaceKind>,
    session_active: bool,
    member: Option<bool>,
}

impl World {
    fn new(roles: &[&str]) -> Self {
        Self {
            policy: policy(),
            me: Uuid::new_v4(),
            other: Uuid::new_v4(),
            roles: roles.iter().map(ToString::to_string).collect(),
            engagements: BTreeSet::new(),
            kind: Some(WorkspaceKind::InternalCompany),
            session_active: true,
            member: Some(true),
        }
    }

    fn facts(&self) -> AuthorityFacts<'_> {
        AuthorityFacts {
            principal_id: self.me,
            session_active: self.session_active,
            workspace_kind: self.kind,
            membership: self.member.map(|active| MembershipFacts {
                active,
                roles: &self.roles,
            }),
            policy: &self.policy,
            engagements: &self.engagements,
        }
    }

    fn workspace(&self, action: Action) -> Decision {
        decide(
            &self.facts(),
            AccessRequest {
                action,
                resource: None,
            },
            None,
        )
    }

    fn resource(
        &self,
        action: Action,
        reference: ResourceRef,
        record: Option<ResourceRecord>,
        grants: &[Grant],
    ) -> Decision {
        decide(
            &self.facts(),
            AccessRequest {
                action,
                resource: Some(reference),
            },
            Some(&ResourceFacts { record, grants }),
        )
    }
}

fn task(id: Uuid) -> ResourceRef {
    ResourceRef {
        kind: ResourceKind::PrivateTask,
        id,
    }
}

fn shared(id: Uuid) -> ResourceRef {
    ResourceRef {
        kind: ResourceKind::SharedResource,
        id,
    }
}

fn grant(resource_id: Uuid, audience: GrantAudience, actions: &[Action]) -> Grant {
    Grant {
        resource_id,
        audience,
        actions: actions.iter().copied().collect(),
        active: true,
    }
}

const fn deny(reason: DenyReason) -> Decision {
    Decision::Deny(reason)
}

#[test]
fn workspace_actions_need_session_kind_membership_and_a_permitting_role() {
    let mut world = World::new(&["audit_lead"]);
    assert_eq!(world.workspace(Action::ManageMembership), Decision::Allow);
    assert_eq!(world.workspace(Action::Read), Decision::Allow);
    assert_eq!(
        world.workspace(Action::Export),
        deny(DenyReason::RoleLacksAction)
    );

    world.session_active = false;
    assert_eq!(world.workspace(Action::Read), deny(DenyReason::NotSignedIn));
    world.session_active = true;

    world.member = Some(false);
    assert_eq!(world.workspace(Action::Read), deny(DenyReason::NotAMember));
    world.member = None;
    assert_eq!(world.workspace(Action::Read), deny(DenyReason::NotAMember));
    world.member = Some(true);

    world.kind = Some(WorkspaceKind::ExternalAudit);
    assert_eq!(
        world.workspace(Action::Read),
        deny(DenyReason::RouteNotAvailable)
    );
    world.kind = None;
    assert_eq!(
        world.workspace(Action::Read),
        deny(DenyReason::RouteNotAvailable)
    );
}

#[test]
fn self_elevation_without_manage_membership_is_role_lacks_action() {
    let world = World::new(&["auditor"]);
    assert_eq!(
        world.workspace(Action::ManageMembership),
        deny(DenyReason::RoleLacksAction)
    );
    let nobody = World::new(&[]);
    assert_eq!(
        nobody.workspace(Action::Read),
        deny(DenyReason::RoleLacksAction)
    );
}

#[test]
fn another_creators_private_task_is_never_reachable() {
    let mut world = World::new(&["audit_lead", "auditor", "reviewer"]);
    let id = Uuid::new_v4();
    let engagement = Uuid::new_v4();
    world.engagements.insert(engagement);
    let theirs = Some(ResourceRecord::PrivateTask {
        creator: world.other,
    });
    // Even a grant naming the caller does not reach a private Task.
    let grants = [grant(
        id,
        GrantAudience::Principal(world.me),
        &Action::ALL[..7],
    )];
    for action in Action::ALL {
        assert_eq!(
            world.resource(action, task(id), theirs, &grants),
            deny(DenyReason::NotTheCreator),
            "{action}"
        );
    }
    // A member without any permitting role still gets the same reason.
    let plain = World::new(&[]);
    assert_eq!(
        plain.resource(
            Action::Read,
            task(id),
            Some(ResourceRecord::PrivateTask {
                creator: plain.other
            }),
            &[]
        ),
        deny(DenyReason::NotTheCreator)
    );
}

#[test]
fn the_creator_reaches_their_own_private_task() {
    let world = World::new(&["auditor"]);
    let id = Uuid::new_v4();
    let mine = Some(ResourceRecord::PrivateTask { creator: world.me });
    assert_eq!(
        world.resource(Action::Read, task(id), mine, &[]),
        Decision::Allow
    );
    // Still policy-controlled: an action the role lacks, or the administrative one.
    assert_eq!(
        world.resource(Action::Export, task(id), mine, &[]),
        deny(DenyReason::RoleLacksAction)
    );
    let admin = World::new(&["audit_lead"]);
    assert_eq!(
        admin.resource(
            Action::ManageMembership,
            task(id),
            Some(ResourceRecord::PrivateTask { creator: admin.me }),
            &[]
        ),
        deny(DenyReason::RoleLacksAction)
    );
}

#[test]
fn an_unknown_private_task_gets_the_same_reason_as_a_forbidden_one() {
    let world = World::new(&["audit_lead", "auditor"]);
    let forbidden = world.resource(
        Action::Read,
        task(Uuid::new_v4()),
        Some(ResourceRecord::PrivateTask {
            creator: world.other,
        }),
        &[],
    );
    let unknown = world.resource(Action::Read, task(Uuid::new_v4()), None, &[]);
    // A shared resource referenced as a private Task is unknown too.
    let mismatched = world.resource(
        Action::Read,
        task(Uuid::new_v4()),
        Some(ResourceRecord::SharedResource {
            engagement_id: None,
        }),
        &[],
    );
    assert_eq!(forbidden, deny(DenyReason::NotTheCreator));
    assert_eq!(unknown, forbidden);
    assert_eq!(mismatched, forbidden);
}

#[test]
fn a_shared_resource_needs_an_exact_active_grant() {
    let world = World::new(&["auditor"]);
    let id = Uuid::new_v4();
    let record = Some(ResourceRecord::SharedResource {
        engagement_id: None,
    });
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &[]),
        deny(DenyReason::NoGrant)
    );
    let mine = grant(id, GrantAudience::Principal(world.me), &[Action::Read]);
    assert_eq!(
        world.resource(
            Action::Read,
            shared(id),
            record,
            std::slice::from_ref(&mine)
        ),
        Decision::Allow
    );
    // Not for another action, another resource, another principal or when withdrawn.
    assert_eq!(
        world.resource(
            Action::Derive,
            shared(id),
            record,
            std::slice::from_ref(&mine)
        ),
        deny(DenyReason::NoGrant)
    );
    let elsewhere = grant(
        Uuid::new_v4(),
        GrantAudience::Principal(world.me),
        &[Action::Read],
    );
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &[elsewhere]),
        deny(DenyReason::NoGrant)
    );
    let someone_else = grant(id, GrantAudience::Principal(world.other), &[Action::Read]);
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &[someone_else]),
        deny(DenyReason::NoGrant)
    );
    let withdrawn = Grant {
        active: false,
        ..mine
    };
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &[withdrawn]),
        deny(DenyReason::NoGrant)
    );
    // The grant does not lift the role requirement.
    let export = grant(id, GrantAudience::Principal(world.me), &[Action::Export]);
    assert_eq!(
        world.resource(Action::Export, shared(id), record, &[export]),
        deny(DenyReason::RoleLacksAction)
    );
}

#[test]
fn a_team_grant_reaches_audit_team_roles_only() {
    let id = Uuid::new_v4();
    let record = Some(ResourceRecord::SharedResource {
        engagement_id: None,
    });
    let team = [grant(
        id,
        GrantAudience::WorkspaceAuditTeam,
        &[Action::Read],
    )];
    let auditor = World::new(&["auditor"]);
    assert_eq!(
        auditor.resource(Action::Read, shared(id), record, &team),
        Decision::Allow
    );
    let reviewer = World::new(&["reviewer"]);
    assert_eq!(
        reviewer.resource(Action::Read, shared(id), record, &team),
        deny(DenyReason::NoGrant)
    );
}

#[test]
fn an_engagement_resource_also_needs_engagement_membership() {
    let mut world = World::new(&["auditor"]);
    let id = Uuid::new_v4();
    let engagement = Uuid::new_v4();
    let record = Some(ResourceRecord::SharedResource {
        engagement_id: Some(engagement),
    });
    let grants = [grant(
        id,
        GrantAudience::Principal(world.me),
        &[Action::Read],
    )];
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &grants),
        deny(DenyReason::NoGrant)
    );
    world.engagements.insert(engagement);
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &grants),
        Decision::Allow
    );
    // Engagement membership alone grants nothing.
    assert_eq!(
        world.resource(Action::Read, shared(id), record, &[]),
        deny(DenyReason::NoGrant)
    );
}

#[test]
fn an_unknown_shared_resource_gets_the_same_reason_as_a_forbidden_one() {
    let world = World::new(&["auditor"]);
    let forbidden = world.resource(
        Action::Read,
        shared(Uuid::new_v4()),
        Some(ResourceRecord::SharedResource {
            engagement_id: None,
        }),
        &[],
    );
    let unknown = world.resource(Action::Read, shared(Uuid::new_v4()), None, &[]);
    let a_task = world.resource(
        Action::Read,
        shared(Uuid::new_v4()),
        Some(ResourceRecord::PrivateTask { creator: world.me }),
        &[],
    );
    assert_eq!(forbidden, deny(DenyReason::NoGrant));
    assert_eq!(unknown, forbidden);
    assert_eq!(a_task, forbidden);
}

#[test]
fn manage_membership_never_reaches_a_resource() {
    let world = World::new(&["audit_lead"]);
    let id = Uuid::new_v4();
    let mut admin_grant = grant(id, GrantAudience::Principal(world.me), &[Action::Read]);
    admin_grant.actions.insert(Action::ManageMembership);
    assert_eq!(
        world.resource(
            Action::ManageMembership,
            shared(id),
            Some(ResourceRecord::SharedResource {
                engagement_id: None
            }),
            &[admin_grant]
        ),
        deny(DenyReason::NoGrant)
    );
}

#[test]
fn resource_checks_still_require_the_workspace_checks_first() {
    let mut world = World::new(&["auditor"]);
    let id = Uuid::new_v4();
    let mine = Some(ResourceRecord::PrivateTask { creator: world.me });
    world.member = Some(false);
    assert_eq!(
        world.resource(Action::Read, task(id), mine, &[]),
        deny(DenyReason::NotAMember)
    );
    world.member = Some(true);
    world.kind = Some(WorkspaceKind::ExternalAudit);
    assert_eq!(
        world.resource(Action::Read, task(id), mine, &[]),
        deny(DenyReason::RouteNotAvailable)
    );
    world.kind = Some(WorkspaceKind::InternalCompany);
    world.session_active = false;
    assert_eq!(
        world.resource(Action::Read, task(id), mine, &[]),
        deny(DenyReason::NotSignedIn)
    );
}

#[test]
fn deny_reasons_are_the_fixed_set() {
    let names: Vec<&str> = DenyReason::ALL.iter().map(|r| r.as_str()).collect();
    assert_eq!(
        names,
        [
            "not_signed_in",
            "not_a_member",
            "role_lacks_action",
            "no_grant",
            "not_the_creator",
            "route_not_available"
        ]
    );
    assert_eq!(
        Decision::Deny(DenyReason::NoGrant).into_result(),
        Err(DenyReason::NoGrant)
    );
    assert_eq!(Decision::Allow.into_result(), Ok(()));
}
