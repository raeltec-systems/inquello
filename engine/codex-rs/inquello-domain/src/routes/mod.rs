//! Explicit, creator-private processing routes. Configuration is not enablement.
//! No command accepts evidence, credentials or an eligibility override. Changes
//! have their own revision; the runtime must invalidate attempts/continuations
//! bound to an older revision before applying new output or starting work.

mod commands;
mod model;
mod ports;

pub use commands::*;
pub use model::*;
pub use ports::*;
