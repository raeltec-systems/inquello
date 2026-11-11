"""Images (PNG, JPEG, TIFF, GIF, BMP, WebP): type and size, and OCR text by line.

Recognised text is labelled "recognised text (OCR)". An image without text is
citable only as a whole file, and the reading says its content was not read:
stamps, signatures, handwriting and charts are not interpreted here.
"""
from .common import OCR_LABEL, Reading, Unreadable, TOOL_UNAVAILABLE, check_size, run, span, tool

EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.gif', '.bmp', '.webp'}


def read(path):
    check_size(path)
    try:
        from PIL import Image
    except Exception:
        raise Unreadable(TOOL_UNAVAILABLE)
    Image.MAX_IMAGE_PIXELS = 100_000_000
    try:
        with Image.open(path) as image:
            kind, width, height = image.format, image.width, image.height
            frames = getattr(image, 'n_frames', 1)
            image.verify()
    except Image.DecompressionBombError:
        raise Unreadable('image over the size bound')
    except Exception:
        raise Unreadable('corrupt or unsupported image')
    reading = Reading('image', counts={'width': width, 'height': height, 'frames': frames, 'format': kind})
    reading.add('IMG', 'image %s, %d x %d pixels%s' % (kind, width, height, ', %d frames (first frame read)' % frames if frames > 1 else ''), header=True)
    if not tool('tesseract'):
        reading.notes.append('text not read: %s' % TOOL_UNAVAILABLE)
        reading.flags['partly'] = ['OCR']
        return reading
    code, out, err = run(['tesseract', path, 'stdout', '-l', 'eng', '--psm', '4'])
    lines = out.decode('utf-8', 'replace').replace('\f', '').split('\n') if code == 0 else []
    while lines and not lines[-1].strip():
        lines.pop()
    if not any(line.strip() for line in lines):
        reading.notes.append('no recognisable text; the image can be cited only as a whole file and its content was not read')
        reading.flags['noText'] = True
        return reading
    reading.notes.append('text below is %s' % OCR_LABEL)
    reading.flags['ocr'] = True
    for number, line in enumerate(lines, 1):
        reading.add('L%d' % number, line, line=number, ocr=True)
    reading.counts['lines'] = len(lines)
    return reading


def select(reading, locator):
    """Empty: the whole image; `L3-L5`: lines 3 to 5 of its OCR text."""
    if locator == '':
        return list(reading.lines)
    if not locator.startswith('L'):
        raise ValueError('image locations are empty (whole file) or OCR line ranges such as L3-L5')
    start, end = span(locator[1:])
    return [line for line in reading.lines if 'line' in line.meta and start <= line.meta['line'] <= end]
