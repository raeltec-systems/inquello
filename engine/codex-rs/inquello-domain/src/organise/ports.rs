//! The port organise commands write and read through. Adapters implement it.

use crate::error::StoreError;
use crate::model::OperationId;
use crate::model::Revision;
use crate::organise::model::Engagement;
use crate::organise::model::EngagementId;
use crate::organise::model::Folder;
use crate::organise::model::FolderId;
use crate::organise::model::KnownWorkspace;
use crate::organise::model::OrganiseReceipt;
use crate::organise::model::OrganiseRecord;
use crate::organise::model::PrincipalId;
use crate::organise::model::ServiceEngagementId;
use crate::organise::model::Task;
use crate::organise::model::TaskId;
use crate::organise::model::WorkspaceId;
use crate::organise::model::WorkspaceLabel;
use crate::organise::model::WorkspaceTree;
use std::future::Future;

/// One record change and the receipt that records it.
///
/// Implementations apply it atomically: the record and the receipt are persisted
/// together or not at all. `expected_revision` 0 creates the record (it must not
/// exist); any other value updates it only while its stored revision equals
/// `expected_revision`. The record's revision is `expected_revision + 1`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OrganiseChange {
    pub expected_revision: Revision,
    pub record: OrganiseRecord,
    pub receipt: OrganiseReceipt,
}

/// Durable storage for Engagements, folders, Tasks and Workspace labels.
pub trait OrganiseStore: Send + Sync {
    fn find_organise_receipt(
        &self,
        operation_id: &OperationId,
    ) -> impl Future<Output = Result<Option<OrganiseReceipt>, StoreError>> + Send;

    fn load_engagement(
        &self,
        engagement_id: EngagementId,
    ) -> impl Future<Output = Result<Option<Engagement>, StoreError>> + Send;

    /// The local Engagement linked to a shared-service Engagement, if any.
    fn find_engagement_by_service_id(
        &self,
        service_engagement_id: ServiceEngagementId,
    ) -> impl Future<Output = Result<Option<Engagement>, StoreError>> + Send;

    fn load_folder(
        &self,
        folder_id: FolderId,
    ) -> impl Future<Output = Result<Option<Folder>, StoreError>> + Send;

    fn load_task(
        &self,
        task_id: TaskId,
    ) -> impl Future<Output = Result<Option<Task>, StoreError>> + Send;

    fn load_workspace_label(
        &self,
        principal_id: PrincipalId,
        workspace_id: WorkspaceId,
    ) -> impl Future<Output = Result<Option<WorkspaceLabel>, StoreError>> + Send;

    /// Atomically applies `change` (see [`OrganiseChange`]).
    ///
    /// Returns [`StoreError::DuplicateOperation`] when the operation ID already
    /// has a receipt (checked first, under the same write lock) and
    /// [`StoreError::RevisionConflict`] when the stored revision differs (actual
    /// 0 when the record does not exist). On any error nothing is persisted.
    fn commit_organise(
        &self,
        change: OrganiseChange,
    ) -> impl Future<Output = Result<(), StoreError>> + Send;

    /// A Workspace's Engagements and folders, and only the Tasks `creator` made.
    fn load_workspace_tree(
        &self,
        workspace_id: WorkspaceId,
        creator: PrincipalId,
    ) -> impl Future<Output = Result<WorkspaceTree, StoreError>> + Send;

    /// The Workspaces this device knows for `principal_id`.
    fn load_known_workspaces(
        &self,
        principal_id: PrincipalId,
    ) -> impl Future<Output = Result<Vec<KnownWorkspace>, StoreError>> + Send;
}
