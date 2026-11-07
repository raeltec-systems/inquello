//! The service clock port. Every expiry decision uses it, so tests can drive time
//! explicitly instead of sleeping.

use chrono::DateTime;
use chrono::Utc;

/// The source of "now" for the service.
pub trait Clock: Send + Sync + 'static {
    /// The current UTC time, truncated to milliseconds (the wire precision).
    fn now(&self) -> DateTime<Utc>;
}

/// Wall-clock time.
#[derive(Clone, Copy, Debug, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        truncate_to_millis(Utc::now())
    }
}

/// Drops sub-millisecond precision so stored, compared and serialized times agree.
pub fn truncate_to_millis(time: DateTime<Utc>) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(time.timestamp_millis()).unwrap_or(time)
}
