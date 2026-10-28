// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.7: the navigation and identity primitives, in jsdom with Testing
 * Library and user-event. Every row of the spec's I/O matrix, plus the
 * semantics each Always rule names.
 */
import fs from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  agentSymbolFor,
  Avatar,
  Badge,
  Menu,
  SegmentedControl,
  SOURCE_STATUSES,
  STATUS_TEXT,
  StatusChip,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type MenuEntry,
} from '../src/renderer/primitives';

const desktop = path.resolve(__dirname, '..');
const importLogo = path.resolve(desktop, '..', '_bmad-output', 'planning-artifacts', 'ux-designs', 'ux-inquello-2026-10-26', 'imports', 'inquello-design-system', 'assets', 'logo');
const ourLogo = path.join(desktop, 'src', 'renderer', 'design', 'assets', 'logo');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function descriptions(element: HTMLElement): string[] {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `<missing ${id}>`);
}

describe('Avatar', () => {
  it('names a person by the full identity and shows the initials as supplementary', () => {
    render(<Avatar name="Dana Osei" initials="DO" />);
    const avatar = screen.getByRole('img', { name: 'Dana Osei' });
    expect(avatar.textContent).toBe('DO');
    expect(avatar.querySelector('.iq-avatar-initials')?.getAttribute('aria-hidden')).toBe('true');
    expect(avatar.className).toContain('iq-avatar--24');
  });

  it('requires a name for a person at the type level', () => {
    // @ts-expect-error -- initials alone never identify a person.
    void (<Avatar initials="DO" />);
  });

  it('shows the agent as the decorative symbol in a labelled wrapper, small at 20px or less', () => {
    render(
      <>
        <Avatar kind="agent" size={20} />
        <Avatar kind="agent" />
        <Avatar kind="agent" size={32} name="Inquello agent (reviewer)" />
      </>,
    );
    const agents = screen.getAllByRole('img', { name: /^Inquello agent/ });
    expect(agents).toHaveLength(3);
    for (const agent of agents) {
      const image = agent.querySelector('img')!;
      expect(image.getAttribute('alt')).toBe('');
      expect(image.getAttribute('aria-hidden')).toBe('true');
      expect(agent.className).not.toContain('iq-avatar--person');
      expect(agent.textContent).toBe('');
    }
    expect(agents.map((agent) => agent.getAttribute('data-symbol'))).toEqual(['small', 'small', 'regular']);
    expect(agents[0]!.querySelector('img')!.getAttribute('src')).toContain('inquello-symbol-small');
    expect(agents[2]!.querySelector('img')!.getAttribute('src')).not.toContain('small');
    // 24 × 0.8 = 19.2px rendered height: the small symbol (DESIGN.md corrects the reference's choice).
    expect(agentSymbolFor(24)).toBe('small');
    expect(agentSymbolFor(32)).toBe('regular');
  });

  it('shows the decided treatment only with a recorded identity, and announces no approval', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <Avatar name="Dana Osei" initials="DO" decided={{ recordedIdentity: 'Dana Osei' }} />
        <Avatar name="Mia Laine" initials="ML" decided={{ recordedIdentity: ' ' }} />
      </>,
    );
    const decided = screen.getByRole('img', { name: 'Dana Osei' });
    expect(decided.className).toContain('iq-avatar--decided');
    expect(decided.getAttribute('aria-label')).toBe('Dana Osei');
    const unrecorded = screen.getByRole('img', { name: 'Mia Laine' });
    expect(unrecorded.className).not.toContain('iq-avatar--decided');
    expect(warn).toHaveBeenCalledTimes(1);
    // @ts-expect-error -- the decided treatment needs the recorded identity.
    void (<Avatar name="Dana Osei" initials="DO" decided />);
  });

  it('ships the small and regular symbols byte for byte from the import', () => {
    for (const file of ['inquello-symbol.svg', 'inquello-symbol-small.svg']) {
      expect(fs.readFileSync(path.join(ourLogo, file)).equals(fs.readFileSync(path.join(importLogo, file))), file).toBe(true);
    }
  });
});

describe('Badge', () => {
  it('names what is counted in its accessible text', () => {
    render(<Badge count={3} label="items need evidence" />);
    const badge = document.querySelector('.iq-badge') as HTMLElement;
    expect(badge.textContent).toContain('3 items need evidence');
    expect(within(badge).getByText('3').getAttribute('aria-hidden')).toBe('true');
    expect(badge.hasAttribute('aria-live')).toBe(false);
  });

  it('requires a label at the type level', () => {
    // @ts-expect-error -- a bare count never says what it counts.
    void (<Badge count={3} />);
  });

  it('announces a live count change politely without moving focus', async () => {
    const user = userEvent.setup();
    function Counter() {
      const [count, setCount] = useState(3);
      return (
        <>
          <button type="button" onClick={() => setCount((value) => value + 1)}>
            Add
          </button>
          <Badge count={count} label="items need evidence" live />
        </>
      );
    }
    render(<Counter />);
    const add = screen.getByRole('button', { name: 'Add' });
    const badge = document.querySelector('.iq-badge') as HTMLElement;
    expect(badge.getAttribute('aria-live')).toBe('polite');
    expect(badge.getAttribute('aria-atomic')).toBe('true');
    await user.click(add);
    expect(badge.textContent).toContain('4 items need evidence');
    expect(document.activeElement).toBe(add);
    expect(document.querySelector('.iq-badge')).toBe(badge);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'summary', label: 'Summary' },
    { value: 'items', label: 'Reconciling items' },
    { value: 'notes', label: 'Notes' },
  ];

  it('uses radio-group semantics with one tab stop', () => {
    render(<SegmentedControl label="Artifact view" options={options} defaultValue="items" />);
    const group = screen.getByRole('radiogroup', { name: 'Artifact view' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('selects the next segment on ArrowRight and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl label="Artifact view" options={options} defaultValue="summary" onChange={onChange} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Summary' }));
    await user.keyboard('{ArrowRight}');
    const items = screen.getByRole('radio', { name: 'Reconciling items' });
    expect(items.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(items);
    expect(onChange).toHaveBeenLastCalledWith('items');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Notes' }).getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Summary' }).getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Notes' }).getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{Home}');
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['items', 'notes', 'summary', 'notes', 'summary']);
  });

  it('follows a controlled value', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [view, setView] = useState('summary');
      return <SegmentedControl label="Artifact view" options={options} value={view} onChange={setView} />;
    }
    render(<Controlled />);
    await user.click(screen.getByRole('radio', { name: 'Notes' }));
    expect(screen.getByRole('radio', { name: 'Notes' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Tabs', () => {
  function Views({ activation, onChange }: { activation?: 'manual' | 'automatic'; onChange?: (value: string) => void }) {
    return (
      <Tabs defaultValue="changes" activation={activation} onChange={onChange}>
        <TabList label="Artifact views">
          <Tab value="changes" count={3}>
            Changes
          </Tab>
          <Tab value="preview">Preview</Tab>
          <Tab value="summary">Summary</Tab>
        </TabList>
        <TabPanel value="changes">
          <label>
            Note
            <input aria-label="Note" />
          </label>
        </TabPanel>
        <TabPanel value="preview">Preview body</TabPanel>
        <TabPanel value="summary">Summary body</TabPanel>
      </Tabs>
    );
  }

  it('links tablist, tabs and panels', () => {
    render(<Views />);
    const list = screen.getByRole('tablist', { name: 'Artifact views' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!)!;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    }
    expect(screen.getByRole('tabpanel', { name: 'Changes 3' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Changes 3' }).querySelector('.iq-tab-count')?.textContent).toBe('3');
  });

  it('moves focus on ArrowRight without selecting until Enter or Space (manual)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Views onChange={onChange} />);
    await user.tab();
    const [changes, preview, summary] = screen.getAllByRole('tab') as [HTMLElement, HTMLElement, HTMLElement];
    expect(document.activeElement).toBe(changes);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(preview);
    expect(changes.getAttribute('aria-selected')).toBe('true');
    expect(preview.getAttribute('aria-selected')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(preview.getAttribute('aria-selected')).toBe('true');
    expect(onChange).toHaveBeenLastCalledWith('preview');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(summary);
    await user.keyboard(' ');
    expect(summary.getAttribute('aria-selected')).toBe('true');
    expect(onChange.mock.calls).toEqual([['preview'], ['summary']]);
  });

  it('wraps from the last tab and goes to the first and last with Home and End', async () => {
    const user = userEvent.setup();
    render(<Views />);
    const [changes, , summary] = screen.getAllByRole('tab') as [HTMLElement, HTMLElement, HTMLElement];
    changes.focus();
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(summary);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(changes);
    await user.keyboard('{End}');
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(changes);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(summary);
    expect(changes.getAttribute('aria-selected')).toBe('true');
  });

  it('selects on focus only when activation="automatic"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Views activation="automatic" onChange={onChange} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe('true');
    expect(onChange).toHaveBeenLastCalledWith('preview');
  });

  it('changes only the view: panels stay mounted and keep their state', async () => {
    const user = userEvent.setup();
    render(<Views />);
    const note = screen.getByRole('textbox', { name: 'Note' }) as HTMLInputElement;
    await user.type(note, 'Check the ledger');
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    const changesPanel = document.getElementById(screen.getByRole('tab', { name: 'Changes 3' }).getAttribute('aria-controls')!)!;
    expect(changesPanel.hidden).toBe(true);
    expect(changesPanel.contains(note)).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Changes 3' }));
    expect(changesPanel.hidden).toBe(false);
    expect((screen.getByRole('textbox', { name: 'Note' }) as HTMLInputElement).value).toBe('Check the ledger');
    expect(screen.getByRole('textbox', { name: 'Note' })).toBe(note);
  });

  it('starts with exactly one selected tab', () => {
    // @ts-expect-error -- Tabs needs `value` or `defaultValue`.
    void (<Tabs>{null}</Tabs>);
  });
});

describe('Menu', () => {
  const items = (onCopy = vi.fn(), onSort = vi.fn(), onSources = vi.fn()): MenuEntry[] => [
    { label: 'Share link', disabledReason: 'Sharing arrives later' },
    { label: 'Copy reference', description: 'Copies the item identifier.', onSelect: onCopy },
    { kind: 'checkbox', label: 'Show sources', checked: false, onChange: onSources },
    {
      kind: 'radio',
      label: 'Sort by',
      value: 'amount',
      onChange: onSort,
      options: [
        { value: 'amount', label: 'Amount' },
        { value: 'date', label: 'Date' },
      ],
    },
  ];

  it('opens on Enter, exposes the expanded state and focuses the first enabled item', async () => {
    const user = userEvent.setup();
    render(<Menu label="Item actions" items={items()} />);
    const trigger = screen.getByRole('button', { name: 'Item actions' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Item actions' });
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Copy reference' }));
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Menu label="Item actions" items={items()} />);
    const trigger = screen.getByRole('button', { name: 'Item actions' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps an unavailable item focusable, with aria-disabled and its reason; Enter does nothing', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<Menu label="Item actions" items={[{ label: 'Copy reference', onSelect: onCopy }, { label: 'Share link', disabledReason: 'Sharing arrives later', onSelect: onCopy }]} />);
    await user.click(screen.getByRole('button', { name: 'Item actions' }));
    await user.keyboard('{ArrowDown}');
    const share = screen.getByRole('menuitem', { name: 'Share link' });
    expect(document.activeElement).toBe(share);
    expect(share.getAttribute('aria-disabled')).toBe('true');
    expect(descriptions(share)).toEqual(['Sharing arrives later']);
    expect(screen.getByText('Sharing arrives later')).toBeTruthy();
    await user.keyboard('{Enter}');
    await user.click(share);
    expect(onCopy).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('navigates with arrows (wrapping), Home and End, and activates on Enter', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<Menu label="Item actions" items={items(onCopy)} />);
    const trigger = screen.getByRole('button', { name: 'Item actions' });
    await user.click(trigger);
    const rows = [...screen.getByRole('menu').querySelectorAll<HTMLElement>('[data-menu-row]')];
    expect(rows).toHaveLength(5);
    expect(document.activeElement).toBe(rows[1]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(rows[4]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(rows[4]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('checks exactly one menuitemradio and shows checkmarks only on selection items', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<Menu label="Item actions" items={items(vi.fn(), onSort)} />);
    await user.click(screen.getByRole('button', { name: 'Item actions' }));
    const group = screen.getByRole('group', { name: 'Sort by' });
    const radios = within(group).getAllByRole('menuitemradio');
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    expect(screen.getByRole('menuitemradio', { name: 'Amount' }).querySelector('.iq-menu-check svg')).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: 'Date' }).querySelector('.iq-menu-check svg')).toBeNull();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show sources' }).getAttribute('aria-checked')).toBe('false');
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.hasAttribute('aria-checked'), item.textContent ?? '').toBe(false);
      expect(item.querySelector('svg'), item.textContent ?? '').toBeNull();
    }
    screen.getByRole('menuitemradio', { name: 'Date' }).focus();
    await user.keyboard(' ');
    expect(onSort).toHaveBeenCalledWith('date');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles a menuitemcheckbox and stays open', async () => {
    const user = userEvent.setup();
    function Checked() {
      const [on, setOn] = useState(false);
      return <Menu label="View" items={[{ kind: 'checkbox', label: 'Show sources', checked: on, onChange: setOn }]} />;
    }
    render(<Checked />);
    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.keyboard('{Enter}');
    const item = screen.getByRole('menuitemcheckbox', { name: 'Show sources' });
    expect(item.getAttribute('aria-checked')).toBe('true');
    expect(item.querySelector('.iq-menu-check svg')).toBeTruthy();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('names items by their label and links the description', async () => {
    const user = userEvent.setup();
    render(<Menu label="Item actions" heading="This item" items={items()} />);
    await user.click(screen.getByRole('button', { name: 'Item actions' }));
    expect(screen.getByRole('menu', { name: 'This item' })).toBeTruthy();
    expect(descriptions(screen.getByRole('menuitem', { name: 'Copy reference' }))).toEqual(['Copies the item identifier.']);
  });

  it('closes on Tab without trapping focus', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu label="Item actions" items={items()} />
        <button type="button">After</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Item actions' });
    await user.click(trigger);
    await user.tab();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
  });

  it('closes on an outside click and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu label="Item actions" items={items()} />
        <p>Outside</p>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Item actions' });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus on another control the outside click focused', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu label="Item actions" items={items()} />
        <input aria-label="Search" />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Item actions' }));
    const search = screen.getByRole('textbox', { name: 'Search' });
    await user.click(search);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(search);
  });

  it('does not reopen when Space activates an item', async () => {
    const user = userEvent.setup();
    render(<Menu label="Item actions" items={items()} />);
    const trigger = screen.getByRole('button', { name: 'Item actions' });
    await user.click(trigger);
    await user.keyboard(' ');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens with defaultOpen without moving focus', () => {
    render(<Menu label="View options" items={items()} defaultOpen />);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('StatusChip', () => {
  it('shows explicit visible text for exactly the seven source states', () => {
    expect([...SOURCE_STATUSES]).toEqual(['suggested', 'investigating', 'open', 'evidence', 'waiting', 'accepted', 'explained']);
    render(
      <>
        {SOURCE_STATUSES.map((status) => (
          <StatusChip key={status} status={status} />
        ))}
      </>,
    );
    for (const status of SOURCE_STATUSES) {
      const chip = screen.getByText(STATUS_TEXT[status]);
      expect(chip.className).toContain(`iq-status-chip--${status}`);
    }
    expect(Object.values(STATUS_TEXT)).toEqual(['Suggested', 'Investigating', 'Open', 'Needs evidence', 'Awaiting client', 'Accepted', 'Explained']);
  });

  it('claims no execution completion, approval or delivery', () => {
    for (const text of Object.values(STATUS_TEXT)) expect(text).not.toMatch(/complete|done|finished|approv|deliver|sign/i);
  });

  it('needs a label for any other state: a type error, and at runtime nothing plus a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error -- a state outside the source taxonomy needs a truthful label.
    const { container } = render(<StatusChip status="blocked" />);
    expect(container.innerHTML).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('blocked');
  });

  it('renders a caller-supplied label for another state in the neutral style', () => {
    render(<StatusChip status="blocked" label="Blocked by policy" />);
    const chip = screen.getByText('Blocked by policy');
    expect(chip.className).toContain('iq-status-chip--other');
  });
});
