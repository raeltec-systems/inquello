# Spec self-validation — coherence

Reviewed 2026-10-27 against the initial derived SPEC.md and scope-and-gates.md. Verdict: **pass**, with source preservation reviewed separately.

| Spec Law | Result |
| --- | --- |
| 1. Intent and success | All 25 capabilities have one intent and one observable success statement. Detailed fixture and capability conditions remain in mandatory companions. |
| 2. WHAT, not HOW | Capabilities describe user/system outcomes and supported interfaces. Implementation choices and AD rules are adopted through the architecture companion. Interface names such as CLI/SDK/MCP identify retained capability scope, not a new implementation prescription. |
| 3. Decision-bending constraints | Constraints rule out scope cuts, false authority, stale reliance, silent routing, unsafe overwrite/retry and uncontrolled data access. They retain the existing architecture and UX decisions. |
| 4. Non-goals | Explicit boundaries separate V1 from V2, preserve non-universal practice, and distinguish unprioritised suite candidates from ordinary V1 work. Pending guest/synchronisation choices are not treated as permanent prohibitions. |
| 5. Concrete success | Applicable A01–A18 and exact W1–W3/M1 cases remain binding, with matched task-class metrics and counter-metrics. Unknown numerical targets remain gated rather than invented. |
| 6. Stable IDs | New CAP-1–25 are unique; CAP-1–22 cover the 41 V1 FRs and CAP-23–25 cover FR-38/40/42. Existing P/FR/NFR/UJ/AD identifiers remain unchanged. |
| 8. Lean prose | The core is approximately 2,126 words for 25 capability pairs. Detailed maps, gates, source roles and evidence limits live in the authored companion; no diagram or duplicate technical architecture appears in the core. |

Six inherited assumptions and twelve existing product questions remain labelled with owners/triggers in the companion. No new policy, route approval, release cut, numerical target or accepted assumption is inferred.

The 17 mechanical checks pass, covering structure, intent/success presence, exact FR ownership/phase, companion targets, bounded links and unchanged source hashes. They do not establish semantic preservation, runtime acceptance, usability, security or implementation readiness.

Wrapper-only content: the core does not repeat upstream authorship/status ceremony, research/review chronology or operational ledgers. The adopted files retain their provenance; the missing process repetition changes no build/test decision. Final metadata and completion wording will change after preservation validation; capability/constraint semantics are unchanged by that finalization.
