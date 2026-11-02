# Conversation shell qualification — 2 November 2026

## Verified scope

The approved conversation shell at `9f62bbccc6eb5de57f86e92bebb398a605ed9906` completed an actual Electron journey against the existing native runtime and pinned, local synthetic transport. This is not live-provider acceptance or complete Epic acceptance.

- Initial Send and completed assistant answer.
- Follow-up in the retained conversation and completed answer.
- Visible streaming, explicit Stop, native cancellation, and Resume availability.
- Reader scroll-up preservation and explicit Jump to latest, with real overflow established at a smaller viewport.
- Reopen the saved conversation, explicitly Resume, and observe the completed answer.
- Four synthetic transport calls; zero invalid calls; all context checks matched; held response cancelled and not timed out.
- Fourteen actual Electron captures. Narrow reader-Jump and resumed-answer pixels inspected.
- Native exit code 0, not killed; fixture cleanup errors empty. No paid calls, real credentials or user-profile changes.

## Timing and test preconditions

An earlier exact-baseline observation missed the former 20-second first-acceptance threshold: acceptance occurred at **20,688 ms**, then the first answer completed. That failure is retained, not reclassified as a performance pass.

The functional first-start witness now permits at most 60 seconds while separately recording the 20-second expectation. This accommodates measured Windows isolation setup without changing native deadlines, authority checks, sandboxing or later journey gates. The passing current-shell run recorded **19,267 ms**, with both observations true. This is one sample, not a latency guarantee.

An intermediate scroll test incorrectly required a Jump button when the short retained transcript fitted entirely within the large viewport. The corrected test first establishes actual overflow at 900×700, verifies reader intent and Jump, then restores 1920×1200 before reopening. Product scrolling code was not changed to satisfy this test.

The fictional visual workspace is now named **Mupeta & Partners**. Synthetic issuer, transport and data classification remain unchanged.

## Reproducible local evidence

- Native engine tree: `4846abe8470db3c1ae45e26d71ad05980a41b348`.
- Runtime SHA-256: `57f5478c0624c4305de517c66a3541463a19d3b327c6f455b23db1148c3392c4`.
- Main typecheck and build passed; launcher syntax check passed.
- Passing launcher: `.tmp/shell-same-app-update-20261102-1032/validation-v7.status` and `visual-v7.log`.
- Fixture evidence: `.tmp/inquello-seeded-smoke-Pcnk1w/visual/`, including `smoke.stdout.log`, `synthetic-journey-state.json` and `captures/`.
- Earlier diagnostic: `.tmp/shell-ab-7f-20261102/observe60.status`; original scratch probe restored and original product hashes unchanged.

## Remaining distinctions

Real-provider onboarding and the simplified model-name picker remain separate work. Existing technical route settings shown in these captures are not the approved final auditor experience. Interrupted, uncommitted assistant fragments may disappear after Stop; retained prompts and completed answers were the durability assertions. No Auth0 organisation migration, paid model test or release was performed. Hosted Actions were not used as a gate; local checks and CodeRabbit review remain the agreed workflow.
