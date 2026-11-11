"""Excel workbooks (.xlsx, .xlsm): cells with sheet and address.

The workbook is loaded twice, never written: once for the stored values the
file holds (`data_only=True`) and once for formula text. Stored values are the
evidence; the formula is shown beside its value. Macros are never run.
"""
import datetime
import re

from .common import Reading, Unreadable, TOOL_UNAVAILABLE, check_size, safe_zip

EXTENSIONS = {'.xlsx', '.xlsm'}
LOCATOR = re.compile(r"^(?:'((?:[^']|'')+)'|([^!']+))!([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$")


def column_index(letters):
    value = 0
    for char in letters:
        value = value * 26 + ord(char) - 64
    return value


def show(value):
    if value is None:
        return ''
    if isinstance(value, datetime.datetime):
        return value.date().isoformat() if value.time() == datetime.time(0) else value.isoformat(sep=' ')
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer() and abs(value) < 1e15:
        return str(int(value))
    return str(value)


def sheet_ref(name):
    return name if re.fullmatch(r'[A-Za-z0-9_.]+', name) else "'%s'" % name.replace("'", "''")


def read(path):
    check_size(path)
    safe_zip(path).close()
    try:
        import openpyxl
    except Exception:
        raise Unreadable(TOOL_UNAVAILABLE)
    import warnings
    warnings.simplefilter('ignore')
    try:
        values = openpyxl.load_workbook(path, data_only=True, read_only=False, keep_vba=False, keep_links=False)
        formulas = openpyxl.load_workbook(path, data_only=False, read_only=False, keep_vba=False, keep_links=False)
    except Exception as error:
        if 'encrypt' in str(error).lower() or 'password' in str(error).lower():
            raise Unreadable('password-protected')
        raise Unreadable('corrupt or unsupported workbook')
    reading = Reading('xlsx')
    sheets = {}
    partly = []
    for sheet in values.worksheets:
        name = sheet.title
        try:
            state = sheet.sheet_state
            reading.add('[%s]' % sheet_ref(name), 'sheet %s%s, %d rows x %d columns' % (
                name, ' (hidden)' if state != 'visible' else '', sheet.max_row, sheet.max_column), sheet=name, header=True)
            formula_sheet = formulas[name]
            for merged in sheet.merged_cells.ranges:
                reading.add('%s!%s' % (sheet_ref(name), merged.coord), 'merged cells', sheet=name, merged=True,
                            top=merged.min_row, left=merged.min_col, bottom=merged.max_row, right=merged.max_col)
            rows = 0
            for row in sheet.iter_rows():
                filled = False
                for cell in row:
                    if cell.value is None and formula_sheet.cell(cell.row, cell.column).value is None:
                        continue
                    filled = True
                    stored = show(cell.value)
                    formula = formula_sheet.cell(cell.row, cell.column).value
                    text = stored
                    if isinstance(formula, str) and formula.startswith('='):
                        text = '%s    (formula %s)' % (stored if stored else '[no stored value]', formula)
                    reading.add('%s!%s' % (sheet_ref(name), cell.coordinate), text, sheet=name, row=cell.row,
                                column=cell.column, value=stored)
                if filled:
                    rows += 1
            sheets[name] = {'hidden': state != 'visible', 'rows': sheet.max_row, 'rowsWithValues': rows, 'columns': sheet.max_column}
        except Exception:
            partly.append(name)
    if partly:
        reading.flags['partly'] = partly
        reading.notes.append('sheets not parsed: %s' % ', '.join(partly))
    reading.counts = {'sheets': sheets, 'rows': sum(item['rows'] for item in sheets.values())}
    return reading


def select(reading, locator):
    """`Sheet1!A1:C9` or `'My sheet'!B4`: the cells in that range."""
    match = LOCATOR.match(locator)
    if not match:
        raise ValueError("workbook locations are sheet and cell ranges such as Sheet1!A1:C9")
    sheet = (match.group(1) or '').replace("''", "'") or match.group(2)
    left, top = column_index(match.group(3)), int(match.group(4))
    right, bottom = column_index(match.group(5) or match.group(3)), int(match.group(6) or match.group(4))
    if right < left or bottom < top:
        raise ValueError('invalid cell range')
    if not any(line.meta.get('sheet') == sheet for line in reading.lines):
        raise ValueError('no sheet named %s' % sheet)
    def inside(meta):
        if 'row' in meta:
            return top <= meta['row'] <= bottom and left <= meta['column'] <= right
        if meta.get('merged'):
            return not (meta['bottom'] < top or meta['top'] > bottom or meta['right'] < left or meta['left'] > right)
        return False
    return [line for line in reading.lines if line.meta.get('sheet') == sheet and inside(line.meta)]
