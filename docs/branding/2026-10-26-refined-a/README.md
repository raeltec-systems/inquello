# Inquello — refined A / Open Inquiry

Created 26 October 2026 as a comparison candidate for the user's Claude Design refinement.

Open **index.html** for the identity board, two app placement previews, downloadable SVGs and native pixel-size tests.

## Refinements

- Connected the lower bowl to the descender, leaving one intentional left opening.
- Kept a 20-unit descender below the 84-unit bowl and substantial strokes.
- Balanced symbol height and spacing against the wordmark.
- Drew the eight letters as custom outlines: a distinct capital I, readable closed q, and subtly curved feet on the double l.
- Made a small-size symbol with a 16-unit aperture instead of the standard 12-unit opening for 16–20px use.

## Primary assets

| File | Purpose |
| --- | --- |
| assets/inquello-lockup-ink.svg | Main horizontal symbol and wordmark |
| assets/inquello-symbol-ink.svg | Standalone symbol |
| assets/inquello-wordmark-ink.svg | Standalone outlined lettering |
| assets/inquello-symbol-small.svg | Small-size symbol, recommended at 16–20px height |
| assets/inquello-app-icon.svg | White mark on a dark rounded square |
| assets/inquello-app-icon-light.svg | Dark mark on a pale rounded square |
| assets/*-white.svg | Reversed brand assets |
| assets/*-blue.svg | Optional interface-blue accent versions |
| assets/*-currentcolor.svg | Themeable assets for inline SVG use |

Transparent PNG symbol exports cover 16, 20, 24, 32, 64, 128, 256 and 512px height. A transparent horizontal PNG is also included. The symbol artwork is vertically proportioned; the app-icon files provide square compositions.

## Usage

Use ink (#191D21) on light surfaces and white on dark surfaces as the defaults. Blue (#315FB5) is optional. Retain green and amber for workflow status.

Preserve the viewBox and aspect ratio. Do not stretch the symbol or lettering. The sidebar example uses a horizontal SVG about 152px wide. Use the separate symbol for assistant avatars and compact navigation.

Keep surrounding clear space of at least one symbol stroke width where practical. Small avatars use a separate compact composition; do not place a full wordmark inside them.

All brand SVG assets contain editable paths, have accessible labels and contain no raster images, scripts, external links or font dependencies. The wordmark is custom geometry, not an outlined third-party font. Preview captions and illustrative UI labels use system fonts and are separate from the brand masters. Import SVG files into a vector editor or Claude Design to refine further.

## Preview boundaries

The Start and Active work screens are illustrative SVG recreations based on the supplied screenshots. They show branding in the sidebar, conversation avatar and review note. They are not changes to the original Claude prototype and are not working product features.

The identity board's small examples are native pixel sizes when rendered at 1600px wide. For more reliable checks, use the viewer's Assets & sizes tab at 100% browser zoom. Native 16–64px examples and both app previews were visually inspected; a separate reviewer also checked the geometry and wordmark. This does not replace testing across actual devices or final brand clearance.

## Editable source

The SVGs are the deliverables. `geometry.json` records the paths and positions; `build-brand.cjs` reproduces the assets and preview illustrations using the existing bundled image renderer. Nothing was installed and no application settings were changed.

This is a refinement candidate for comparison, not a claim of trademark or design clearance.
