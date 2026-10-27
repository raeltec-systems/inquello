# Accessibility and authority review

Date: 2026-10-26. **Verdict: no additional actionable accessibility/authority findings on the reviewed baseline.** The separate cross-review FR-20 correction described below remains part of the parent gate synthesis.

| Severity | Additional findings in this review |
| --- | ---: |
| Critical / blocker | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Scope and method

Reviewed the latest [DESIGN.md](DESIGN.md) and [EXPERIENCE.md](EXPERIENCE.md), resolved colour aliases against imported `tokens/colors.css`, independently recomputed 27 contrast pairs and read the relevant form/navigation and workspace handlers. All 95 DESIGN colour aliases match the supplied CSS values. No import code, rendered application, assistive technology, external service or document round trip was executed. This is not a WCAG conformance assessment or evidence that prototype handlers implement the required behaviour.

The user's retained four imported references and nine spine-only surfaces are the accepted review boundary. Intentionally open PRD decisions and AS-UX1–AS-UX4 are future gates, not defects. This review tests coherent requirements and truthful claims within that boundary.

## Checks and outcomes

| Area | Exact locations | Outcome |
| --- | --- | --- |
| Contrast accuracy/applications | [DESIGN contrast table](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:432); [Badge tokens](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:225); [TextField tokens](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:235); [StatusChip tokens](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:282) | Published ratios agree with independent calculations to their shown precision. Weak source pairs are restricted or replaced at component-application level using existing tokens. No failing pair is rounded up to pass. |
| Text and state visibility | [DESIGN faint restriction](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:421); [EXPERIENCE states](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:104); [PlanStep](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:87) | Meaningful metadata uses readable muted text. Loading/empty/denied/offline and blocked/interrupted/partial/stale/uncertain states remain distinct. Colour is not the sole cue; Stop cannot turn unfinished work into done. |
| Keyboard/focus/semantics | [TextField through Menu rows](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:78); [Interaction Primitives](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:128); [Accessibility Floor](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:141) | Labels/name/role/state, keyboard activation and navigation, menu return focus, visible unobscured focus, IME-safe send and unambiguous Escape are specified. Hover/nested-action traps and draft retention are addressed. Source handler gaps are explicitly implementation work. |
| Motion/targets/zoom | [DESIGN motion](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:497); [EXPERIENCE motion](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:150); [Target size](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:151); [Responsive/platform](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:154) | Named state remains without animation. Compact visual marks are separated from effective hit areas. Text resize/reflow and keyboard-accessible table overflow are required. No supplied mobile/dark/reduced-motion implementation is claimed. |
| Permission vs review/approval/delivery | [ApprovalCard](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:88); [Authority and Delivery](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:171); [DESIGN ReviewScreen](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:537) | Execute permission, proposed/applied edit, human review, Professional Approval and attempted/confirmed/uncertain delivery stay separate. Configured authority/preauthorised mandates apply without a newly invented universal sign-off or confirmation. |
| External changes/recovery | [External action contract](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:175); [Excel continuation](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:209); [Word review](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:219); [Automation recovery](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:259) | Destination/identity/content/version and verification are inspectable; unrelated content/fields survive. External edits trigger version checks. Stale commits return to comparison; lost responses reconcile before retry. Stop is not rollback; reconnect is not resend; audit writeback is not permission to alter source transactions. |
| False prototype functionality | [Anti-patterns](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:179); [Workbook](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md:534); [Toast](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:90); [Reference boundary](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md:299) | Fixed R1 routing, simulated editor/version/portal success, false completion and automated accepted states are expressly rejected as real outcomes. Critical failures/uncertain delivery remain persistent. Prototype rows are not W1 evidence. |

## Recomputed contrast evidence

Method: linearise 8-bit sRGB, calculate luminance using 0.2126/0.7152/0.0722, then `(Llighter + 0.05) / (Ldarker + 0.05)`. Values below display six decimals; comparisons used unrounded values. The draft correctly uses normal text 4.5:1, qualifying large text 3:1, and essential non-text cues 3:1 against adjacent colours, with applicable exceptions. See official [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) explanations.

| Pair | Recomputed ratio | Draft treatment |
| --- | ---: | --- |
| Faint / white | 3.183056:1 | Restricted from required normal text. |
| Faint / sidebar | 2.892333:1 | Restricted from required normal text. |
| Faint / panel | 3.072305:1 | Restricted from required normal text. |
| White / attention amber-500 | 2.943353:1 | Replaced for badge text. |
| Ink-900 / attention amber-500 | 5.990988:1 | Proposed badge text clears threshold. |
| Green-600 / accepted green-150 | 4.473723:1 | Correctly fails 4.5; not rounded up. |
| Green-800 / accepted green-150 | 7.779916:1 | Proposed accepted-chip text clears threshold. |
| Muted / white | 6.078635:1 | Meaningful text / essential-boundary application. |
| Muted / sidebar | 5.523445:1 | Readable metadata application. |
| Muted / approval amber-50 | 5.842580:1 | Readable approval context. |
| Muted / selected ink-150 | 4.855094:1 | Selected-row metadata clears threshold. |
| Muted / surface-hover | 4.951736:1 | Hover metadata clears threshold. |
| Pale focus blue-150 / white, sidebar | 1.243599:1 / 1.130015:1 | Supplementary only. |
| Blue-600 / white, sidebar | 6.160732:1 / 5.598045:1 | Meaningful focus indicator clears stated adjacent-surface floor. |
| Source strong/input borders / white | 1.405380:1 / 1.491174:1 | Not sufficient alone when essential identification requires the boundary. |
| Source ink-300/open border / white | 1.666295:1 / 1.739318:1 | Pale source marks cannot be the sole essential indicator. |
| White / decided Avatar green-600 | 5.215421:1 | Initials clear normal-text threshold. |
| Amber-700 / evidence amber-150, approval amber-50 | 5.227644:1 / 5.682804:1 | Labels clear normal-text threshold. |
| Blue-600 / selected blue-50 | 5.680609:1 | Text clears threshold. |
| Added diff foreground/background | 8.390047:1 | Readable pair plus + marker. |
| Deleted diff foreground/background | 8.556256:1 | Readable pair plus − marker. |
| White / ink-900 | 17.633595:1 | Primary action and Toast clear threshold. |

This does not certify arbitrary component combinations. DESIGN explicitly requires actual adjacent-pair/rendered-state checks. Pale structural separators can remain where not necessary to identify a control/state; a readable button label can identify a control without a contrasting decorative border. The draft's 24×24 CSS-pixel target rule with a documented applicable exception matches [target-size minimum guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Actual target spacing, focus geometry and zoom still need the selected host.

## Source limitations correctly carried as implementation work

The following corroborate the drafts; they are not new defects against them:

- [Switch](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/imports/inquello-design-system/components/forms/Switch.jsx:3), [Choice](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/imports/inquello-design-system/components/forms/Choice.jsx:6) and [Menu](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/imports/inquello-design-system/components/navigation/Menu.jsx:5) use click-oriented custom elements without complete keyboard handlers. AS-UX3 and the component rows require their completion.
- [ActiveScreen step state](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/imports/inquello-design-system/ui_kits/workspace/ActiveScreen.jsx:20) and its Stop callback (line 47) can report misleading completion. The spines require truthful interrupted/pending states. Excel/Keep callbacks are notifications, not verified file operations.
- [ReviewScreen](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/imports/inquello-design-system/ui_kits/workspace/ReviewScreen.jsx:2) fixes its item to R1, asserts editor/version success at line 11, and asserts updated outputs at line 41. The spines require the actual selection/version and verified outcome.
- [AutomationsScreen](D:/Projects/inquello/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/imports/inquello-design-system/ui_kits/workspace/AutomationsScreen.jsx:7) has inert New/Open actions and a notification-only evidence request at line 23; line 14 uses accepted for non-attention rows. The spines require persistent functional state, separate run/human-decision meanings and confirmed external effects.

Rendered checks, assistive-technology/keyboard traversal, actual failure/revocation recovery, file round trips and assumption walkthroughs remain downstream gates. No full accessibility, runtime, professional-approval or delivery claim is made here.

## Cross-review coordination

After this review, the parent reported one shared medium finding from the rubric/scope reviews: FR-20 needs an explicit task-specific Method departure record and reviewer visibility. The scope reviewer is making the minimal S06/UJ-7/coverage correction. That addition is compatible with this review: it strengthens visible Method authority and does not change contrast, execution permission, Professional Approval or delivery semantics. It requires no DESIGN change. This report does not close or duplicate that finding in its count; the parent must confirm the correction before completing the combined gate. The hashes below preserve this review's baseline.

## Reviewed versions

| File | SHA-256 |
| --- | --- |
| `DESIGN.md` | `eb25d9df0d52d8c1969c59dc8cabc51ba95b098a2f907b7b07ddf1b05db7941d` |
| `EXPERIENCE.md` | `7a14e4b13e195fb2865128b532aa7293b9a7e2a97d07a82387f7df00142ec84c` |

No spine or imported source was edited. No new mock was requested or created.
