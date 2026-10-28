//! Shared wire values: decimal-string revisions and epochs, and RFC 3339 times.

use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::Serializer;
use std::fmt;

/// Parses a canonical unsigned decimal: ASCII digits only, no sign, no leading
/// zero (except `"0"` itself), and within `u64`.
fn parse_decimal(value: &str) -> Option<u64> {
    if value.is_empty()
        || !value.bytes().all(|b| b.is_ascii_digit())
        || (value.len() > 1 && value.starts_with('0'))
    {
        return None;
    }
    value.parse().ok()
}

macro_rules! decimal_string_value {
    ($(#[$meta:meta])* $name:ident, $what:literal) => {
        $(#[$meta])*
        #[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub struct $name(u64);

        impl $name {
            pub const fn new(value: u64) -> Self {
                Self(value)
            }

            pub const fn get(self) -> u64 {
                self.0
            }

            /// Parses the canonical decimal-string form.
            pub fn parse(value: &str) -> Option<Self> {
                parse_decimal(value).map(Self)
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(f)
            }
        }

        impl Serialize for $name {
            fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                serializer.collect_str(&self.0)
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let value = String::deserialize(deserializer)?;
                Self::parse(&value).ok_or_else(|| {
                    serde::de::Error::custom(concat!(
                        $what,
                        " must be a canonical unsigned decimal string"
                    ))
                })
            }
        }
    };
}

decimal_string_value!(
    /// A monotonically increasing record revision, serialized as a decimal string.
    Revision,
    "revision"
);

decimal_string_value!(
    /// The service's command epoch. A mutation whose epoch is not the current one
    /// is rejected, never treated as a fresh operation (SC-2, SC-6).
    CommandEpoch,
    "command epoch"
);

/// Serde for `chrono::DateTime<Utc>` as UTC RFC 3339 with millisecond precision
/// and a `Z` suffix, for example `2026-10-28T12:00:00.000Z`.
pub mod rfc3339_millis {
    use chrono::DateTime;
    use chrono::SecondsFormat;
    use chrono::Utc;
    use serde::Deserialize;
    use serde::Deserializer;
    use serde::Serializer;

    pub fn format(value: &DateTime<Utc>) -> String {
        value.to_rfc3339_opts(SecondsFormat::Millis, true)
    }

    pub fn serialize<S: Serializer>(
        value: &DateTime<Utc>,
        serializer: S,
    ) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&format(value))
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(
        deserializer: D,
    ) -> Result<DateTime<Utc>, D::Error> {
        let value = String::deserialize(deserializer)?;
        DateTime::parse_from_rfc3339(&value)
            .map(|time| time.with_timezone(&Utc))
            .map_err(|_| serde::de::Error::custom("time must be RFC 3339"))
    }

    /// The same encoding for an optional time; `None` serializes as `null`.
    pub mod option {
        use chrono::DateTime;
        use chrono::Utc;
        use serde::Deserialize;
        use serde::Deserializer;
        use serde::Serializer;

        pub fn serialize<S: Serializer>(
            value: &Option<DateTime<Utc>>,
            serializer: S,
        ) -> Result<S::Ok, S::Error> {
            match value {
                Some(value) => serializer.serialize_str(&super::format(value)),
                None => serializer.serialize_none(),
            }
        }

        pub fn deserialize<'de, D: Deserializer<'de>>(
            deserializer: D,
        ) -> Result<Option<DateTime<Utc>>, D::Error> {
            Option::<String>::deserialize(deserializer)?
                .map(|value| {
                    DateTime::parse_from_rfc3339(&value)
                        .map(|time| time.with_timezone(&Utc))
                        .map_err(|_| serde::de::Error::custom("time must be RFC 3339"))
                })
                .transpose()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn decimal_strings_are_canonical() {
        assert_eq!(Revision::parse("0"), Some(Revision::new(0)));
        assert_eq!(Revision::parse("42"), Some(Revision::new(42)));
        assert_eq!(
            Revision::parse("18446744073709551615"),
            Some(Revision::new(u64::MAX))
        );
        for bad in [
            "",
            "01",
            "-1",
            "+1",
            " 1",
            "1 ",
            "1.0",
            "18446744073709551616",
            "x",
        ] {
            assert_eq!(Revision::parse(bad), None, "{bad:?}");
        }
    }
}
