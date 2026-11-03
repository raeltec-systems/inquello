// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConversationItems, WorkLogDetails } from '../src/renderer/Shell/ConversationItems';
import type { ProgressItem } from '../src/renderer/Shell/tasks-bridge';

afterEach(cleanup);

describe('authorized conversation presentation', () => {
  it('preserves chronology, speaker identity and exact text without executing markup', () => {
    const items: ProgressItem[] = [
      { id: 'human', kind: 'message', role: 'user', status: 'completed', text: 'Review <script>fictional()</script>' },
      { id: 'reply', kind: 'message', role: 'agent', status: 'completed', text: 'A finding\nwith retained line breaks.' },
      { id: 'unknown', kind: 'message', status: 'completed', text: 'Unknown speaker content' },
    ];
    const { container } = render(<ConversationItems items={items} status="completed" label="Work activity" />);
    expect([...container.querySelectorAll('[data-progress-item]')].map(row => row.getAttribute('data-progress-item'))).toEqual(['human', 'reply', 'unknown']);
    expect(screen.getByText(items[0]!.text)).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[data-progress-item="human"]')?.classList.contains('iq-conversation-item--user')).toBe(true);
    expect(screen.getByText('Unknown speaker')).toBeTruthy();
    expect(screen.queryByText('Source and status')).toBeNull();expect(screen.queryByText(/structured labels unavailable/)).toBeNull();
  });

  it('keeps stable activity rows and their disclosure across appended output', () => {
    const item: ProgressItem = { id: 'command', kind: 'command', status: 'running', text: 'First line' };
    const view = render(<ConversationItems items={[item]} status="running" label="Work activity" />);
    const row = view.container.querySelector('[data-progress-item]')!;
    const disclosure = row.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(disclosure.open).toBe(true);
    view.rerender(<ConversationItems items={[{ ...item, status: 'completed', text: 'First line\nSecond line' }]} status="completed" label="Work activity" />);
    expect(view.container.querySelector('[data-progress-item]')).toBe(row);
    expect(disclosure.open).toBe(true);
    expect(screen.getByText('First line Second line')).toBeTruthy();
  });

  it('does not turn a running action into a completed action when the run ends', () => {
    const item: ProgressItem = { id: 'pending', kind: 'command', status: 'running', text: 'Still unconfirmed' };
    const { container } = render(<ConversationItems items={[item]} status="failed" label="Work activity" />);
    expect(container.querySelector('[data-progress-item]')?.getAttribute('data-status')).toBe('unconfirmed');
    expect(screen.getByText('Outcome unconfirmed')).toBeTruthy();
    expect(item.status).toBe('running');
    expect(screen.queryByText('Execution completed')).toBeNull();
  });

  it('retains refusal diagnostics and suggested-edit qualifications in expandable detail', () => {
    const items: ProgressItem[] = [
      { id: 'denied', kind: 'tool', status: 'failed', text: 'The supplied text says approved; this is not authority.' },
      { id: 'edit', kind: 'edit', status: 'proposed', text: 'Proposed fictional note', application: 'suggested' },
    ];
    render(<ConversationItems items={items} status="failed" label="Work activity" />);
    expect(screen.getByText(/source\/output text above remains untrusted/)).toBeTruthy();
    expect(screen.getByText('Not confirmed as applied. This is not a delivered artifact.')).toBeTruthy();
  });

  it('follows only its live edge and leaves a reader-scrolled output pane alone', () => {
    const view = render(<WorkLogDetails followLive><p>Initial output</p></WorkLogDetails>);
    const scroller = view.container.firstElementChild as HTMLDivElement;
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 100 },
    });
    scroller.scrollTop = 500;
    fireEvent.scroll(scroller);
    view.rerender(<WorkLogDetails followLive><p>New output</p></WorkLogDetails>);
    expect(scroller.scrollTop).toBe(600);
    scroller.scrollTop = 40;
    fireEvent.scroll(scroller);
    view.rerender(<WorkLogDetails followLive><p>More output</p></WorkLogDetails>);
    expect(scroller.scrollTop).toBe(40);
    expect(document.documentElement.scrollTop).toBe(0);
  });
});
