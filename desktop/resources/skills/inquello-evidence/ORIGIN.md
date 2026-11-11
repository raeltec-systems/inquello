# Origin

The PDF reading workflow in this skill (`reference/pdf.md`, `scripts/readers/read_pdf.py`)
starts from OpenAI's `pdf` skill in `openai/skills`, path `skills/.curated/pdf`, commit
`77963424cd7687fd52e5fcfdd3f08d826ab9b1ab`, licensed under the Apache License 2.0
(`LICENSE.txt`, copied unchanged from that folder).

Changes made by Inquello (2026-11-11):

- Reading only. The creation workflow (`reportlab`) and the visual-review loop for generated
  PDFs were removed; nothing here writes a PDF.
- No installation at run time. The `pip`/`uv`/`apt-get` instructions were removed; the tools are
  part of the sandbox image's declared package list (`poppler-utils`, `tesseract-ocr`,
  `python3-pypdf`, `python3-pdfminer`).
- `pdfplumber` (not packaged by Ubuntu 24.04) was replaced by Poppler's `pdftotext -layout`, with
  `pdfminer` as the fallback; `pypdf` is used only to detect encryption when Poppler is absent.
- Rendering with `pdftoppm` is kept, but the rendered page is read by Tesseract OCR in the sandbox
  rather than looked at by the model, and the recognised text is labelled as OCR.
- Every page is read and every line is numbered, so a statement can cite `PG4:L3-L8`.

Everything else in this folder (the other readers, `SKILL.md`, the other references) was
written for Inquello. Its structure follows the published Codex document skills (a short
`SKILL.md` with a quick-reference table, one reference file per format, helper scripts), learned
from and not copied.
