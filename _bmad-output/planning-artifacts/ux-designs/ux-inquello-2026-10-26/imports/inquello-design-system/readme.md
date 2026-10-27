# Inquello Design System

Inquello is the AI workspace for auditors. An auditor brings files, procedures, evidence and assignments into a workspace and directs an agent through conversation. The agent investigates, analyses data, runs procedures, drafts and edits working papers, delegates to specialist agents and asks before acting outside the workspace. It serves internal audit, external audit, advisory and IT/IS audit. V1 works with existing files and external systems of record; native sign-off and records retention come in V2.

This system covers one product surface, the **desktop workspace** (sidebar, thread, side panel with the artifact, console, automations).

## Sources

- The Inquello design prototype, in the light "precise studio" direction: start, active work, review, continuing in Excel and background automations. Token values were taken from it.
- The approved identity, a faithful vector redraw of concept A / Open Inquiry.
- No external codebase or Figma file was provided.

## Index

- `styles.css`: the one file consumers link. It only `@import`s `tokens/`.
- `tokens/`: `fonts.css` (IBM Plex @font-face), `colors.css`, `typography.css`, `layout.css` (spacing, radii, elevation, sizes, motion), `base.css` (body reset, link colours, keyframes).
- `assets/logo/`: lockup, symbol, wordmark and app icon SVGs, each with reversed versions, plus blue and small-size variants.
- `assets/icons/`: 40 Lucide SVGs. `assets/fonts/`: IBM Plex Sans 400/500/600, IBM Plex Mono 400/500 (woff2, latin).
- `guidelines/`: 22 specimen cards for Brand, Colors, Type, Spacing, Iconography and Content.
- `components/`: React primitives in `core/`, `forms/`, `navigation/`, `status/` and `workflow/`, each with a `.d.ts`, a `.prompt.md` and one card per directory. `preview-loader.js` lets cards and kits run before a compiled bundle exists.
- `ui_kits/workspace/`: click-through recreation of the workspace (Start, Active work, Review, Automations).
- `SKILL.md`: agent-skill entry point.

### Components

- **core:** Icon, Button, IconButton, Avatar, Badge
- **forms:** TextField, Switch, Choice (radio, checkbox, option card), SegmentedControl
- **navigation:** Tabs, Menu
- **status:** StatusChip, JudgmentTag, FileChip
- **workflow:** PlanStep, ApprovalCard, DiffLine, Toast

No component library existed before this system, so the set is drawn from elements the prototype repeats. Intentional additions:
- **Icon**, a wrapper for the copied Lucide paths.
- **JudgmentTag**, the five-way claim taxonomy the review flow depends on.

## Content fundamentals

- **Plain, specific language.** Name the thing, the amount and the source: "Kestrel Supplies paid 50 less than recorded", not "Variance detected". Technical detail (queries, scripts, cell formulas) sits one click away in the console or the Changes panel.
- **Sentence case everywhere**, including buttons, tabs and menu items: "Open in Excel", "Send request", "Leave R4 open". Uppercase appears only in mono overlines ("APPROVAL NEEDED").
- **Person.** The user is "you". The agent speaks in the first person, briefly, and asks before acting outside the workspace: "May I ask Meridian for the October statement through the client portal?" It states what it did and what is uncertain, never how it feels.
- **Judgment words are precise.** An unmatched item is an *item*, *difference* or *open item*. It becomes a finding only when a person decides. Use the status words: Suggested, Investigating, Open, Needs evidence, Awaiting client, Accepted, Explained.
- **References verbatim:** R1–R4 for reconciling items, JE-4410 for journals, RCP-2291 for bank references, account masks as ••4471, file names exactly as stored.
- **Numbers.** Tables use two decimals, thousands separators and parentheses for negatives: (1,250.00). Prose may drop decimals: "a difference of 150". Dates are written 30 Sep 2026, times use 24 hours (16:20).
- **Confirmations are terse and factual**, using a middle dot as separator: "Kept · 4 outputs updated · v4".
- **No emoji, exclamation marks or hype** ("AI-powered", "magic", "insights").

## Visual foundations

- **Character:** a precise, quiet studio. White working surfaces, a pale grey sidebar and dark ink type. Colour is rare and always means something, so the working paper stays the loudest thing on screen.
- **Colour.** Cool ink neutrals carry everything. Blue (#2F5FB3) is the agent's colour: suggestions, links, focus and running state. Green (#2F7A52) marks people's decisions and additions. Amber (#C98A1B / #8A5A12) means something needs you: evidence, approvals. Red appears only for broken things (integrity failures, removed diff lines) and never for audit findings. The primary action is ink, not blue.
- **Type.** IBM Plex Sans for UI and documents; IBM Plex Mono for overlines, references, code and file-type tags. UI text is 13px, body 14/1.55, captions 12. Titles are 600 weight with tight tracking (−0.02em). Figures are tabular everywhere (`font-variant-numeric: tabular-nums`) and right-aligned in tables.
- **Spacing.** A 4px base with half steps (2, 6, 10) for dense rows. Rows are typically 6/10px padded, panels 16px, the thread 24px.
- **Backgrounds.** Flat: no images, gradients, textures or illustrations. Document previews render as paper pages on the panel grey with a soft page shadow. The console is the one dark surface (#16191D).
- **Borders and cards.** Structure comes from 1px lines (#E3E6EA default, #EEF0F2 subtle, #D6DADE strong). Cards are white with a 1px border and a 10px radius, and normally no shadow. There are no coloured left-border accents.
- **Shadows.** Only floating layers get them: the composer (soft, two-layer), menus (0 12px 32px at 14%), toasts and document pages.
- **Radii.** Small and consistent: 3px chips, 5–6px controls, 8px tables and small cards, 10px cards and menus, 14px for the composer (the softest surface), a pill for counts. The app icon uses 22.7%.
- **Hover and press.** Hover darkens the fill one step: #E6E8EB on the grey sidebar, #F3F4F6 or #FAFBFC on white, blue-50 for table rows. Selected rows and nav items use #E3E6EA. Pressing doesn't shrink or bounce. Focus is a 3px blue-150 ring.
- **Agent marks.** A dashed blue outline means "agent suggestion, not yet decided". A solid green initials disc marks a human decision. Source rows the agent cites get a blue-100 highlight.
- **Motion.** Quiet and functional: 120–200ms with `cubic-bezier(.2,.8,.2,1)` for panels and toggles. An 800ms linear spinner marks running work, and a slow opacity pulse marks live status. There are no entrance animations or bounces.
- **Transparency and blur.** None in the interface. The only translucency is in shadows.
- **Layout.** Sidebar 264px, collapsing to a 52px symbol rail. Header 48px. The thread is centred at up to 720px. The side panel is 560px by default, resizes down to 380px and expands so the artifact becomes the focus. The console is 230px tall at the bottom (⌘J). The header and composer stay fixed while the thread scrolls.
- **Imagery.** There is no photography or illustration in the product. The evidence is the imagery: statements, workbooks and documents shown as they are.

## Iconography

- **Lucide** (ISC licence), copied as SVGs into `assets/icons/` and inlined by the `Icon` component. Stroke 1.75 with round caps and joins. 16px in UI, 14px in dense rows. Colour is `currentColor`, usually ink-700, or muted for meta.
- Icons go next to labels in navigation, buttons and menus. They are never decorative and never stand alone without a tooltip/aria-label.
- **Files are tagged with mono type**, not file icons, in lists and chips: PDF in red, XLS in green, DOC in blue, DIR in grey.
- **The agent is the Inquello symbol**, never a robot, sparkle or face. People are initials discs (blue, green, warm tones).
- **Unicode used as UI:** ✓ (done or checked), × (remove), ⌘ and ⏎ (keyboard hints), ƒ (calculation), ◦ (observation), – (gap), → (links forward), the middle dot (separator), •• (account masks). No emoji.
- No icon font and no PNG icons.

## Brand

- The identity is a faithful vector redraw of concept A. The symbol is a heavy, softly squared lowercase q with a horizontal opening on the left, a slit at the foot of the bowl and a short descender. The wordmark is custom lettering ("Inquello"), outlined, so no font licence applies.
- Use ink on light surfaces and white on dark. The blue symbol is an optional accent outside the product.
- Clear space is half the symbol's width. The minimum lockup height is 16px. Use `inquello-symbol-small.svg` at 20px and below; it has a wider opening and slit.
- Fonts: IBM Plex Sans and Mono under the SIL Open Font License 1.1, self-hosted from `assets/fonts/`.

## Using it

Link `styles.css`, then use the tokens (`var(--text-primary)`, `var(--surface-sidebar)`, `var(--type-body)`, …). For React previews without the compiled bundle, load React, then `components/preview-loader.js`, and await `IQ.ready`, which resolves to `{ Button, StatusChip, … }`. If `assets/` isn't next to the page, set `window.INQUELLO_ASSET_BASE` to the folder that contains it.
