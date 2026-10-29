use inquello_domain::{WorkingStore, StoreInfo, StoreError, OperationId, Receipt, StateChange, InitializeStore, Revision, initialize_store};
use inquello_adapters::{SqliteWorkingStore,SystemClock};
use tokio::sync::Barrier;
struct Gate { store: SqliteWorkingStore, barrier: Barrier }
impl WorkingStore for Gate {
 async fn load_store_info(&self)->Result<Option<StoreInfo>,StoreError>{let result=self.store.load_store_info().await; self.barrier.wait().await;result}
 async fn find_receipt(&self,id:&OperationId)->Result<Option<Receipt>,StoreError>{self.store.find_receipt(id).await}
 async fn commit(&self,change:StateChange)->Result<(),StoreError>{self.store.commit(change).await}
}
fn main(){tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap().block_on(async{
let dir=tempfile::tempdir().unwrap();let store=SqliteWorkingStore::open(&dir.path().join("store.sqlite"),&[]).await.unwrap();let gate=Gate{store,barrier:Barrier::new(2)};
let first=initialize_store(&gate,&SystemClock,InitializeStore{operation_id:"identical-op".into(),expected_revision:Revision::ZERO});
let second=initialize_store(&gate,&SystemClock,InitializeStore{operation_id:"identical-op".into(),expected_revision:Revision::ZERO});
let (a,b)=tokio::join!(first,second);println!("first={a:?}\nsecond={b:?}");gate.store.close().await;
});}
