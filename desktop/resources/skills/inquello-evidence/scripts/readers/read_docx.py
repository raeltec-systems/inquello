"""Word documents (.docx): numbered paragraphs with the nearest heading.

python-docx gives style names; the body is read from the raw XML inside the
archive, because libraries hide tracked changes and comments, and who changed
what is evidence. The default read is the document as it currently stands
(insertions in, deletions out) with a count of pending changes and comments;
`--changes` shows each insertion and deletion with its author and date.
"""
import re

from .common import Reading, Unreadable, TOOL_UNAVAILABLE, check_size, safe_zip, zip_xml

EXTENSIONS = {'.docx', '.docm'}
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def style_names(path):
    try:
        import docx
    except Exception:
        raise Unreadable(TOOL_UNAVAILABLE)
    try:
        document = docx.Document(path)
    except Exception:
        raise Unreadable('corrupt or unsupported document')
    return {style.style_id: style.name for style in document.styles}


class Walker:
    def __init__(self, changes):
        self.changes = changes
        self.open = {}
        self.closed = {}
        self.pending = 0

    def text(self, element, deleted=False):
        parts = []
        for child in element:
            tag = child.tag
            if tag == W + 'del':
                self.pending += 1
                if self.changes:
                    inner = self.text(child, True)
                    parts.append('[-%s]{deleted by %s %s}' % (inner, child.get(W + 'author', 'unknown'), child.get(W + 'date', '')))
                continue
            if tag == W + 'ins':
                self.pending += 1
                inner = self.text(child, deleted)
                parts.append('[+%s]{inserted by %s %s}' % (inner, child.get(W + 'author', 'unknown'), child.get(W + 'date', '')) if self.changes else inner)
                continue
            if tag == W + 't' or (tag == W + 'delText' and deleted):
                parts.append(child.text or '')
                for anchor in self.open.values():
                    anchor.append(child.text or '')
                continue
            if tag == W + 'tab':
                parts.append('\t')
                continue
            if tag in (W + 'br', W + 'cr'):
                parts.append(' ')
                continue
            if tag == W + 'footnoteReference':
                parts.append('[^%s]' % child.get(W + 'id'))
                continue
            if tag == W + 'commentRangeStart':
                self.open.setdefault(child.get(W + 'id'), [])
                continue
            if tag == W + 'commentRangeEnd':
                self.closed[child.get(W + 'id')] = self.open.pop(child.get(W + 'id'), [])
                continue
            if tag in (W + 'pPr', W + 'rPr', W + 'sectPr', W + 'instrText'):
                continue
            parts.append(self.text(child, deleted))
        return ''.join(parts)


def read(path, changes=False):
    check_size(path)
    archive = safe_zip(path)
    names = style_names(path)
    body_root = zip_xml(archive, 'word/document.xml')
    if body_root is None:
        raise Unreadable('corrupt or not a Word document')
    body = body_root.find(W + 'body')
    reading = Reading('docx')
    walker = Walker(changes)
    state = {'number': 0, 'heading': None, 'table': 0}

    def paragraph(element, prefix=''):
        state['number'] += 1
        style_id = element.find('%spPr/%spStyle' % (W, W))
        style = names.get(style_id.get(W + 'val'), style_id.get(W + 'val')) if style_id is not None else ''
        text = walker.text(element)
        outline = element.find('%spPr/%soutlineLvl' % (W, W))
        heading = bool(style) and (style.lower().startswith('heading') or style == 'Title') or outline is not None
        if heading and text.strip():
            state['heading'] = text.strip()
        label = 'P%d' % state['number']
        shown = ('[%s] ' % style if heading else '') + prefix + text
        reading.add(label, shown, paragraph=state['number'], heading=state['heading'], style=style)

    def block(container):
        for child in container:
            if child.tag == W + 'p':
                paragraph(child)
            elif child.tag == W + 'tbl':
                state['table'] += 1
                table = state['table']
                for row_number, row in enumerate(child.findall(W + 'tr'), 1):
                    for cell_number, cell in enumerate(row.findall(W + 'tc'), 1):
                        for item in cell:
                            if item.tag == W + 'p':
                                paragraph(item, '[table %d, row %d, cell %d] ' % (table, row_number, cell_number))
                            elif item.tag == W + 'tbl':
                                block([item])
            elif child.tag == W + 'sdt':
                content = child.find(W + 'sdtContent')
                if content is not None:
                    block(content)

    block(body if body is not None else [])
    footnotes = zip_xml(archive, 'word/footnotes.xml')
    count_footnotes = 0
    if footnotes is not None:
        for note in footnotes.findall(W + 'footnote'):
            if note.get(W + 'type') in ('separator', 'continuationSeparator', 'continuationNotice'):
                continue
            count_footnotes += 1
            text = ' '.join(Walker(changes).text(p) for p in note.iter(W + 'p')).strip()
            reading.add('F%s' % note.get(W + 'id'), 'footnote %s: %s' % (note.get(W + 'id'), text), footnote=int(note.get(W + 'id')))
    comments = zip_xml(archive, 'word/comments.xml')
    count_comments = 0
    if comments is not None:
        for comment in comments.findall(W + 'comment'):
            count_comments += 1
            identifier = comment.get(W + 'id')
            anchor = re.sub(r'\s+', ' ', ''.join(walker.closed.get(identifier, walker.open.get(identifier, [])))).strip()
            text = ' '.join(Walker(False).text(p) for p in comment.iter(W + 'p')).strip()
            reading.add('C%d' % count_comments, 'comment %d by %s %s on "%s": %s' % (count_comments, comment.get(W + 'author', 'unknown'), comment.get(W + 'date', ''), anchor, text), comment=count_comments)
    reading.counts = {'paragraphs': state['number'], 'tables': state['table'], 'footnotes': count_footnotes,
                      'comments': count_comments, 'pendingChanges': walker.pending}
    reading.notes.append('%d pending tracked changes, %d comments%s' % (walker.pending, count_comments,
                         '' if changes else '; showing the document as it currently stands (use --changes to see them)'))
    archive.close()
    return reading


def select(reading, locator):
    """`P12-P15` paragraphs; `F2` a footnote; `C1` a comment."""
    from .common import span
    kind = locator[:1]
    key = {'P': 'paragraph', 'F': 'footnote', 'C': 'comment'}.get(kind)
    if not key:
        raise ValueError('document locations are paragraph ranges such as P12-P15')
    start, end = span(locator[1:])
    return [line for line in reading.lines if key in line.meta and start <= line.meta[key] <= end]
