// Regression: an attached CSV showed the badge "XLS" (owner, 2026-11-12).
import { describe, expect, it } from 'vitest';
import { chipType } from '../src/renderer/Shell/sources-bridge';

describe('attachment badge type', () => {
  it('shows the file\'s own type', () => {
    expect(chipType('v75_m1.csv')).toEqual({ type: 'file', typeLabel: 'CSV' });
    expect(chipType('Ledger.XLSX')).toEqual({ type: 'file', typeLabel: 'XLSX' });
    expect(chipType('memo.docx')).toEqual({ type: 'file', typeLabel: 'DOCX' });
    expect(chipType('notes')).toEqual({ type: 'file', typeLabel: 'File' });
  });

  it('keeps the coloured tags for the exact known types', () => {
    expect(chipType('report.pdf')).toEqual({ type: 'pdf' });
    expect(chipType('old.xls')).toEqual({ type: 'xls' });
    expect(chipType('old.doc')).toEqual({ type: 'doc' });
  });
});
