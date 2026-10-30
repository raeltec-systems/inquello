use super::*;
use crate::organise::{PrincipalId, TaskId};
use crate::{OperationId, Revision, StoreError};
use std::future::Future;

pub trait RouteStore: Send + Sync {
    fn load_route_task(&self, task_id: TaskId)
        -> impl Future<Output = Result<Option<RouteTask>, StoreError>> + Send;
    fn load_task_route(&self, task_id: TaskId)
        -> impl Future<Output = Result<(Revision, Option<TaskRouteRecord>), StoreError>> + Send;
    fn load_task_route_record(&self, task_id: TaskId, revision: Revision)
        -> impl Future<Output = Result<Option<TaskRouteRecord>, StoreError>> + Send;
    fn find_route_receipt(&self, operation_id: &OperationId)
        -> impl Future<Output = Result<Option<RouteReceipt>, StoreError>> + Send;
    /// Under one write lock, validate current creator, exact candidate revision,
    /// operation uniqueness and Task-route revision; commit record+receipt.
    fn commit_task_route(&self, change: RouteChange)
        -> impl Future<Output = Result<(), StoreError>> + Send;
    fn load_candidate_route(&self, principal_id: PrincipalId, route_id: RouteId)
        -> impl Future<Output = Result<(Revision, Option<CandidateRouteRecord>), StoreError>> + Send;
    fn load_candidate_route_record(&self, principal_id: PrincipalId, route_id: RouteId, revision: Revision)
        -> impl Future<Output = Result<Option<CandidateRouteRecord>, StoreError>> + Send;
    fn find_candidate_route_receipt(&self, operation_id: &OperationId)
        -> impl Future<Output = Result<Option<CandidateRouteReceipt>, StoreError>> + Send;
    fn commit_candidate_route(&self, change: CandidateRouteChange)
        -> impl Future<Output = Result<(), StoreError>> + Send;
}
