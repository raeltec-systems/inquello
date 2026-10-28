use inquello_domain::Clock;
use inquello_domain::Timestamp;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

/// The system wall clock.
#[derive(Clone, Copy, Debug, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Timestamp {
        let millis = match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(elapsed) => i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX),
            Err(before_epoch) => {
                i64::try_from(before_epoch.duration().as_millis()).map_or(i64::MIN, |ms| -ms)
            }
        };
        Timestamp::from_unix_millis(millis)
    }
}
