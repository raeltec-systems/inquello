# EXPERIENCE editorial review

This document exists to help internal product and design readers specify and review Inquello's interactions, states and journeys while preserving source scope, authority and open decision gates.

Reviewed 2026-10-26 against [EXPERIENCE.md](EXPERIENCE.md). Reader type: humans. Style guide: Microsoft Writing Style Guide. Content, required headings, 28 component names, eight verbatim UJ names, 13 surfaces and all phase/authority/open-gate distinctions are preserved.

## Structure pass

**Model: Reference/Database**, with numbered journey narratives as worked examples. The document supports readers who move between a surface, component, state and flow rather than reading every section in sequence.

No structural change is recommended. The shared state baseline and surface-specific rows serve different purposes; the repeated authority distinctions prevent misleading interpretations at the point of action. The paired component rules, source classifications, assumptions and final open-gate index support downstream lookup. Preserve them. No passage is tagged CUT or MERGE; the prose pass therefore reviews the existing structure without skipped or relocated content.

## Prose pass

Preserve the concise contract voice, imperative rules, British spelling, intentional table fragments, slash-separated state lists, source identifiers and capitalized product concepts. Two empty-state sentences compress away the condition/action relationship and can be misread as claims about what a Method or provider does. One grouped finding covers this repeated issue; the proposed text changes no behavior.

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| prose | §State Patterns, S06, line 117: `No reusable method offers create/select from permitted guidance.`<br><br>§State Patterns, S07, line 118: `No connection/provider available explains the missing route, not “no product capability.”` | S06: `When no reusable Method is available, offer creation or selection from permitted guidance.`<br><br>S07: `When no connection or provider is available, explain the missing route without implying that the product lacks the capability.` | Makes each empty condition explicit, then identifies the UI's response. The originals can be read as saying that no Method offers an action, or that no provider explains a route. Preserves the available-guidance and missing-route distinctions. S06: 8 → 13 words; S07: 11 → 19 words; net +13 words. |

Both original strings occur exactly once in the reviewed file, so the replacements can be applied independently without changing their table structure. No other prose change is recommended.

## Exact metrics

Ran the required script:

```text
uv run .agents/skills/bmad-review/scripts/word_metrics.py _bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md
```

`UV_CACHE_DIR` was set to the task's temporary cache. Counts use that script's whitespace/CJK definition; the document total includes headings, frontmatter and markup, while each section count excludes its heading and stops at the next heading. Exact replacement counts and the projected result were calculated with the same script's functions, in memory without editing the spine.

| Heading section | Original words |
| --- | ---: |
| (preamble) | 21 |
| Inquello — Experience Spine | 0 |
| Foundation | 264 |
| Information Architecture | 777 |
| Voice and Tone | 358 |
| Component Patterns | 1,253 |
| State Patterns | 858 |
| Interaction Primitives | 333 |
| Accessibility Floor | 325 |
| Responsive & Platform | 397 |
| Authority and Delivery | 188 |
| Inspiration & Anti-patterns | 134 |
| Key Flows | 53 |
| UJ-1 — Amina answers an ad hoc question (source J1). | 171 |
| UJ-2 — Amina and Noah carry an engagement through review (J2). | 177 |
| UJ-3 — Amina continues a reconciliation in Excel (J3). | 192 |
| UJ-4 — Amina and Noah revise a Word workpaper (J4). | 169 |
| UJ-5 — Dev reconciles specialist investigations (J5). | 169 |
| UJ-6 — Amina develops advisory options (J6). | 134 |
| UJ-7 — Amina teaches and reuses a procedure (J7). | 189 |
| UJ-8 — Noah follows a triggered procedure through (J8). | 190 |
| Supporting paths within the source journeys | 500 |
| Open Items and Validation Boundaries | 381 |

Original document total: **7,367 words**. Projected total if both replacements are accepted: **7,380 words**; State Patterns becomes **871 words**. All other section counts remain unchanged.

## Reduction and trade-offs

Recommendations: **0 structure changes; 1 grouped prose recommendation covering 2 exact replacements**. Net reduction: **−13 words (−0.18%)**, meaning a 13-word increase to make the conditions and actions explicit. No length target was supplied. There is no loss of content, examples, orientation or reference coverage, and no structural or scope trade-off.

Reviewed source SHA-256: `219A2BFB9A6ED91AE2C66232BBEC6BB81197143C37872081C141548CD2A0CC30`. The spine and earlier rubric report remain unchanged by this review.
