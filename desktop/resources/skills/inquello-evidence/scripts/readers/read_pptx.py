"""PowerPoint decks (.pptx): slides numbered S1, S2, ... in presentation order.

Read with the standard library from the archive's XML (Ubuntu does not package
python-pptx): the slide title, body text, table cells and the speaker notes,
which are labelled as notes.
"""
import posixpath

from .common import Reading, Unreadable, check_size, safe_zip, span, zip_xml

EXTENSIONS = {'.pptx', '.pptm'}
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'


def relationships(archive, part):
    folder, name = posixpath.split(part)
    root = zip_xml(archive, posixpath.join(folder, '_rels', name + '.rels'))
    result = {}
    if root is None:
        return result
    for item in root.findall(REL + 'Relationship'):
        target = item.get('Target', '')
        if item.get('TargetMode') == 'External':
            continue
        result[item.get('Id')] = (item.get('Type', ''), posixpath.normpath(posixpath.join(folder, target)))
    return result


def paragraphs(element):
    lines = []
    for paragraph in element.iter(A + 'p'):
        text = ''.join((run.text or '') for run in paragraph.iter(A + 't'))
        if text.strip():
            lines.append(text)
    return lines


def shapes(slide):
    """(kind, text) for each text shape, in document order."""
    found = []
    for shape in slide.iter(P + 'sp'):
        placeholder = shape.find('%snvSpPr/%snvPr/%sph' % (P, P, P))
        kind = placeholder.get('type', 'body') if placeholder is not None else 'text'
        body = shape.find(P + 'txBody')
        if body is not None:
            found.append((kind, paragraphs(body)))
    for frame in slide.iter(P + 'graphicFrame'):
        for row_number, row in enumerate(frame.iter(A + 'tr'), 1):
            for cell_number, cell in enumerate(row.findall(A + 'tc'), 1):
                text = ' '.join(paragraphs(cell))
                if text:
                    found.append(('table', ['[table row %d, cell %d] %s' % (row_number, cell_number, text)]))
    return found


def read(path):
    check_size(path)
    archive = safe_zip(path)
    presentation = zip_xml(archive, 'ppt/presentation.xml')
    if presentation is None:
        raise Unreadable('corrupt or not a PowerPoint file')
    rels = relationships(archive, 'ppt/presentation.xml')
    reading = Reading('pptx')
    order = presentation.find(P + 'sldIdLst')
    notes_count = 0
    number = 0
    for entry in (order if order is not None else []):
        number += 1
        target = rels.get(entry.get(R + 'id'))
        if not target:
            reading.flags.setdefault('partly', []).append('slide %d' % number)
            continue
        slide = zip_xml(archive, target[1])
        if slide is None:
            reading.flags.setdefault('partly', []).append('slide %d' % number)
            continue
        hidden = slide.get('show') == '0'
        title = None
        lines = []
        for kind, texts in shapes(slide):
            if kind in ('title', 'ctrTitle') and title is None:
                title = ' '.join(texts)
            elif kind not in ('sldNum', 'dt', 'ftr'):
                lines.extend(texts)
        reading.add('S%d' % number, 'slide %d%s: %s' % (number, ' (hidden)' if hidden else '', title or '[no title placeholder]'), slide=number, title=True)
        for text in lines:
            reading.add('S%d' % number, text, slide=number)
        for kind, part in relationships(archive, target[1]).values():
            if kind.endswith('/notesSlide'):
                notes = zip_xml(archive, part)
                if notes is None:
                    continue
                for kind_note, texts in shapes(notes):
                    # Notes are the notes body placeholder, or any free text box on the
                    # notes page; never the slide image, number, header or footer.
                    if kind_note not in ('sldImg', 'sldNum', 'hdr', 'ftr', 'dt') and texts:
                        notes_count += 1
                        for text in texts:
                            reading.add('S%d' % number, 'notes: %s' % text, slide=number, notes=True)
    reading.counts = {'slides': number, 'slidesWithNotes': notes_count}
    archive.close()
    return reading


def select(reading, locator):
    """`S3`: slide 3 (title, body, tables and notes); `S2-S4` a slide range."""
    if not locator.startswith('S'):
        raise ValueError('slide locations are slide numbers such as S3')
    start, end = span(locator[1:])
    return [line for line in reading.lines if start <= line.meta['slide'] <= end]
