# Images (.png, .jpg, .tif, .gif, .bmp, .webp)

- The first line gives the type and size in pixels.
- Text in the image is read by Tesseract OCR (English) and numbered `L1`, `L2`, ...; it is labelled
  "recognised text (OCR)". OCR can misread characters, so check figures you rely on and say they
  come from OCR.
- An image without recognisable text can be cited only as a whole file (`at=""`), and you must say
  its content was not read. Do not describe what a photo shows from its name.
- A multi-page TIFF is read page by page; of an animated GIF or WebP only the first frame is read,
  and the file is listed as partly read. If OCR fails, the image is partly read; say so.
- Stamps, signatures, handwriting and charts are not interpreted in this version.
