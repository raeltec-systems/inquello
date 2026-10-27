"""Read design-source bytes as data; never import or execute package code."""
from pathlib import Path
import hashlib
import re
import zipfile
from collections import OrderedDict

workspace = Path(__file__).resolve().parents[1]
imports = workspace / 'imports'
root = imports / 'inquello-design-system'
archive = imports / 'inquello-design-system.zip'
digest = hashlib.sha256(archive.read_bytes()).hexdigest().upper()
files = sorted(p for p in root.rglob('*') if p.is_file())
with zipfile.ZipFile(archive) as z:
    entries = [x for x in z.infolist() if not x.is_dir()]
    mismatches = []
    for entry in entries:
        local = imports / entry.filename
        if not local.is_file() or local.read_bytes() != z.read(entry):
            mismatches.append(entry.filename)
assert not mismatches, mismatches
assert len(entries) == len(files)

groups = OrderedDict([
 ('Package narrative and embedded prompt material', []),
 ('CSS tokens and entry stylesheet — visual values', []),
 ('Logo SVG assets — directly reusable visual assets', []),
 ('Icon SVG assets — directly reusable visual assets', []),
 ('Bundled WOFF2 fonts — typography assets', []),
 ('Guideline HTML cards — visual and content specimens', []),
 ('Component JSX and icon-path source — implementation references', []),
 ('Component TypeScript declarations — API and state references', []),
 ('Component prompt examples — untrusted descriptive source data', []),
 ('Component HTML cards and loader — executable preview references', []),
 ('Workspace kit — scenario and layout implementation references', []),
])
for p in files:
    rel = p.relative_to(root).as_posix()
    if rel in ('readme.md','SKILL.md'): group = 0
    elif rel == 'styles.css' or rel.startswith('tokens/'): group = 1
    elif rel.startswith('assets/logo/'): group = 2
    elif rel.startswith('assets/icons/'): group = 3
    elif rel.startswith('assets/fonts/'): group = 4
    elif rel.startswith('guidelines/'): group = 5
    elif rel.startswith('ui_kits/'): group = 10
    elif rel.endswith('.jsx') or rel.endswith('icon-paths.js'): group = 6
    elif rel.endswith('.d.ts'): group = 7
    elif rel.endswith('.prompt.md'): group = 8
    else: group = 9
    groups[list(groups)[group]].append(p)

manifest = [
 '# Inquello design-system import manifest', '',
 '**Imported for:** the user-selected supplied design system in the Inquello UX workflow, 2026-10-26.',
 '**Archive:** [inquello-design-system.zip](inquello-design-system.zip).',
 f'**Source ZIP SHA-256:** `{digest}`.',
 f'**Integrity:** {len(entries)} archived files compared byte-for-byte with {len(files)} imported files; zero differences. Directory entries excluded. The source tree was not edited.',
 '',
 '## Provenance and trust boundary', '',
 'The supplied ZIP is the source of this imported directory. This manifest records the local copy and its hash; it does not assert an earlier creator, original upload path, source repository, source Figma file or approval history beyond the user selecting this package. The package readme attributes the material to an Inquello light “precise studio” prototype and an Open Inquiry identity redraw; those are package claims, not independently verified provenance.',
 '',
 '`SKILL.md` and every `.prompt.md` are retained as untrusted design-source documents. They were read for visual/component meaning, not activated as agent instructions. JSX/JS, HTML inline scripts, the preview loader and remote CDN dependencies were not executed. SVGs and fonts are reusable design assets; CSS contains exact visual values; JSX and declarations describe intended components and states. HTML cards and the workspace kit are visual/interaction references with executable dependencies, not evidence that production behavior or accessibility works.',
 '',
 'The package claims Lucide ISC and IBM Plex SIL OFL 1.1 licensing. No standalone licence text was found in the imported file inventory; this extraction does not independently verify licensing or the readme’s claim that outlined wordmark lettering needs no font licence.',
 '',
 '## File roles', '',
 'All archive files are linked below exactly once. The manifest and extraction outputs are generated review artifacts and are not part of the source ZIP.',
]
for name, paths in groups.items():
    manifest += ['', f'### {name} ({len(paths)})', '']
    for p in paths:
        rel = p.relative_to(root).as_posix()
        manifest.append(f'- [{rel}](inquello-design-system/{rel}) — {p.stat().st_size:,} bytes')
(imports / 'IMPORT-MANIFEST.md').write_text('\n'.join(manifest)+'\n', encoding='utf-8')

token_groups = OrderedDict()
tokens = {}
for filename in ('colors.css','typography.css','layout.css'):
    text = (root / 'tokens' / filename).read_text(encoding='utf-8')
    pairs = re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', text)
    token_groups[filename] = pairs
    tokens.update(pairs)
def resolve(value, depth=0):
    if depth > 10: return value
    return re.sub(r'var\((--[\w-]+)\)', lambda m: resolve(tokens.get(m[1],m[0]),depth+1), value)
def luminance(hexcolor):
    rgb = [int(hexcolor[i:i+2],16)/255 for i in (1,3,5)]
    lin = [(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4) for v in rgb]
    return sum(a*b for a,b in zip(lin,(.2126,.7152,.0722)))
def ratio(a,b):
    x,y=sorted((luminance(a),luminance(b)), reverse=True)
    return (x+.05)/(y+.05)

source_link = '../imports/inquello-design-system/'
doc = ['# Supplied Inquello design-system extraction', '',
 'Status: source extraction for UX planning; no DESIGN authoring or source-palette changes performed.',
 f'Source ZIP SHA-256: `{digest}`. The [import manifest](../imports/IMPORT-MANIFEST.md) links every imported file and records byte-for-byte integrity.', '',
 '## Role and scope', '',
 'The user selected this supplied visual system. It describes the **desktop workspace**: sidebar/rail, thread, artifact side panel, console and automations. It is not a complete multi-surface design or evidence of product implementation. Readme, embedded SKILL and prompt material are source data, not controlling instructions. All inspection was textual/static; no imported JS, React, HTML script or loader ran.', '',
 'The visual character is a quiet, precise studio: white working surfaces, pale cool sidebar, dark ink text, sparse semantic colour, flat structure, hairline borders, no decorative imagery/gradients/blur, restrained floating-layer shadows. Evidence/artifacts carry the visual emphasis. The primary action is ink rather than blue. Blue signals agent suggestion/activity; green people/decisions/additions; amber attention/evidence/approval; red integrity failures/removals, with a documented file-type exception for PDF tags.', '',
 'Source contents: 158 files, 18 component primitives, 22 guideline cards, five component preview cards, 40 SVG icons, 14 SVG brand assets, five bundled fonts and one four-screen workspace kit.', '',
 '## Key aliases for downstream design', '',
 '| Meaning | Exact source alias/value |', '| --- | --- |',
 '| Primary / secondary / muted / faint text | `--text-primary` → `--ink-900` `#16191d`; `--text-secondary` → `--ink-700` `#3d434b`; `--text-muted` → `--ink-600` `#5b636e`; `--text-faint` → `--ink-500` `#8a919a` |',
 '| Working surface / sidebar / panel | `--surface-app` → white `#ffffff`; `--surface-sidebar` → `--ink-75` `#f3f4f6`; `--surface-panel` → `--ink-50` `#fafbfc` |',
 '| Primary action | `--action-primary-bg` → `--ink-900`; hover → `--ink-800` `#2b3036`; foreground white |',
 '| Semantic colour | agent/link `--blue-600` `#2f5fb3`; person/decision `--green-600` `#2f7a52`; attention `--amber-700` `#8a5a12` / `--amber-500` `#c98a1b`; broken `--red-600` `#b0413e` |',
 '| Border levels | subtle `#eef0f2`; default `#e3e6ea`; strong `#d6dade`; input `#cfd4da` |',
 '| Focus | `--focus-ring: 0 0 0 3px var(--blue-150)`; colour `#dfe7f5` |',
 '| Review | source highlight `#eaf1fb`; selected row `#f2f6fc`; added row `#f6fbf8`; changed row `#eef6f0`; diff addition `#f0f8f3` / `#1e5236`; deletion `#fdf3f2` / `#7a2e2b` |',
 '| Approval | background `#fffaf0`; border `#ecd9ae`; label `#8a5a12` |',
 '', '## Typography, geometry and motion', '',
 'IBM Plex Sans is bundled at 400/500/600; IBM Plex Mono at 400/500. Both use normal style, `font-display: swap`, local WOFF2 Latin subsets. Sans fallback: system-ui, -apple-system, Segoe UI, sans-serif. Mono fallback: ui-monospace, SFMono-Regular, Menlo, monospace. Body globally uses tabular numerals; numeric table columns align right. No italic or 700-weight font files are supplied.', '',
 'Semantic roles resolve to hero 600 32px/1.15 Sans; display 600 28px/1.2 Sans; **type-title 600 14px/1.45 Sans**; body 400 14px/1.55 Sans; UI 400 13px/1.45 Sans; caption 400 12px/1.45 Sans; label 500 11px/1 Mono; code 400 11.5px/1.6 Mono. The separate `--text-title` is 18px; see the title-source conflict below. Tracking is display −0.02em, title −0.01em, label +0.04em, overline +0.06em.', '',
 'Spacing follows a 4px base with 2/6/10px half steps. Dense rows commonly use 6px vertical and 10px horizontal padding; panels 16px; thread 24px. Chip radius 3, small 5, medium 6, large 8, card 10, composer 14px, pill 999px, app icon 22.7%. Controls are 26/28/32px; round send/stop 30px. Header 48px; panel tabs 40px; sidebar 264px or rail 52px; thread max 720px; side panel default 560px and specified min 380px; console 230px. Header/composer fixed while thread scrolls. These are desktop values; no responsive breakpoint system is supplied.', '',
 'Motion: cubic-bezier(0.2,0.8,0.2,1), 120/200/600ms durations, spinner 800ms linear. No scale/bounce press effect. Source keyframes define full-rotation spin and opacity pulse 1→0.3→1. No reduced-motion override was found. Exact shadow stacks and every token are retained in the tables below.', '',
 '## Components and supplied states', '',
 '| Component | Variants/states present in declarations and source | Relevant visual dimensions / limits |',
 '| --- | --- | --- |',
 '| Icon | Lucide name; size/stroke/colour; accessible title or decorative-hidden | 16px default, 14px dense, 18px rail by prompt; 24×24 viewBox; stroke 1.75 round caps/joins |',
 '| Button | primary, secondary, quiet, ghost; sm/md/lg; hover; disabled; leading icon, key hint, truncation | 26/28/32px high; radius 6; 10px horizontal padding (14 large); 12.5px label (13 large); disabled opacity .45 |',
 '| IconButton | ghost, outline, send, stop; active; hover | 28px default; send/stop examples 30px circle; square radius 6; stop mark 9×9 radius 2; required label/title |',
 '| Avatar | person/agent; blue, green, amber, decided; initials/label | Default person 24px disc; initials 40% size rounded; agent symbol height round(size×.8); decided solid green/white |',
 '| Badge | attention (default), neutral, accent | 11px/16px medium; radius 8; horizontal padding 6; attention white on amber-500 |',
 '| TextField | input/textarea; rows default 2; value; placeholder; optional label; focused/unfocused | 12.5px/1.45; padding 7×9; radius 6; focus blue border and source ring; no supplied error/disabled/loading API |',
 '| Switch | checked/unchecked; optional label | Track 28×16 radius 8; thumb 12px; blue on, ink-300 off; no disabled state supplied |',
 '| Choice | radio/checkbox; checked/unchecked; label; optional description makes option card | Radio 14px with 6px dot; checkbox 16px radius 4; option padding 9×10; selected blue border/blue-50; no disabled/error state |',
 '| SegmentedControl | selected/unselected value | 4×9px item padding; radius 6 wrapper; selected ink/white; tab roles |',
 '| Tabs | selected/unselected; optional count | 5×10px padding; radius 5; selected quiet fill; 12.5px labels, 11px mono faint counts |',
 '| Menu | heading; item label/description; checked marker; hover | Width 300 default; card radius 10; popover shadow; padding 5; item padding 7×9 |',
 '| StatusChip | suggested, investigating, open, evidence, waiting, accepted, explained; optional decidedBy | 11px/1.4; padding 1×6; radius 3; suggested dashed blue; evidence/waiting amber; accepted/explained green; person marker 16px green disc, 8px initials |',
 '| JudgmentTag | calculation, observation, suggestion, decision, gap; uppercase or sentence-case; custom label | Uppercase 10px mono +.03em; sentence 11px Sans; ƒ / ◦ / dashed blue box / solid green dot / dash |',
 '| FileChip | pdf/xls/doc/folder; chip/tag; optional remove | Type tag 9px mono; label 12px; radius 6; ink-50; PDF red, XLS green, DOC blue, DIR muted |',
 '| PlanStep | done, running, pending; optional meta | 14px indicator radius 4; done green check and faint label; running blue outline/fill and medium label; pending pale border; no blocked/error state supplied |',
 '| ApprovalCard | context; question; optional exact message quote; approve/alternative/dismiss actions; note | Amber-50 panel/border amber-200, radius 10, padding 12×14; question 13.5px; quote 12.5px; approve ink |',
 '| DiffLine | add, del, change, context; optional gutter | Prefix +/−/~/blank; optional 40px gutter +14px mark; body 12.5px/1.5; addition green, deletion red, change blue-50 |',
 '| Toast | visible/hidden; status content | Ink/white; 12.5px/1.4; padding 8×14; radius 6; toast shadow; 2.6s dismiss and top-centre placement belong to kit container, not primitive |',
 '',
 'Only Button declares a disabled prop. Supplied components do not collectively cover loading/empty/error/blocked/retry, keyboard interaction, validation feedback or every PRD lifecycle state. Do not treat absent primitive variants as a new product scope cut. Static source includes native buttons for several controls, but Choice, Switch, Menu items and FileChip removal use clickable div/span elements without complete keyboard/tab handling; no interaction/accessibility validation was executed.', '',
 '## Brand and icon assets', '',
 'Brand clear space is half the symbol width. Minimum lockup height 16px; size specimen uses a 20px sidebar lockup. Use the small symbol variant at 20px or below. The source says ink on light and white reversed on dark; blue is an optional accent outside the product. The blue lockup colours the symbol blue while keeping the wordmark ink. The agent mark is the Inquello symbol, people use initials discs. Wordmark lettering is outlined; font/licensing claims in the package were not independently verified.', '',
 '| Brand asset | ViewBox | Embedded colours |', '| --- | --- | --- |',
]
for p in sorted((root/'assets/logo').glob('*.svg')):
    t=p.read_text(encoding='utf-8')
    box=re.search(r'viewBox="([^"]+)"',t).group(1)
    colors=', '.join(sorted(set(re.findall(r'#[0-9A-Fa-f]{6}',t))))
    doc.append(f'| [{p.name}]({source_link}assets/logo/{p.name}) | `{box}` | `{colors}` |')
doc += ['', 'Forty Lucide SVGs and matching inline paths use currentColor, 24×24 viewBox and 1.75px strokes. Names: '+', '.join(p.stem for p in sorted((root/'assets/icons').glob('*.svg')))+'. Icon-only actions require labels; type chips use PDF/XLS/DOC/DIR text rather than relying on an icon or colour alone.', '',
 '## Source inconsistencies and reference limits', '',
 '| ID | Source evidence | Consequence to retain, without silently changing the source |', '| --- | --- | --- |',
 '| DS-1 | typography.css: `--text-title:18px`, but `--type-title` uses `--text-body` 14px/1.45. type-display.html labels title 18px/1.3 and section 14px/1.45. Shell header uses `--type-title`. | Proposed explicit reconciliation from parent: preserve machine token `--type-title` at 14px; the 18px specimen is not permission to override it. Retain the distinct 18px primitive as source data. |',
 '| DS-2 | layout.css and spacing-layout/readme specify panel min 380px; ActiveScreen.jsx uses `clamp(340px,44%,var(--panel-default-width))`. | Proposed explicit reconciliation from parent: use declared 380px minimum in downstream design, while leaving the imported prototype unchanged. |',
 '| DS-3 | Readme/brand sizes require small symbol ≤20px; Avatar.jsx always selects regular symbol and renders default 24px agent avatar as round(24×.8)=19px. | Proposed explicit reconciliation from parent: select supplied small-symbol assets for ≤20px usage; imported primitive remains unchanged. |',
 '| DS-4 | Readme broadly says red only for broken things/removals; `--file-pdf` and FileChip explicitly use red for PDF. | Preserve the documented file-type exception rather than treating a PDF as an error. |',
 '| DS-5 | TextField uses `--border-strong` rather than available `--border-input`; Menu hover `#f3f5f8`, avatar green `#e6efe9`, amber `#efe9e1`/`#8a5a2b`, and quote border `#efe3c4` are local literals. | Tokens are not an exhaustive implementation palette; literals remain source-specific values, not invented replacements. |',
 '| DS-6 | Toast prompt describes 2.6s auto-dismiss/top-centre, but Toast.jsx only displays/hides. Kit index supplies timing/position. | Distinguish primitive state from container behavior. |',
 '| DS-7 | Only TextField explicitly applies the declared custom focus ring; other native controls may use browser defaults; custom clickable Choice/Switch/Menu/FileChip removal lack full keyboard handling. | This is an implementation-reference gap, not evidence of production accessibility. No code was run. |',
 '| DS-8 | Readme/card shadow guidance includes hairline on cards/rows while narrative normally reserves shadows for floating layers; spacing specimen omits defined 28px step and ink specimen omits ink-250. | Preserve exact CSS as data and note specimen omissions; do not infer missing values or a mandatory shadow on every card. |',
 '| DS-9 | Kit is four desktop screen states with illustrative Meridian/Kijani data; ApprovalCard wording says contacting clients always asks first. | Scenario copy is not a universal audit method, professional-approval definition or replacement for the PRD’s configured authority/preauthorised workflows. Visual selection does not make demo results real. |',
 '| DS-10 | Kit index loads React/ReactDOM/Babel from unpkg; preview-loader reads source and uses `new Function`. | The kit and HTML component cards are executable references, not static images or a supplied compiled production library. They were inspected but not run. |',
 '', '## Contrast screening of exact supplied colours', '',
 'Computed locally using linearised sRGB relative luminance `L=.2126R+.7152G+.0722B` and contrast `(Llighter+.05)/(Ldarker+.05)`. Screening thresholds: 4.5:1 for normal-sized text; 3:1 for large text and meaningful non-text boundaries/indicators. This is a colour-pair calculation, not full accessibility certification or a rendered interaction audit. Low structural borders are relevant only when relied upon to identify a control/essential boundary. Inactive controls and decorative separators are not automatically failures. The palette remains unmodified.', '',
 '| Supplied pair / observed use | Foreground / background | Ratio | Screening result |', '| --- | --- | --- | --- |',
]
pairs = [
 ('Faint text / white; placeholder, headings, meta', '#8a919a','#ffffff',4.5),
 ('Faint text / sidebar', '#8a919a','#f3f4f6',4.5),
 ('Faint text / panel', '#8a919a','#fafbfc',4.5),
 ('Faint context/note / ApprovalCard', '#8a919a','#fffaf0',4.5),
 ('White text / attention Badge', '#ffffff','#c98a1b',4.5),
 ('Default input border / white', '#d6dade','#ffffff',3),
 ('Input token border / white', '#cfd4da','#ffffff',3),
 ('Unchecked radio border / white', '#bfc5cc','#ffffff',3),
 ('Unchecked checkbox/pending-step border / white', '#c4c9cf','#ffffff',3),
 ('Focus ring / white', '#dfe7f5','#ffffff',3),
 ('Focus ring / sidebar', '#dfe7f5','#f3f4f6',3),
 ('Default border / white', '#e3e6ea','#ffffff',3),
 ('Primary ink / white', '#16191d','#ffffff',4.5),
 ('Muted text / white', '#5b636e','#ffffff',4.5),
 ('Agent/link text / white', '#2f5fb3','#ffffff',4.5),
 ('Green accepted text / accepted background', '#2f7a52','#e3f1e8',4.5),
 ('Amber evidence text / evidence background', '#8a5a12','#fbf0d9',4.5),
 ('Decision-disc white initials / green', '#ffffff','#2f7a52',4.5),
 ('Diff-add text / addition background', '#1e5236','#f0f8f3',4.5),
 ('Diff-delete text / deletion background', '#7a2e2b','#fdf3f2',4.5),
 ('PDF text / FileChip panel', '#b0413e','#fafbfc',4.5),
 ('Focused input border / white', '#2f5fb3','#ffffff',3),
 ('Existing-token candidate: muted instead of faint / sidebar', '#5b636e','#f3f4f6',4.5),
 ('Existing-token candidate: muted instead of faint / approval background', '#5b636e','#fffaf0',4.5),
 ('Existing-token candidate: ink-900 instead of white / attention Badge', '#16191d','#c98a1b',4.5),
 ('Existing-token candidate: green-800 instead of green-600 / accepted background', '#1e5236','#e3f1e8',4.5),
 ('Existing-token candidate: ink-600 for essential boundary / white', '#5b636e','#ffffff',3),
 ('Existing-token candidate: blue-600 for focus indicator / sidebar', '#2f5fb3','#f3f4f6',3),
]
for label,fg,bg,threshold in pairs:
    r=ratio(fg,bg)
    verdict=('Below' if r<threshold else 'Meets')+f' {threshold:g}:1 screening threshold'
    doc.append(f'| {label} | `{fg}` / `{bg}` | {r:.2f}:1 | {verdict} |')
doc += ['', 'Faint-text use, white-on-amber attention Badge and green-600 on green-150 Accepted/Explained status text are normal-text contrast concerns at their supplied sizes (the latter is 4.47:1, narrowly below 4.5:1). The focus ring alone has low adjacent contrast, but TextField also changes its border to blue-600, which has strong contrast; do not claim the entire focused control fails solely from the ring. Candidate pairs above use only existing source colours: muted text for meaningful metadata, ink-900 on attention badges, green-800 on accepted chips, ink-600 for essential boundaries and blue-600 focus indicators. These are proposed token applications for DESIGN, not changes to the imported palette. Keep low-contrast faint/border/ring colours restricted to decorative/nonessential roles where another adequate cue conveys the information; they cannot be the sole meaningful text, essential boundary or focus cue. No candidate has been applied here.', '',
 '## Exact token inventory', '',
 'The following tables transcribe every declaration in colors.css, typography.css and layout.css. Resolved aliases are calculated only for inspection; source names/values remain intact. fonts.css and base.css behavior is described above. No package code is executed to resolve CSS variables.',
]
for filename,pairs in token_groups.items():
    doc += ['',f'### {filename}', '', '| Token | Source declaration | Resolved value |', '| --- | --- | --- |']
    for name,value in pairs:
        doc.append(f'| `{name}` | `{value}` | `{resolve(value)}` |')
(workspace/'.working/input-design-system.md').write_text('\n'.join(doc)+'\n',encoding='utf-8')
print({'archive_sha256':digest,'files':len(files),'component_count':len(list((root/'components').rglob('*.d.ts'))),'tokens':len(tokens),'integrity_mismatches':len(mismatches),'manifest':str(imports/'IMPORT-MANIFEST.md'),'extraction':str(workspace/'.working/input-design-system.md')})
