// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.8: the progress and proposed-action primitives, in jsdom with
 * Testing Library and user-event (fake timers for the Toast). Every row of the
 * spec's I/O matrix, plus the semantics each Always rule names.
 */
import fs from 'node:fs';
import path from 'node:path';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovalCard,
  APPROVAL_OVERLINE,
  DiffLine,
  FILE_STATE_TEXT,
  FileChip,
  GENERIC_ACTION_LABELS,
  JUDGMENT_TEXT,
  JudgmentTag,
  MISSING_BASIS_TEXT,
  PLAN_STEP_STATES,
  PLAN_STEP_TEXT,
  PlanStep,
  PlanSteps,
  Toast,
  TOAST_DISMISS_MS,
  type PlanStepItem,
} from '../src/renderer/primitives';

const desktop = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(desktop, 'src', 'renderer', 'primitives', 'primitives.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Text a screen reader reads: everything except `aria-hidden` subtrees. */
function accessibleText(element: Element): string {
  let out = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
    else if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true') out += accessibleText(node);
  }
  return out;
}

/** The text a sighted reader sees: excludes visually hidden spans. */
function visibleText(element: Element): string {
  let out = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
    else if (node instanceof Element && !node.classList.contains('iq-visually-hidden')) out += visibleText(node);
  }
  return out;
}

describe('JudgmentTag', () => {
  it('puts each kind in the accessible text beside the readable claim', () => {
    const { container } = render(
      <>
        <JudgmentTag kind="calculation">Difference 1,240.00</JudgmentTag>
        <JudgmentTag kind="observation">Deposits post a day late</JudgmentTag>
        <JudgmentTag kind="suggestion">Treat as timing</JudgmentTag>
        <JudgmentTag kind="decision" basis={{ by: 'Dana Osei', scope: 'Q3 bank reconciliation' }}>
          Accept the difference
        </JudgmentTag>
        <JudgmentTag kind="gap">No October statement</JudgmentTag>
      </>,
    );
    const tags = [...container.querySelectorAll('.iq-judgment')].map(accessibleText);
    expect(tags).toEqual([
      'Calculation: Difference 1,240.00',
      'Observation: Deposits post a day late',
      'Suggestion: Treat as timing',
      'Decision by Dana Osei (Q3 bank reconciliation): Accept the difference',
      'Gap: No October statement',
    ]);
    expect(Object.values(JUDGMENT_TEXT)).toEqual(['Calculation', 'Observation', 'Suggestion', 'Decision', 'Gap']);
  });

  it('draws ƒ, ◦, the dashed box, the green dot and – as decorative marks', () => {
    const { container } = render(
      <>
        <JudgmentTag kind="calculation">a</JudgmentTag>
        <JudgmentTag kind="observation">b</JudgmentTag>
        <JudgmentTag kind="suggestion">c</JudgmentTag>
        <JudgmentTag kind="decision" basis={{ by: 'Close policy', scope: 'Month end' }}>
          d
        </JudgmentTag>
        <JudgmentTag kind="gap">e</JudgmentTag>
      </>,
    );
    const marks = [...container.querySelectorAll('.iq-judgment-mark')];
    expect(marks.map((mark) => mark.getAttribute('aria-hidden'))).toEqual(['true', 'true', 'true', 'true', 'true']);
    expect(marks.map((mark) => mark.textContent)).toEqual(['ƒ', '◦', '', '', '–']);
    expect(css).toMatch(/\.iq-judgment--suggestion \.iq-judgment-mark--shape \{[^}]*border: 1px dashed var\(--judgment-suggestion\);/);
    expect(css).toMatch(/\.iq-judgment--decision \.iq-judgment-mark--shape \{[^}]*background: var\(--judgment-decision\);/);
  });

  it('requires a basis for a decision: a type error, and at runtime "Decision (basis missing)" with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error -- a decision names the person or policy and its scope.
    const { container } = render(<JudgmentTag kind="decision">Accept the difference</JudgmentTag>);
    const tag = container.querySelector('.iq-judgment')!;
    expect(accessibleText(tag)).toBe(`${MISSING_BASIS_TEXT}: Accept the difference`);
    expect(tag.className).toContain('iq-judgment--unbased');
    expect(tag.className).not.toContain('iq-judgment--decision');
    expect(tag.querySelector('.iq-judgment-mark')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    // A blank basis is no basis.
    render(<JudgmentTag kind="decision" basis={{ by: ' ', scope: 'Q3' }}>x</JudgmentTag>);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('takes no basis on other kinds and offers the sentence-case legend style', () => {
    // @ts-expect-error -- only a decision has a basis.
    void (<JudgmentTag kind="suggestion" basis={{ by: 'x', scope: 'y' }}>c</JudgmentTag>);
    const { container } = render(
      <JudgmentTag kind="gap" uppercase={false}>
        No statement
      </JudgmentTag>,
    );
    expect(container.querySelector('.iq-judgment')!.className).toContain('iq-judgment--sentence');
  });
});

describe('FileChip', () => {
  it('shows PDF, XLS, DOC and DIR tags and a caller label for any other type, with the name visible', () => {
    const { container } = render(
      <>
        <FileChip type="pdf" name="statement.pdf" />
        <FileChip type="xls" name="ledger.xlsx" />
        <FileChip type="doc" name="memo.docx" />
        <FileChip type="folder" name="Q3 evidence" />
        <FileChip type="csv" typeLabel="CSV" name="feed.csv" />
      </>,
    );
    const chips = [...container.querySelectorAll('.iq-file-chip')];
    expect(chips.map((chip) => chip.querySelector('.iq-file-chip-tag')!.textContent)).toEqual(['PDF', 'XLS', 'DOC', 'DIR', 'CSV']);
    expect(chips.map((chip) => chip.querySelector('.iq-file-chip-name')!.textContent)).toEqual(['statement.pdf', 'ledger.xlsx', 'memo.docx', 'Q3 evidence', 'feed.csv']);
    expect(chips.map(accessibleText)).toEqual([
      'PDF document: statement.pdf',
      'Spreadsheet: ledger.xlsx',
      'Document: memo.docx',
      'Folder: Q3 evidence',
      'CSV: feed.csv',
    ]);
  });

  it('needs a label for any other type: a type error, and at runtime FILE plus a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error -- an unlisted type brings its own label.
    const { container } = render(<FileChip type="csv" name="feed.csv" />);
    expect(container.querySelector('.iq-file-chip-tag')!.textContent).toBe('FILE');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('makes the source detail accessible', () => {
    const { container } = render(<FileChip type="pdf" name="statement.pdf" source="Shared drive / Finance" />);
    expect(accessibleText(container.querySelector('.iq-file-chip')!)).toBe('PDF document: statement.pdf, from Shared drive / Finance');
    expect(visibleText(container.querySelector('.iq-file-chip')!)).toBe('PDFstatement.pdf');
  });

  it('calls onRemove once from Tab and Enter, through a button that names the file', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<FileChip type="xls" name="trial-balance.xlsx" onRemove={onRemove} />);
    await user.tab();
    const remove = screen.getByRole('button', { name: 'Remove trial-balance.xlsx from task context' });
    expect(remove.tagName).toBe('BUTTON');
    expect(remove.getAttribute('type')).toBe('button');
    expect(document.activeElement).toBe(remove);
    await user.keyboard('{Enter}');
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(remove.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows visible text for failed, unreadable and permission-limited, distinct from the PDF type colour', () => {
    const { container } = render(
      <>
        <FileChip type="pdf" name="a.pdf" state="failed" />
        <FileChip type="pdf" name="b.pdf" state="unreadable" />
        <FileChip type="folder" name="Payroll" state="permission-limited" />
        <FileChip type="pdf" name="c.pdf" />
      </>,
    );
    const states = [...container.querySelectorAll('.iq-file-chip-state')].map((state) => visibleText(state));
    expect(states).toEqual(['Failed', 'Unreadable', 'Permission limited']);
    expect(Object.values(FILE_STATE_TEXT)).toEqual(['Failed', 'Unreadable', 'Permission limited']);
    expect(screen.getByText('Unreadable')).toBeTruthy();
    // The ready PDF shows no state text: its red tag is a type cue, not an error.
    expect(container.querySelectorAll('.iq-file-chip')[3]!.querySelector('.iq-file-chip-state')).toBeNull();
    const rule = (selector: string) => new RegExp(`${selector.replace(/[.-]/g, (c) => `\\${c}`)}[^{]*\\{[^}]*color: var\\(--([\\w-]+)\\)`).exec(css)?.[1];
    expect(rule('.iq-file-chip-tag--pdf')).toBe('file-pdf');
    expect(rule('.iq-file-chip--unreadable .iq-file-chip-state')).toBe('amber-800');
    expect(rule('.iq-file-chip--failed .iq-file-chip-state')).toBe('red-800');
  });
});

describe('PlanStep', () => {
  it('shows the check and done styling only for done, with accessible "Done"', () => {
    const { container } = render(
      <ol>
        {PLAN_STEP_STATES.map((state) => (
          <PlanStep key={state} state={state} label={`Step ${state}`} />
        ))}
      </ol>,
    );
    const steps = [...container.querySelectorAll('li')];
    const done = steps[PLAN_STEP_STATES.indexOf('done')]!;
    expect(done.className).toContain('iq-plan-step--done');
    expect(done.querySelector('.iq-plan-step-indicator svg')).toBeTruthy();
    expect(done.querySelector('.iq-plan-step-indicator')!.getAttribute('aria-hidden')).toBe('true');
    expect(accessibleText(done)).toBe('Step done, Done');
    for (const step of steps.filter((entry) => entry !== done)) expect(step.querySelector('svg'), step.className).toBeNull();
  });

  it('gives every state its own text: visible for running, blocked, failed and interrupted', () => {
    const { container } = render(
      <ol>
        {PLAN_STEP_STATES.map((state) => (
          <PlanStep key={state} state={state} label="Step" />
        ))}
      </ol>,
    );
    const steps = [...container.querySelectorAll('li')];
    expect(steps.map((step) => accessibleText(step).replace(/^Step,? ?/, ''))).toEqual(['Pending', 'Running', 'Done', 'Blocked', 'Failed', 'Interrupted']);
    expect(steps.map((step) => visibleText(step))).toEqual(['Step', 'StepRunning', 'Step', 'StepBlocked', 'StepFailed', 'StepInterrupted']);
    expect(Object.values(PLAN_STEP_TEXT)).toEqual(['Pending', 'Running', 'Done', 'Blocked', 'Failed', 'Interrupted']);
  });

  it('shows "Interrupted" and no check for an interrupted step', () => {
    render(
      <ol>
        <PlanStep state="interrupted" label="Draft review notes" />
      </ol>,
    );
    const step = screen.getByRole('listitem');
    expect(within(step).getByText('Interrupted')).toBeTruthy();
    expect(step.querySelector('svg')).toBeNull();
  });

  it('renders steps as an ordered list with one polite live region', () => {
    const steps: PlanStepItem[] = [
      { id: 'a', label: 'Read the statement', state: 'done' },
      { id: 'b', label: 'Match lines', state: 'running' },
    ];
    const { container } = render(<PlanSteps label="Plan" steps={steps} />);
    const list = screen.getByRole('list', { name: 'Plan' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    const live = container.querySelectorAll('[aria-live]');
    expect(live).toHaveLength(1);
    expect(live[0]!.getAttribute('aria-live')).toBe('polite');
    expect(live[0]!.textContent).toBe('');
  });

  it('announces a running → done transition once, and nothing for pulses or unchanged rerenders', () => {
    const before: PlanStepItem[] = [
      { id: 'a', label: 'Read the statement', state: 'done' },
      { id: 'b', label: 'Match lines', state: 'running' },
    ];
    const { container, rerender } = render(<PlanSteps label="Plan" steps={before} />);
    const live = container.querySelector('[aria-live]')!;
    // The pulsing dot is decorative and never inside the live region.
    expect(container.querySelector('.iq-plan-step-pulse')!.closest('[aria-hidden="true"]')).toBeTruthy();
    expect(live.contains(container.querySelector('.iq-plan-step-pulse'))).toBe(false);
    rerender(<PlanSteps label="Plan" steps={before.map((step) => ({ ...step }))} />);
    expect(live.textContent).toBe('');
    rerender(<PlanSteps label="Plan" steps={[before[0]!, { ...before[1]!, state: 'done' }]} />);
    expect(live.textContent).toBe('Match lines: done');
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
    // Rerendering the same states leaves the region untouched, so nothing is announced again.
    const watch = new MutationObserver(() => {});
    watch.observe(live, { childList: true, characterData: true, subtree: true });
    rerender(<PlanSteps label="Plan" steps={[before[0]!, { ...before[1]!, state: 'done' }]} />);
    expect(live.textContent).toBe('Match lines: done');
    expect(watch.takeRecords()).toEqual([]);
    watch.disconnect();
  });

  it('removes the pulse under reduced motion while "Running" stays visible text', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? '';
    expect(reduced).toMatch(/\.iq-plan-step-pulse \{\s*animation: none;/);
    expect(css).toMatch(/\.iq-plan-step-pulse \{[^}]*animation: iq-pulse /);
    render(
      <ol>
        <PlanStep state="running" label="Match lines" />
      </ol>,
    );
    const state = screen.getByText('Running');
    expect(state.className).toBe('iq-plan-step-state');
    expect(reduced).not.toMatch(/iq-plan-step-state/);
  });
});

describe('ApprovalCard', () => {
  const card = (primaryLabel: string, onPrimary = vi.fn(), extra: Partial<Parameters<typeof ApprovalCard>[0]> = {}) => (
    <ApprovalCard
      context="Subsequent clearance · R4"
      action="Send the October statement request to Northwind Ltd"
      destination="accounts@northwind.example, by email"
      consequence="Northwind receives the request."
      primaryLabel={primaryLabel}
      onPrimary={onPrimary}
      {...extra}
    />
  );

  it.each([...GENERIC_ACTION_LABELS, 'approve', ' OK. ', 'Continue!', ''])('rejects the generic label %j: nothing rendered, a warning names it', (label) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(card(label));
    expect(container.innerHTML).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(JSON.stringify(label));
  });

  it('shows context, action, destination and consequence in a labelled region whose button carries the action', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    render(card('Send October statement request', onPrimary, { quote: 'Please send the October statement.' }));
    const region = screen.getByRole('region', { name: `${APPROVAL_OVERLINE} Send the October statement request to Northwind Ltd` });
    for (const text of ['Subsequent clearance · R4', 'Send the October statement request to Northwind Ltd', 'accounts@northwind.example, by email', 'Northwind receives the request.', 'Please send the October statement.']) {
      expect(within(region).getByText(text)).toBeTruthy();
    }
    expect(within(region).getByText('Destination').tagName).toBe('DT');
    expect(within(region).getByText('Consequence').tagName).toBe('DT');
    const primary = within(region).getByRole('button', { name: 'Send October statement request' });
    await user.click(primary);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('leaves focus where it is when it appears and is reachable by Tab', async () => {
    const user = userEvent.setup();
    function Host() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setShown(true)}>
            Ask
          </button>
          {shown ? card('Send October statement request') : null}
        </>
      );
    }
    render(<Host />);
    const ask = screen.getByRole('button', { name: 'Ask' });
    await user.click(ask);
    expect(screen.getByRole('region')).toBeTruthy();
    expect(document.activeElement).toBe(ask);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send October statement request' }));
  });

  it('offers alternatives with real labels and handlers, dropping generic ones with a warning', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEdit = vi.fn();
    render(
      card('Send October statement request', vi.fn(), {
        alternatives: [
          { label: 'Edit the request', onSelect: onEdit },
          { label: 'OK', onSelect: vi.fn() },
        ],
      }),
    );
    const buttons = within(screen.getByRole('region')).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Send October statement request', 'Edit the request']);
    await user.click(buttons[1]!);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('requires context, action, destination, consequence, the label and the handler at the type level', () => {
    // @ts-expect-error -- an approval names where the action takes effect.
    void (<ApprovalCard context="c" action="a" consequence="c" primaryLabel="Send" onPrimary={() => {}} />);
    // @ts-expect-error -- and the handler is required.
    void (<ApprovalCard context="c" action="a" destination="d" consequence="c" primaryLabel="Send" />);
  });
});

describe('DiffLine', () => {
  it('shows "−" and reads "Removed line, suggested" for a suggested deletion', () => {
    const { container } = render(
      <DiffLine kind="delete" stage="suggested">
        Deposit 1,240.00 unmatched
      </DiffLine>,
    );
    const line = container.querySelector('.iq-diff-line')!;
    expect(line.querySelector('.iq-diff-sign')!.textContent).toBe('−');
    expect(line.querySelector('.iq-diff-sign')!.getAttribute('aria-hidden')).toBe('true');
    expect(accessibleText(line)).toBe('Removed line, suggested: Deposit 1,240.00 unmatched');
    expect(visibleText(line)).toBe('−Deposit 1,240.00 unmatchedSuggested');
  });

  it('carries sign and kind text for every kind and shows each stage as text', () => {
    const { container } = render(
      <>
        <DiffLine kind="add" stage="applied-locally" gutter="R14">
          a
        </DiffLine>
        <DiffLine kind="change" stage="delivered" gutter={15}>
          b
        </DiffLine>
        <DiffLine kind="context" stage="suggested">
          c
        </DiffLine>
      </>,
    );
    const lines = [...container.querySelectorAll('.iq-diff-line')];
    expect(lines.map(accessibleText)).toEqual(['R14Added line, applied locally: a', '15Changed line, delivered: b', 'Unchanged line, suggested: c']);
    expect(lines.map((line) => line.querySelector('.iq-diff-sign')!.textContent)).toEqual(['+', '~', '']);
    expect(lines.map((line) => line.querySelector('.iq-diff-stage')!.textContent)).toEqual(['Applied locally', 'Delivered', 'Suggested']);
    expect(lines.map((line) => line.querySelector('.iq-diff-gutter')?.textContent ?? null)).toEqual(['R14', '15', null]);
  });

  it('requires a stage at the type level', () => {
    // @ts-expect-error -- every line says whether it is suggested, applied locally or delivered.
    void (<DiffLine kind="add">a</DiffLine>);
  });
});

describe('Toast', () => {
  it('is a status that never moves focus and stays without transient', () => {
    vi.useFakeTimers();
    render(
      <>
        <button type="button">Keep</button>
        <Toast>Copied the item reference</Toast>
      </>,
    );
    const keep = screen.getByRole('button', { name: 'Keep' });
    keep.focus();
    const toast = screen.getByRole('status');
    expect(toast.textContent).toBe('Copied the item reference');
    expect(toast.hasAttribute('tabindex')).toBe(false);
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS * 10));
    expect(screen.getByRole('status')).toBe(toast);
    expect(document.activeElement).toBe(keep);
  });

  it('dismisses a transient toast after 2.6s without moving focus', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button">Keep</button>
        <Toast transient onDismiss={onDismiss}>
          Copied the item reference
        </Toast>
      </>,
    );
    const keep = screen.getByRole('button', { name: 'Keep' });
    keep.focus();
    expect(TOAST_DISMISS_MS).toBe(2600);
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS - 1));
    expect(screen.queryByRole('status')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(keep);
  });

  it('stays while hovered and dismisses 2.6s after the pointer leaves', () => {
    vi.useFakeTimers();
    render(<Toast transient>Copied</Toast>);
    const toast = screen.getByRole('status');
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS * 5));
    expect(screen.queryByRole('status')).toBe(toast);
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS - 1));
    expect(screen.queryByRole('status')).toBe(toast);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays while focused and dismisses 2.6s after focus leaves', () => {
    vi.useFakeTimers();
    render(
      <>
        <button type="button">Elsewhere</button>
        <Toast transient>Copied</Toast>
      </>,
    );
    const toast = screen.getByRole('status');
    expect(toast.tabIndex).toBe(0);
    act(() => toast.focus());
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS * 5));
    expect(screen.queryByRole('status')).toBe(toast);
    expect(document.activeElement).toBe(toast);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    act(() => elsewhere.focus());
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS));
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('accepts no error or required-action kind: a type error, and at runtime nothing plus a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error -- errors and required actions stay in persistent UI.
    const { container } = render(<Toast kind="error">Upload failed</Toast>);
    expect(container.innerHTML).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"error"');
  });
});
