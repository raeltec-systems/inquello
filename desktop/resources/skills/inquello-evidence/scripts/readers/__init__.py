"""Reader registry: which reader, and which installed tool, handles each file."""
import os

from . import read_csv, read_docx, read_image, read_legacy, read_pdf, read_pptx, read_text, read_xls, read_xlsx
from .common import Unreadable, module_available, tool

READERS = [
    ('text', read_text, 'Python standard library', lambda: True),
    ('csv', read_csv, 'Python standard library', lambda: True),
    ('xlsx', read_xlsx, 'openpyxl', lambda: module_available('openpyxl')),
    ('xls', read_xls, 'xlrd', lambda: module_available('xlrd')),
    ('docx', read_docx, 'python-docx and the document XML', lambda: module_available('docx')),
    ('pptx', read_pptx, 'Python standard library (slide XML)', lambda: True),
    ('pdf', read_pdf, 'Poppler (pdftotext); pdftoppm and Tesseract for scanned pages', lambda: bool(tool('pdftotext') or module_available('pdfminer'))),
    ('image', read_image, 'Pillow and Tesseract OCR', lambda: module_available('PIL')),
    ('legacy', read_legacy, 'LibreOffice (headless conversion), then the DOCX or PPTX reader', lambda: bool(tool('soffice')) and module_available('docx')),
]

MAGIC = {
    'zip': (b'PK\x03\x04',),
    'ole': (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1',),
    'pdf': (b'%PDF',),
}
EXPECTED = {'xlsx': 'zip', 'docx': 'zip', 'pptx': 'zip', 'xls': 'ole', 'legacy': 'ole', 'pdf': 'pdf'}


def classify(path):
    """(kind, module, tool description, available) or raises Unreadable for unsupported types."""
    extension = os.path.splitext(path)[1].lower()
    for kind, module, description, available in READERS:
        if extension in module.EXTENSIONS:
            expected = EXPECTED.get(kind)
            if expected:
                with open(path, 'rb') as source:
                    head = source.read(1024)
                signatures = MAGIC[expected]
                if expected == 'pdf':
                    ok = any(sig in head for sig in signatures)
                else:
                    ok = head.startswith(signatures)
                if not ok:
                    if expected == 'zip' and head.startswith(MAGIC['ole'][0]):
                        raise Unreadable('password-protected or legacy-format file under a modern extension')
                    raise Unreadable('file content does not match its type (corrupt or renamed)')
            if kind == 'legacy':
                kind = extension.lstrip('.')
            return kind, module, description, available()
    raise Unreadable('unsupported file type')
