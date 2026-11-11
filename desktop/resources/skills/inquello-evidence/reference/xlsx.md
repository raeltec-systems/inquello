# Workbooks (.xlsx, .xlsm, .xls)

- The inventory lists every sheet with its row count, and marks hidden sheets "(hidden)". Hidden
  sheets are read too; say when you rely on one.
- `read` loads the workbook twice and never writes it: once for the stored values, once for the
  formula text. A formula cell reads `12346    (formula =SUM(C3:C7))`. The stored value is the
  evidence; if a formula has "[no stored value]", say the value was not stored rather than
  computing it silently.
- Dates are shown as ISO dates (`2026-01-15`). Numbers are shown as stored, without formatting.
- Merged ranges appear as `Sheet!A1:D1: merged cells`; the value sits in the top-left cell.
- Cite cells as `Sheet1!B4` or a range `Sheet1!A3:D7`; quote sheet names with spaces:
  `'Reviewer notes'!A1`.
- Legacy `.xls` gives stored values only; formula text is not available in that format.
- To total or filter a column, read the range, then compute with a short Python command and give
  the command with the figure (it is computed, not quoted). Coverage: say how many rows you read
  out of the rows present.
