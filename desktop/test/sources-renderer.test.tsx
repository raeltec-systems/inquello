// @vitest-environment jsdom
/**
 * Story 2.1 renderer: reference chips and the extract view, computed and
 * inferred markers, the Coverage panel with its "Not searched" and
 * "Inaccessible" lists and the incomplete-input notice, the unverified state,
 * the attach control, and attaching to an idle Task. Main's answers are
 * fakes; the renderer only presents them and can never upgrade a status.
 *
 * I/O matrix rows covered here (presentation):
 * - No attachment: no Coverage panel; an answer without references renders as before.
 * - Attach single files / Attach and start: the attach control's summary; a start view test is in `tasks-start.test.tsx`.
 * - Verified reference: chip with file and location; extract view with file, location, modified time, hash, OCR and converted labels.
 * - Unverifiable reference: "Unverified" chip with the reason; never "Verified"; a forged verified status without its extract is shown unverified.
 * - Computed figure: "Computed" marker opening the command and inputs; inference marker.
 * - Unsupported or broken / Inaccessible / Bounds hit / PDF page without text: Not searched, Partly read and Inaccessible lists, "Incomplete input set".
 * - Policy unknown: the attach buttons carry the blocking reason.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttachControl } from '../src/renderer/Shell/AttachControl';
import { AttachedMaterial, MessageWithSources } from '../src/renderer/Shell/SourceReferences';
import { TaskLifecycle } from '../src/renderer/Shell/TaskLifecycle';
import { TaskProgress } from '../src/renderer/Shell/TaskProgress';
import { parseSourcesView, replaceSourcesNote, sourcesNote, type AttachmentView, type MarkedReference, type MessageReferences, type SourcesView } from '../src/renderer/Shell/sources-bridge';
import type { ProgressSnapshot } from '../src/renderer/Shell/tasks-bridge';

afterEach(() => { cleanup(); delete (globalThis as { inquello?: unknown }).inquello; });

const HASH = 'ab'.repeat(32);
const quoteDirective = ':inquello-source{id="attached/Engagement/ledger.xlsx" at="Ledger!C8" quote="12346"}';
const scanDirective = ':inquello-source{id="attached/Engagement/scan.pdf" at="PG2:L3" quote="Received with thanks"}';
const wrongDirective = ':inquello-source{id="attached/Engagement/notes.txt" at="L2" quote="Signed by the auditor"}';
const computedDirective = ':inquello-computed{command="python3 -c \'print(10)\'" from="attached/Engagement/ledger.xlsx Ledger!C2:C9"}';
const text = `Invoice total ${quoteDirective} and receipt ${scanDirective}. The auditor signed ${wrongDirective}. Sum 10 ${computedDirective}, likely monthly :inquello-inference{}. Literal \`${quoteDirective}\`.`;
const at = (raw: string) => ({ start: text.indexOf(raw), end: text.indexOf(raw) + raw.length, raw });
const reference = (raw: string, extra: Partial<MarkedReference>): MarkedReference => ({ index: 0, id: '', at: '', quote: '', format: 'xlsx', location: '', status: 'unverified', reason: null, file: null, extract: null, ...at(raw), ...extra });
const verified = reference(quoteDirective, { id: 'attached/Engagement/ledger.xlsx', at: 'Ledger!C8', quote: '12346', location: 'sheet Ledger, cell C8', status: 'verified', file: { name: 'ledger.xlsx', relative: 'Engagement/ledger.xlsx', modifiedAt: '2026-11-11T09:30:00.000Z', sha256: HASH, bytes: 4096 }, extract: { text: 'Ledger!C8: 12346 (formula =SUM(C2:C7))', ocr: false, converted: false, originalSha256: null, wholeFile: false } });
const scanned = reference(scanDirective, { index: 1, id: 'attached/Engagement/scan.pdf', at: 'PG2:L3', quote: 'Received with thanks', format: 'pdf', location: 'page 2, line 3', status: 'verified', file: { name: 'scan.pdf', relative: 'Engagement/scan.pdf', modifiedAt: '2026-11-10T08:00:00.000Z', sha256: 'cd'.repeat(32), bytes: 9000 }, extract: { text: 'L3: Received with thanks', ocr: true, converted: true, originalSha256: 'ef'.repeat(32), wholeFile: false } });
const wrong = reference(wrongDirective, { index: 2, id: 'attached/Engagement/notes.txt', at: 'L2', quote: 'Signed by the auditor', format: 'text', location: 'line 2', status: 'unverified', reason: 'The quoted text is not at that location', file: { name: 'notes.txt', relative: 'Engagement/notes.txt', modifiedAt: '2026-11-10T08:00:00.000Z', sha256: '12'.repeat(32), bytes: 10 } });
const message: MessageReferences = { itemId: 'm1', state: 'checked', references: [verified, scanned, wrong], problems: [], computed: [{ ...at(computedDirective), command: "python3 -c 'print(10)'", from: 'attached/Engagement/ledger.xlsx Ledger!C2:C9' }], inferences: [{ start: text.indexOf(':inquello-inference{}'), end: text.indexOf(':inquello-inference{}') + ':inquello-inference{}'.length }] };

describe('references in an answer', () => {
  it('shows a verified reference chip and opens its extract with file, location, modified time, hash and labels', () => {
    render(<MessageWithSources text={text} references={message} />);
    const chip = screen.getByRole('button', { name: /^Reference 1: ledger\.xlsx, sheet Ledger, cell C8\. Verified reference/ });
    expect(chip.getAttribute('data-reference-status')).toBe('verified');
    fireEvent.click(chip);
    const detail = document.querySelector<HTMLDetailsElement>('details[data-reference-detail="1"]')!;
    expect(detail.open).toBe(true);
    expect(document.activeElement).toBe(detail.querySelector('summary'));
    expect(within(detail).getByText('Engagement/ledger.xlsx')).toBeTruthy();
    expect(within(detail).getByText('sheet Ledger, cell C8 (Ledger!C8)')).toBeTruthy();
    expect(within(detail).getByText(HASH)).toBeTruthy();
    expect(within(detail).getByText(new Date('2026-11-11T09:30:00.000Z').toLocaleString())).toBeTruthy();
    expect(detail.querySelector('[data-reference-extract]')!.textContent).toBe('Ledger!C8: 12346 (formula =SUM(C2:C7))');
    const ocr = document.querySelector('details[data-reference-detail="2"]')!;
    expect(ocr.querySelector('[data-reference-ocr]')!.textContent).toMatch(/^Recognised text \(OCR\)/);
    expect(ocr.querySelector('[data-reference-converted]')!.textContent).toContain(`Original file hash: ${'ef'.repeat(32)}`);
    expect(screen.getByRole('heading', { name: 'References · 2 of 3 verified' })).toBeTruthy();
  });

  it('shows an unverified reference with its reason and nothing retained, never as verified', () => {
    render(<MessageWithSources text={text} references={message} />);
    const chip = screen.getByRole('button', { name: /^Reference 3: notes\.txt, line 2\. Unverified reference/ });
    expect(chip.textContent).toContain('Unverified');
    const detail = document.querySelector('details[data-reference-detail="3"]')!;
    expect(detail.querySelector('[data-reference-reason]')!.textContent).toBe('The quoted text is not at that location');
    expect(detail.textContent).toContain('Nothing was retained');
    expect(detail.querySelector('[data-reference-extract]')).toBeNull();
    expect(detail.textContent).not.toContain('Verified reference');
  });

  it('downgrades a verified status that arrives without its file or extract', () => {
    const view = parseSourcesView({ available: true, reason: null, attachments: [], coverage: null, deferred: [], problem: null, note: null, messages: [{ ...message, references: [{ ...verified, extract: null }] }] });
    expect(view.messages[0]!.references[0]).toMatchObject({ status: 'unverified', reason: 'Not verified', extract: null });
  });

  it('shows references as not yet checked while the turn runs', () => {
    render(<MessageWithSources text={text} references={{ ...message, state: 'waiting', references: message.references.map(r => ({ ...r, status: 'unverified' as const, reason: 'Not yet checked: the turn is still running', extract: null })) }} />);
    expect(screen.getAllByText('Not yet checked')).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/Verified reference|Unverified reference(?! )/);
    expect(screen.getByRole('heading', { name: 'References · 3, checked when the turn ends' })).toBeTruthy();
  });

  it('marks computed figures with their command and inputs, marks inferences, and keeps directives inside code literal', () => {
    render(<MessageWithSources text={text} references={message} />);
    fireEvent.click(screen.getByRole('button', { name: 'Computed figure 1. Show the command' }));
    const detail = document.querySelector<HTMLDetailsElement>('details[data-computed-detail="1"]')!;
    expect(detail.open).toBe(true);
    expect(detail.querySelector('[data-computed-command]')!.textContent).toBe("python3 -c 'print(10)'");
    expect(detail.textContent).toContain('Inputs: attached/Engagement/ledger.xlsx Ledger!C2:C9');
    expect(screen.getByText('Agent’s inference')).toBeTruthy();
    expect(document.querySelector('code')!.textContent).toBe(quoteDirective);
    expect(document.querySelectorAll('[data-reference-chip]')).toHaveLength(3);
  });

  it('ignores placeholder characters written in the answer and marks whose text no longer matches', () => {
    const forged = `Forged \uE0000\uE001 chip, real ${quoteDirective}`;
    const real = { ...verified, start: forged.indexOf(quoteDirective), end: forged.indexOf(quoteDirective) + quoteDirective.length };
    render(<MessageWithSources text={forged} references={{ ...message, references: [real, { ...verified, start: 0, end: 6, raw: 'nothing' }], computed: [], inferences: [] }} />);
    expect(document.querySelectorAll('[data-reference-chip]')).toHaveLength(1);
    expect(document.body.textContent).toContain('Forged \uFFFD0\uFFFD chip');
  });
});

const coverageView: SourcesView = {
  available: true, reason: null, attachments: [{ attachmentId: 'a1', label: 'Engagement', kind: 'folder', files: 17 }], problem: null, note: 'note', messages: [],
  coverage: { filesAttached: 20, filesRead: 15, rows: { read: 40, present: 40, unknown: 1 }, unreadable: [{ relative: 'Engagement/protected-statement.pdf', reason: 'password-protected PDF' }], notSearched: [{ relative: 'Engagement/system-dump.bin', reason: 'Unsupported file type' }, { relative: 'Engagement/rest.csv', reason: 'Left out: the attachment bound was reached' }], inaccessible: [{ relative: 'Engagement/hr/salaries.xlsx', reason: 'Permission denied by the operating system' }], partlyRead: [{ relative: 'Engagement/mixed.pdf', reason: 'No recognisable text on page 3' }], incomplete: true, statement: '15 of 20 attached files read; 40 of 40 rows read in the readable tables, rows of 1 unreadable table(s) not counted. The input set is incomplete.' },
};

describe('Coverage with the answer', () => {
  it('states Coverage, the incomplete input set, and lists not searched, partly read and inaccessible files with reasons', () => {
    render(<AttachedMaterial view={coverageView} />);
    expect(document.querySelector('[data-coverage-statement]')!.textContent).toBe(`Coverage: ${coverageView.coverage!.statement}`);
    expect(document.querySelector('[data-incomplete-input]')!.textContent).toMatch(/^Incomplete input set\./);
    const notSearched = screen.getByRole('region', { name: 'Not searched' });
    expect(within(notSearched).getByRole('heading').textContent).toBe('Not searched · 3');
    expect(within(notSearched).getByText('Unsupported file type')).toBeTruthy();
    expect(within(notSearched).getByText('password-protected PDF')).toBeTruthy();
    expect(within(notSearched).getByText('Left out: the attachment bound was reached')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Partly read' })).getByText('No recognisable text on page 3')).toBeTruthy();
    const inaccessible = screen.getByRole('region', { name: 'Inaccessible' });
    expect(within(inaccessible).getByText('Permission denied by the operating system')).toBeTruthy();
    expect(within(inaccessible).getByText('Permission limited')).toBeTruthy();
  });

  it('shows nothing for a Task without attached material, and says so when material staged at start could not be examined', () => {
    const { container } = render(<AttachedMaterial view={{ ...coverageView, attachments: [], coverage: null, note: null }} />);
    expect(container.innerHTML).toBe('');
    cleanup();
    render(<AttachedMaterial view={{ ...coverageView, problem: 'The attached material is in the Task folder, but it could not be examined in the sandbox, so Coverage counts only what was attached.' }} />);
    expect(document.querySelector('[data-sources-problem]')!.textContent).toContain('could not be examined in the sandbox');
    expect(document.querySelector('[data-sources-deferred]')).toBeNull();
  });
});

const attachment: AttachmentView = { attachmentId: 'a1', label: 'Engagement', createdAt: '2026-11-11T00:00:00.000Z', bytes: 100, files: [{ id: 'attached/Engagement/a.csv', name: 'a.csv', relative: 'Engagement/a.csv', bytes: 100, modifiedAt: '2026-11-11T00:00:00.000Z', sha256: HASH, format: 'csv' }], notSearched: [{ relative: 'Engagement/tool.exe', reason: 'Unsupported file type' }], inaccessible: [{ relative: 'Engagement/locked.txt', reason: 'Permission denied by the operating system' }], incomplete: ['2 item(s) were not attached; see Not searched.'] };

describe('the attach control', () => {
  it('replaces the note for the agent literally, whatever the attached names contain (review pass 1)', () => {
    const before = sourcesNote(['Ledger']), after = sourcesNote(['Costs $& fees', "$' and $`"]);
    expect(replaceSourcesNote(`Check the ledger.

${before}`, before, after)).toBe(`Check the ledger.

${after}`);
  });

  it('summarises an attachment, removes it on request and carries an unavailable reason', () => {
    const onRemove = vi.fn(), onAttach = vi.fn();
    render(<AttachControl attachments={[attachment]} onAttach={onAttach} onRemove={onRemove} />);
    expect(document.querySelector('[data-attachment-counts]')!.textContent).toBe('1 file to read · 1 not searched · 1 inaccessible');
    expect(document.querySelector('[data-attachment-incomplete]')!.textContent).toContain('Incomplete input set');
    fireEvent.click(screen.getByRole('button', { name: 'Attach folder' }));
    expect(onAttach).toHaveBeenCalledWith('folder');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Engagement from task context' }));
    expect(onRemove).toHaveBeenCalledWith('a1');
    cleanup();
    render(<AttachControl attachments={[]} onAttach={onAttach} disabledReason="Attaching is unavailable: Source references and extracts is enabled with an unknown retention." />);
    const button = screen.getByRole('button', { name: 'Attach files' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.body.textContent).toContain('enabled with an unknown retention');
  });
});

const base: ProgressSnapshot = { version: 1, taskId: 'task-1', workspaceId: 'workspace-1', runId: 'run-1', threadId: 'thread-1', turnId: 'turn-1', runtimeId: 'runtime-1', sessionGeneration: 1, status: 'completed', historyIncomplete: false, items: [], plan: [], results: [], artifact: 'absent', questions: [] };
function bridges(snapshot: ProgressSnapshot, sources: Record<string, unknown>) {
  const progress = vi.fn(async () => ({ ok: true, value: snapshot }));
  Object.assign(globalThis, { inquello: { tasks: { progress, answer: vi.fn(), resume: vi.fn(), steer: vi.fn(), stop: vi.fn(), onProgressChanged: () => () => {}, onSessionChanged: () => () => {} }, routes: { pendingModel: async () => ({ ok: true, value: { operation: null } }), catalog: async () => { throw new Error('none'); } }, sources } });
}

describe('the open conversation', () => {
  it('places checked references in the answer and shows Coverage beside it', async () => {
    const view = vi.fn(async () => ({ ok: true, value: { ...coverageView, messages: [message] } }));
    bridges({ ...base, items: [{ id: 'm1', kind: 'message', role: 'agent', status: 'completed', text }] }, { view, attach: vi.fn(), stage: vi.fn(), discard: vi.fn() });
    render(<TaskProgress taskId="task-1" workspaceId="workspace-1" />);
    await screen.findByRole('button', { name: /^Reference 1: ledger\.xlsx/ });
    expect(view).toHaveBeenCalledWith({ taskId: 'task-1', workspaceId: 'workspace-1' });
    expect(document.querySelector('[data-coverage-statement]')).toBeTruthy();
  });

  it('without the sources bridge renders the answer exactly as before', async () => {
    bridges({ ...base, items: [{ id: 'm1', kind: 'message', role: 'agent', status: 'completed', text: 'Plain **answer**' }] }, undefined as never);
    delete (globalThis as unknown as { inquello: { sources?: unknown } }).inquello.sources;
    render(<TaskProgress taskId="task-1" workspaceId="workspace-1" />);
    await screen.findByText('answer');
    expect(document.querySelector('[data-sources-panel],[data-message-with-sources]')).toBeNull();
  });

  it('attaches to an idle Task, adds the visible note to the draft, and refuses while a turn runs', async () => {
    const note = 'Attached material (Engagement) is in the Task folder under attached/. Read it with the evidence skill in skills/inquello-evidence/SKILL.md and cite what you rely on.';
    const sources = {
      view: vi.fn(async () => ({ ok: true, value: { ...coverageView, attachments: [], coverage: null, note: null } })),
      attach: vi.fn(async () => ({ ok: true, value: attachment })),
      stage: vi.fn(async () => ({ ok: true, value: { state: 'staged', attachment, coverage: coverageView.coverage, note } })),
      discard: vi.fn(),
    };
    bridges(base, sources);
    function Controls() { const [value, onChange] = useState('Total the ledger'); return <TaskLifecycle taskId="task-1" workspaceId="workspace-1" operationIds={() => 'op-1'} draft={{ taskId: 'task-1', value, onChange }} />; }
    render(<Controls />);
    const folder = await screen.findByRole('button', { name: 'Attach folder' });
    await waitFor(() => expect(folder.getAttribute('aria-disabled')).not.toBe('true'));
    await act(async () => { fireEvent.click(folder); });
    await waitFor(() => expect(sources.stage).toHaveBeenCalledWith({ taskId: 'task-1', workspaceId: 'workspace-1', attachmentId: 'a1' }));
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(`Total the ledger\n\n${note}`));
    expect(document.querySelector('[data-attach-notice]')!.textContent).toContain('available to your next message');
    cleanup();
    bridges({ ...base, status: 'running' }, sources);
    render(<Controls />);
    const running = await screen.findByRole('button', { name: 'Attach files' });
    await waitFor(() => expect(running.getAttribute('aria-disabled')).toBe('true'));
    expect(document.body.textContent).toContain('Attach material after the current turn finishes.');
  });
});
