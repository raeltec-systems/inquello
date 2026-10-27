# DESIGN editorial review

This document exists to help the internal product, design and architecture team implement the supplied Inquello visual system without losing its token values, source boundaries or product decisions.

Reader type: humans. Baseline: Microsoft Writing Style Guide. Review order: structure, then prose. No hooks, facts lens or custom guidance applied. No spine edits made.

**Structure model: Reference/Database.** The canonical eight-section order, YAML contract and 28-component table support random access and implementation. There are no structural change recommendations. Keep source reconciliation, accessibility restrictions and the final do/don't table: their repeated reminders prevent implementers from treating visual state or source code as authority/functionality. No passage is tagged CUT, so none was excluded from prose review.

**Intentional voice preserved:** compact specifications, technical terms, source token/component spelling, British spelling, factual tone, assumption tags and explicit limits. The suggestions below address ambiguous or malformed measurement prose only; they do not change values, claims, scope, hierarchy, source links or machine-readable fields.

## Findings

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| structure | YAML preamble (850 words); canonical eight sections; Components (1,002 words). | **PRESERVE** the existing structure and machine-readable contract. | Reference schema and source distinctions serve implementation; no cut/merge/move is justified. Word impact: 0. |
| prose | **P1 — Components**, lines 515–516, 527–528.<br>`11px/16px, radius8, horizontal padding6.`<br>`12.5px/1.45.`<br>`12.5px/1.5 body.`<br>`Ink/white, radius6, padding8×14,12.5px/1.4, toast shadow.` | `11px type with a 16px line height, an 8px radius and 6px horizontal padding.`<br>`12.5px type with a 1.45 line height.`<br>`12.5px body text with a 1.5 line height.`<br>`Ink/white; 6px radius, 8×14px padding, 12.5px type with a 1.4 line height, and toast shadow.` | Label font size and line height; spell out radii/padding units in these compressed passages. Existing values remain exact. Apply these four substitutions before P2. Word impact: +32. |
| prose | **P2 — Components and Do's and Don'ts**, lines 513–552. Examples: `round30px`, `track28×16`, `UI13px,6×8px padding,6px radius`, `a14px`. Complete exact substitutions appear in the P2 entries below. | `round 30px`<br>`track 28×16px`<br>`UI 13px, 6×8px padding, 6px radius`<br>`a 14px`<br>Apply the complete P2 substitutions below to prose only. | Separate run-together words/measurements and add omitted px units where the existing source contract establishes them. This removes strings that resemble component/token identifiers. One grouped finding covers all occurrences; no numeric value changes. Word impact: +57. |
| prose | **P3 — Shapes**, line 503.<br>`The source's 14px Composer is the softest main surface.` | `The Composer's 14px corner radius gives it the softest rounding among the main surfaces.` | Identify 14px as the corner radius, rather than leaving it open to interpretation as a height or font size. Preserve the relative-rounding claim. Word impact: +5. |

## Exact replacement set

Apply in the listed order, **only after the YAML frontmatter**. Counts are measured after prior listed replacements. P1 and P2 touch the same component rows but not the same remaining text. This makes the proposals independently inspectable while preventing double edits. The list is supplied for the parent author; it has not been applied to DESIGN.md.

```json
[
  {
    "finding": "P1",
    "old": "11px/16px, radius8, horizontal padding6.",
    "new": "11px type with a 16px line height, an 8px radius and 6px horizontal padding.",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P1",
    "old": "12.5px/1.45.",
    "new": "12.5px type with a 1.45 line height.",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P1",
    "old": "12.5px/1.5 body.",
    "new": "12.5px body text with a 1.5 line height.",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P1",
    "old": "Ink/white, radius6, padding8×14,12.5px/1.4, toast shadow.",
    "new": "Ink/white; 6px radius, 8×14px padding, 12.5px type with a 1.4 line height, and toast shadow.",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "round30px",
    "new": "round 30px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "person24px",
    "new": "person 24px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "radius6",
    "new": "radius 6px",
    "occurrences_after_prior_replacements": 3
  },
  {
    "finding": "P2",
    "old": "track28×16",
    "new": "track 28×16px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "thumb12",
    "new": "thumb 12px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "radius8",
    "new": "radius 8px",
    "occurrences_after_prior_replacements": 2
  },
  {
    "finding": "P2",
    "old": "Radio14px/dot6 or checkbox16px/radius4",
    "new": "Radio 14px/dot 6px or checkbox 16px/radius 4px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "radius5",
    "new": "radius 5px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "muted11px",
    "new": "muted 11px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "radius10",
    "new": "radius 10px",
    "occurrences_after_prior_replacements": 2
  },
  {
    "finding": "P2",
    "old": "width300",
    "new": "width 300px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "radius3",
    "new": "radius 3px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "optional16px",
    "new": "optional 16px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "or11px",
    "new": "or 11px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "mono9px",
    "new": "mono 9px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "with12px",
    "new": "with 12px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "Indicator14px/radius4.",
    "new": "Indicator 14px/radius 4px.",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "padding12×14",
    "new": "padding 12×14px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "label,13.5px",
    "new": "label, 13.5px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "optional12.5px",
    "new": "optional 12.5px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "optional40px gutter,14px sign,",
    "new": "optional 40px gutter, 14px sign, ",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "Pale264px navigation with20px lockup",
    "new": "Pale 264px navigation with a 20px lockup",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "Collapsed52px",
    "new": "Collapsed 52px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "White48px region with14px semantic title",
    "new": "White 48px region with a 14px semantic title",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "White14px-radius",
    "new": "White 14px-radius",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "and30px",
    "new": "and 30px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "UI13px,6×8px padding,6px radius",
    "new": "UI 13px, 6×8px padding, 6px radius",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "mono11px medium overline,uppercase,+.04em",
    "new": "mono 11px medium overline, uppercase, +.04em",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "and12.5px",
    "new": "and 12.5px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "centred720px-max",
    "new": "centred 720px-max",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "symbol40px, display28px",
    "new": "symbol 40px, display 28px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "min380px wins over340px",
    "new": "minimum 380px wins over 340px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "Header14px",
    "new": "Header 14px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "a14px",
    "new": "a 14px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P2",
    "old": "title14px and panel-min380px",
    "new": "title 14px and panel minimum 380px",
    "occurrences_after_prior_replacements": 1
  },
  {
    "finding": "P3",
    "old": "The source's 14px Composer is the softest main surface.",
    "new": "The Composer's 14px corner radius gives it the softest rounding among the main surfaces.",
    "occurrences_after_prior_replacements": 1
  }
]
```

## Exact metrics and reduction summary

Executed the required command with a temporary cache:

```powershell
$env:UV_CACHE_DIR = Join-Path $env:TEMP 'inquello-bmad-review-uv-cache'
uv run 'D:/Projects/inquello/.agents/skills/bmad-review/scripts/word_metrics.py' 'D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md'
```

Original exact total: **4,299 words**. The tool counts whitespace-separated tokens, including YAML, table syntax and link destinations; per-section counts exclude their heading text and therefore need not sum to the total. The 850-word preamble is the machine contract and is not proposed for shortening. A temporary proposed copy was measured with the same script's exact counting functions and then verified with `uv run word_metrics.py` against that copy; its exact total is **4,393 words**. The table below gives original/proposed section-body counts.

| Section | Original words | Proposed words |
| --- | ---: | ---: |
| (preamble) | 850 | 850 |
| Brand & Style | 356 | 356 |
| Colors | 356 | 356 |
| Visual accessibility floor and explicit applications | 273 | 273 |
| Typography | 362 | 362 |
| Layout & Spacing | 381 | 381 |
| Elevation & Depth | 233 | 233 |
| Shapes | 116 | 121 |
| Components | 1002 | 1087 |
| Do's and Don'ts | 339 | 343 |

**Summary:** 3 actionable prose recommendations, grouped across their occurrences; 1 structural PRESERVE disposition; 0 structural changes. Estimated reduction if all are accepted: **0 words (0%)**. Net change: **+94 words (+2.19%)**; clarity additions explain the increase. No length target was supplied and no shortening is needed. No reader scaffolding, example, visual aid, token, decision or source attribution is removed. All numeric values and the frontmatter remain unchanged.

Reviewed DESIGN SHA-256: `eb25d9df0d52d8c1969c59dc8cabc51ba95b098a2f907b7b07ddf1b05db7941d`.
