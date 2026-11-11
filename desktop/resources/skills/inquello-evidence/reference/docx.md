# Word documents (.docx, .doc)

- Paragraphs are numbered in reading order: `P1`, `P2`, ... Table cells are paragraphs too and
  carry `[table 1, row 2, cell 1]`. Headings show their style, for example `[Heading 2]`; when
  citing, name the nearest heading so a reviewer can find the passage.
- Footnotes are `F1`, `F2` (their reference appears in the paragraph as `[^1]`). Comments are
  `C1`, `C2`, with author, date and the text they are attached to.
- The default read is the document as it currently stands: tracked insertions are included,
  tracked deletions are left out, and a note gives the number of pending changes and comments.
- `read attached/<file>.docx --changes` shows each change: `[+text]{inserted by A. Auditor <date>}`
  and `[-text]{deleted by ...}`. Who changed what is evidence; report it when it matters.
- Legacy `.doc` files are converted to a temporary `.docx` under `.inquello-work/converted/` with macros disabled;
  the reading says "converted from legacy format". If conversion fails, report the file as not read.
