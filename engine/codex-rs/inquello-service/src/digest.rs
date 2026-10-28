//! The canonical request digest for SC-2 receipts.
//!
//! The digest is SHA-256, lowercase hex, over a canonical JSON encoding: object
//! keys sorted by their UTF-8 bytes, no insignificant whitespace, and strings and
//! numbers in serde_json's encoding. Two requests that mean the same thing get the
//! same digest whatever their key order on the wire.

use serde_json::Value;
use sha2::Digest;
use sha2::Sha256;
use std::fmt::Write as _;

pub(crate) fn canonical_json(value: &Value) -> String {
    let mut out = String::new();
    write_canonical(value, &mut out);
    out
}

fn write_canonical(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<(&String, &Value)> = map.iter().collect();
            entries.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));
            out.push('{');
            for (index, (key, value)) in entries.into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String(key.clone()).to_string());
                out.push(':');
                write_canonical(value, out);
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_canonical(item, out);
            }
            out.push(']');
        }
        scalar => out.push_str(&scalar.to_string()),
    }
}

/// SHA-256 of `bytes`, lowercase hex.
pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(64);
    for byte in digest {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// The receipt digest of a request value.
pub(crate) fn request_digest(value: &Value) -> String {
    sha256_hex(canonical_json(value).as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use serde_json::json;

    #[test]
    fn canonical_form_sorts_keys_recursively() {
        let a = json!({"b": 1, "a": {"y": [true, null, "s"], "x": 2}});
        let b: Value =
            serde_json::from_str(r#"{"a":{"x":2,"y":[true,null,"s"]},"b":1}"#).expect("json");
        assert_eq!(
            canonical_json(&a),
            r#"{"a":{"x":2,"y":[true,null,"s"]},"b":1}"#
        );
        assert_eq!(request_digest(&a), request_digest(&b));
        assert_ne!(request_digest(&a), request_digest(&json!({"b": 2})));
    }

    #[test]
    fn sha256_hex_matches_a_known_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
