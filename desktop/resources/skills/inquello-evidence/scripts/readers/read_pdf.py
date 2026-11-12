"""PDF: every page, located by page and line (PG4:L3-L8).

Started from OpenAI's `pdf` skill (Apache-2.0, see LICENSE.txt and ORIGIN.md):
Poppler first. A page with a text layer is extracted with `pdftotext -layout`
so table columns stay aligned (pdfminer is the fallback when Poppler is
absent). A page without one is rendered with `pdftoppm` and read by Tesseract;
that text is labelled "recognised text (OCR)". A password-protected PDF, or a
page where OCR finds nothing, is reported, never guessed.
"""
import re

from .common import OCR_LABEL, Reading, Unreadable, TOOL_UNAVAILABLE, check_size, run, span, tool

EXTENSIONS = {'.pdf'}
# A page whose text layer has fewer non-whitespace characters than this is also read by OCR.
SPARSE_TEXT = 40


def info(path):
    if tool('pdfinfo'):
        code, out, err = run(['pdfinfo', path])
        text = out.decode('utf-8', 'replace')
        if code != 0:
            if 'password' in (err + text).lower() or 'incorrect' in err.lower():
                raise Unreadable('password-protected')
            raise Unreadable('corrupt or unsupported PDF')
        pages = re.search(r'^Pages:\s+(\d+)', text, re.M)
        encrypted = re.search(r'^Encrypted:\s+yes', text, re.M)
        return counted(int(pages.group(1)) if pages else 0), bool(encrypted)
    try:
        import pypdf
    except Exception:
        raise Unreadable(TOOL_UNAVAILABLE)
    try:
        document = pypdf.PdfReader(path)
        if document.is_encrypted and not document.decrypt(''):
            raise Unreadable('password-protected')
        return counted(len(document.pages)), document.is_encrypted
    except Unreadable:
        raise
    except Exception:
        raise Unreadable('corrupt or unsupported PDF')


def counted(pages):
    """A PDF with no pages has nothing to read; it is never listed as readable."""
    if pages < 1:
        raise Unreadable('no pages found; corrupt or unsupported PDF')
    return pages


def page_text(path, number):
    if tool('pdftotext'):
        code, out, err = run(['pdftotext', '-layout', '-enc', 'UTF-8', '-f', str(number), '-l', str(number), path, '-'])
        if code != 0:
            raise Unreadable('page %d could not be extracted' % number)
        return out.decode('utf-8', 'replace')
    try:
        from pdfminer.high_level import extract_text
    except Exception:
        raise Unreadable(TOOL_UNAVAILABLE)
    return extract_text(path, page_numbers=[number - 1])


def ocr_page(path, number):
    if not (tool('pdftoppm') and tool('tesseract')):
        return None
    code, image, err = run(['pdftoppm', '-r', '300', '-gray', '-png', '-singlefile', '-f', str(number), '-l', str(number), path])
    if code != 0 or not image:
        return None
    code, out, err = run(['tesseract', 'stdin', 'stdout', '-l', 'eng', '--psm', '4'], input_bytes=image)
    if code != 0:
        return None
    return out.decode('utf-8', 'replace')


def clean(text):
    lines = text.replace('\f', '').split('\n')
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def read(path):
    check_size(path)
    pages, encrypted = info(path)
    reading = Reading('pdf')
    ocr_pages = []
    empty_pages = []
    for number in range(1, pages + 1):
        text = page_text(path, number)
        ocr = False
        if text.strip() and len(re.sub(r'\s', '', text)) < SPARSE_TEXT:
            # A scanned page often carries a small text layer (a Bates number, a stamp, a footer). It is read by OCR as
            # well: the text-layer lines come first, then the recognised lines, labelled as OCR.
            layer = clean(text)
            recognised = ocr_page(path, number)
            extra = clean(recognised) if recognised and recognised.strip() else []
            if extra:
                ocr_pages.append(number)
            reading.add('PG%d' % number, 'page %d%s' % (number, ' - text layer, then %s' % OCR_LABEL if extra else ''), page=number, header=True)
            for line_number, line in enumerate(layer + extra, 1):
                reading.add('PG%d:L%d' % (number, line_number), line, page=number, line=line_number, ocr=line_number > len(layer))
            continue
        if not text.strip():
            recognised = ocr_page(path, number)
            if recognised is None:
                empty_pages.append(number)
                reading.add('PG%d' % number, 'page %d: no text layer and OCR is unavailable (%s)' % (number, TOOL_UNAVAILABLE), page=number, header=True)
                continue
            text = recognised
            ocr = True
            if not text.strip():
                empty_pages.append(number)
                reading.add('PG%d' % number, 'page %d: no recognisable text' % number, page=number, header=True)
                continue
            ocr_pages.append(number)
        reading.add('PG%d' % number, 'page %d%s' % (number, ' - %s' % OCR_LABEL if ocr else ''), page=number, header=True)
        for line_number, line in enumerate(clean(text), 1):
            reading.add('PG%d:L%d' % (number, line_number), line, page=number, line=line_number, ocr=ocr)
    reading.counts = {'pages': pages, 'ocrPages': ocr_pages, 'pagesWithoutText': empty_pages}
    if ocr_pages:
        reading.notes.append('pages %s are %s' % (', '.join(map(str, ocr_pages)), OCR_LABEL))
        reading.flags['ocr'] = True
    if empty_pages:
        reading.flags['partly'] = ['page %d' % page for page in empty_pages]
    if encrypted:
        reading.notes.append('the PDF is encrypted without a user password; text was read with the permissions it grants')
    return reading


def select(reading, locator):
    """`PG4:L3-L8` lines 3 to 8 of page 4; `PG4` the whole page."""
    match = re.fullmatch(r'PG(\d+)(?::L(\d+(?:-L?\d+)?))?', locator)
    if not match:
        raise ValueError('PDF locations are pages and lines such as PG4:L3-L8')
    page = int(match.group(1))
    if match.group(2):
        start, end = span(match.group(2).replace('L', ''))
        return [line for line in reading.lines if line.meta.get('page') == page and 'line' in line.meta and start <= line.meta['line'] <= end]
    return [line for line in reading.lines if line.meta.get('page') == page and 'line' in line.meta]
