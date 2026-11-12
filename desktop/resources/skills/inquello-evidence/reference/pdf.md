# PDF

Adapted from OpenAI's `pdf` skill (Apache-2.0; see `../ORIGIN.md`).

1. `evidence.py inventory attached` gives the page count, or "password-protected".
2. `evidence.py read attached/<file>.pdf` reads every page. A page with a text layer comes from
   Poppler's `pdftotext -layout`, so table columns stay aligned on one line. A page without a
   text layer is rendered with `pdftoppm` (300 dpi, greyscale) and read by Tesseract; its header
   line says "recognised text (OCR)".
3. Cite `PG<page>:L<first>-L<last>`. Line numbers count every line of that page's output,
   including blank lines.

Notes:

- A mixed PDF is handled page by page; only scanned pages are OCR. A page whose text layer is tiny
  (under 40 characters, such as a Bates number or stamp on a scan) is also read by OCR: its
  text-layer lines come first, then the recognised lines.
- A page where OCR finds nothing is listed as "no recognisable text". Never guess its content.
- A password-protected PDF is not read. Say so; do not try passwords.
- Layout extraction can split a table cell across lines; quote the part on one line.
- Charts, stamps, signatures and handwriting are not interpreted.
