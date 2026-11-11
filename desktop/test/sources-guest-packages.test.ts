/**
 * Story 2.1: the sandbox image's software is a declared list with recorded
 * versions. The bootstrap install line, the build manifest's package list and
 * the recorded versions (with their digest) must agree, so adding a package is
 * one reviewed change and the record of what touched evidence stays exact.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const wsl = path.resolve(__dirname, '..', 'scripts', 'wsl');
const read = (name: string) => fs.readFileSync(path.join(wsl, name), 'utf8').replace(/\r\n/g, '\n');

export function bootstrapPackages(script: string): string[] {
  const lines = script.split('\n').filter((line) => /^apt-get install\b/.test(line.trim()));
  if (lines.length !== 1) throw new Error(`expected one apt-get install line, found ${lines.length}`);
  const words = lines[0]!.trim().split(/\s+/).slice(2);
  return words.filter((word) => !word.startsWith('-'));
}

export function recordedPackages(tsv: string): Map<string, string> {
  const records = new Map<string, string>();
  for (const line of tsv.split('\n').filter(Boolean)) {
    const [name, version, extra] = line.split('\t');
    if (!name || !version || extra !== undefined) throw new Error(`malformed record: ${line}`);
    records.set(name.replace(/:amd64$/, ''), version);
  }
  return records;
}

describe('declared sandbox packages', () => {
  const manifest = JSON.parse(read('build-manifest.json')) as { packages: string[]; resolvedPackageVersions: { file: string; sha256: string } };
  const bootstrap = bootstrapPackages(read('bootstrap-guest.sh'));
  const tsv = read(manifest.resolvedPackageVersions.file);

  it('records versions whose digest matches the manifest', () => {
    expect(createHash('sha256').update(tsv).digest('hex')).toBe(manifest.resolvedPackageVersions.sha256);
  });

  it('installs exactly the packages the manifest declares', () => {
    expect([...bootstrap].sort()).toEqual([...manifest.packages].sort());
    expect(new Set(bootstrap).size).toBe(bootstrap.length);
  });

  it('records a resolved version for every declared package', () => {
    const records = recordedPackages(tsv);
    expect(manifest.packages.filter((name) => !records.has(name))).toEqual([]);
  });

  it('declares the Story 2.1 document tools and no PyMuPDF', () => {
    for (const name of ['poppler-utils', 'tesseract-ocr', 'tesseract-ocr-eng', 'python3-pypdf', 'python3-pdfminer', 'python3-openpyxl', 'python3-docx', 'python3-xlrd', 'python3-pil', 'libreoffice-writer-nogui', 'libreoffice-calc-nogui', 'libreoffice-impress-nogui']) expect(manifest.packages).toContain(name);
    expect(recordedPackages(tsv).has('python3-fitz')).toBe(false);
  });

  it('detects a drift between the lists and a changed record', () => {
    expect(() => bootstrapPackages('apt-get install -y a\napt-get install -y b\n')).toThrow();
    expect(bootstrapPackages('apt-get install -y --no-install-recommends a b')).toEqual(['a', 'b']);
    expect(createHash('sha256').update(`${tsv}x\tx\n`).digest('hex')).not.toBe(manifest.resolvedPackageVersions.sha256);
  });
});
