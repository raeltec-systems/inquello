"""Legacy Excel workbooks (.xls) through xlrd: stored values with sheet and address.

xlrd exposes stored values only, not formula text; that is stated in the notes.
"""
from .common import Reading, Unreadable, TOOL_UNAVAILABLE, check_size
from .read_xlsx import sheet_ref, select  # noqa: F401  (same locator form as .xlsx)

EXTENSIONS = {'.xls'}


def address(row, column):
    letters = ''
    column += 1
    while column:
        column, rest = divmod(column - 1, 26)
        letters = chr(65 + rest) + letters
    return '%s%d' % (letters, row + 1)


def read(path):
    check_size(path)
    try:
        import xlrd
    except Exception:
        raise Unreadable(TOOL_UNAVAILABLE)
    try:
        book = xlrd.open_workbook(path, formatting_info=True, on_demand=True)
    except Exception as error:
        text = str(error).lower()
        if 'encrypt' in text or 'password' in text or 'filepass' in text:
            raise Unreadable('password-protected')
        raise Unreadable('corrupt or unsupported workbook')
    reading = Reading('xls', notes=['legacy workbook: stored values only; formula text is not available in this format'])
    sheets = {}
    partly = []
    for index in range(book.nsheets):
        try:
            sheet = book.sheet_by_index(index)
            name = sheet.name
            hidden = getattr(sheet, 'visibility', 0) != 0
            reading.add('[%s]' % sheet_ref(name), 'sheet %s%s, %d rows x %d columns' % (
                name, ' (hidden)' if hidden else '', sheet.nrows, sheet.ncols), sheet=name, header=True)
            for (top, bottom, left, right) in getattr(sheet, 'merged_cells', []):
                reading.add('%s!%s:%s' % (sheet_ref(name), address(top, left), address(bottom - 1, right - 1)), 'merged cells', sheet=name, merged=True,
                            top=top + 1, left=left + 1, bottom=bottom, right=right)
            rows = 0
            for row in range(sheet.nrows):
                filled = False
                for column in range(sheet.ncols):
                    cell = sheet.cell(row, column)
                    if cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                        continue
                    filled = True
                    value = cell.value
                    if cell.ctype == xlrd.XL_CELL_DATE:
                        moment = xlrd.xldate.xldate_as_datetime(value, book.datemode)
                        text = moment.date().isoformat() if moment.time().isoformat() == '00:00:00' else moment.isoformat(sep=' ')
                    elif cell.ctype == xlrd.XL_CELL_NUMBER and float(value).is_integer():
                        text = str(int(value))
                    elif cell.ctype == xlrd.XL_CELL_BOOLEAN:
                        text = 'TRUE' if value else 'FALSE'
                    elif cell.ctype == xlrd.XL_CELL_ERROR:
                        text = xlrd.error_text_from_code.get(value, '#ERROR')
                    else:
                        text = str(value)
                    reading.add('%s!%s' % (sheet_ref(name), address(row, column)), text, sheet=name, row=row + 1, column=column + 1, value=text)
                if filled:
                    rows += 1
            sheets[name] = {'hidden': hidden, 'rows': sheet.nrows, 'rowsWithValues': rows, 'columns': sheet.ncols}
            book.unload_sheet(index)
        except Exception:
            partly.append(str(index + 1))
    if partly:
        reading.flags['partly'] = partly
        reading.notes.append('sheets not parsed: %s' % ', '.join(partly))
    reading.counts = {'sheets': sheets, 'rows': sum(item['rows'] for item in sheets.values())}
    return reading
