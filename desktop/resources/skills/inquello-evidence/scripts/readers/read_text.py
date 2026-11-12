"""Plain text, Markdown, JSON, XML, logs and similar: numbered lines (L1, L2, ...)."""
from .common import Reading, Unreadable, check_size

EXTENSIONS = {'.txt', '.md', '.markdown', '.json', '.xml', '.log', '.yaml', '.yml', '.ini', '.cfg', '.html', '.htm', '.sql', '.eml'}


def decode(data):
    if data.startswith(b'\xef\xbb\xbf'):
        data = data[3:]
    if b'\x00' in data[:8192]:
        raise Unreadable('binary content; not a text file')
    try:
        return data.decode('utf-8'), 'utf-8'
    except UnicodeDecodeError:
        return data.decode('cp1252', 'replace'), 'cp1252'


def read(path):
    check_size(path)
    with open(path, 'rb') as source:
        text, encoding = decode(source.read())
    reading = Reading('text', notes=['encoding %s' % encoding])
    # Lines end only at \n, \r\n or \r; form feeds and other separators stay inside a line, so numbers match editors.
    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    if lines and lines[-1] == '':
        lines.pop()
    for number, line in enumerate(lines, 1):
        reading.add('L%d' % number, line, line=number)
    reading.counts = {'lines': len(lines)}
    return reading


def select(reading, locator):
    """`L10-L14`: lines 10 to 14."""
    from .common import span
    if not locator.startswith('L'):
        raise ValueError('text locations are line ranges such as L10-L14')
    start, end = span(locator[1:])
    return [line for line in reading.lines if start <= line.meta['line'] <= end]
