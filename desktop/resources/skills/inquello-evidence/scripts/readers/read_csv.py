"""CSV and TSV exports: records numbered R1 (the header row), R2, ... ."""
import csv
import io

from .common import Line, Reading, check_size, span
from .read_text import decode

EXTENSIONS = {'.csv', '.tsv'}


def read(path):
    check_size(path)
    with open(path, 'rb') as source:
        text, encoding = decode(source.read())
    delimiter = '\t' if path.lower().endswith('.tsv') else ','
    if delimiter == ',':
        try:
            delimiter = csv.Sniffer().sniff(text[:8192], delimiters=',;\t|').delimiter
        except csv.Error:
            delimiter = ','
    csv.field_size_limit(16 * 1024 * 1024)
    reader = csv.reader(io.StringIO(text, newline=''), delimiter=delimiter)
    reading = Reading('csv', notes=['encoding %s' % encoding, 'delimiter %r' % delimiter])
    header = None
    count = 0
    for number, row in enumerate(reader, 1):
        count = number
        if number == 1:
            header = row
            reading.add('R1', ' | '.join(row), row=1, header=True)
        else:
            reading.add('R%d' % number, ' | '.join(row), row=number)
    reading.counts = {'rows': max(count - 1, 0), 'records': count}
    reading.flags['header'] = header or []
    return reading


def select(reading, locator):
    """`R2-R9`: records 2 to 9; the header row (R1) always comes with them."""
    if not locator.startswith('R'):
        raise ValueError('CSV locations are row ranges such as R2-R9')
    start, end = span(locator[1:])
    rows = [line for line in reading.lines if start <= line.meta['row'] <= end]
    header = [Line(line.label, line.text, dict(line.meta, context=True)) for line in reading.lines if line.meta.get('header')]
    return (header if start > 1 else []) + rows
