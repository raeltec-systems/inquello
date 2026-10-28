// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.6: the action and input primitives, in jsdom with Testing Library
 * and user-event. Every row of the spec's I/O matrix, plus the component
 * tokens, the token-only CSS and the specimen's contrast hooks.
 */
import fs from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { CONTRAST_PAIRS } from '../src/renderer/design/contrast';
import { components, resolveToken, rounded, spacing, typography } from '../src/renderer/design/tokens';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  DEFAULT_PENDING_TEXT,
  IconButton,
  RadioGroup,
  Switch,
  TextField,
} from '../src/renderer/primitives';
import { RENDERED_PAIRS, Specimen } from '../src/renderer/Specimen';

const desktop = path.resolve(__dirname, '..');
const primitivesDir = path.join(desktop, 'src', 'renderer', 'primitives');
const css = fs.readFileSync(path.join(primitivesDir, 'primitives.css'), 'utf8');
const designMd = fs.readFileSync(
  path.resolve(desktop, '..', '_bmad-output', 'planning-artifacts', 'ux-designs', 'ux-inquello-2026-10-26', 'DESIGN.md'),
  'utf8',
);

afterEach(() => cleanup());

/** The element's `aria-describedby` targets' text, in order. */
function descriptions(element: HTMLElement): string[] {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `<missing ${id}>`);
}

describe('Button', () => {
  it('activates once on Enter and once on Space after Tab', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save draft</Button>);
    await user.tab();
    const button = screen.getByRole('button', { name: 'Save draft' });
    expect(button).toBe(document.activeElement);
    await user.keyboard('{Enter}');
    expect(onPress).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('ignores repeat activation while pending, marks aria-busy and keeps its label', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <Button variant="primary" pending onPress={onPress}>
        Send request
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Send request' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    await user.click(button);
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    expect(onPress).not.toHaveBeenCalled();
    expect(within(button).getByText('Send request')).toBeTruthy();
    expect(descriptions(button)).toEqual([DEFAULT_PENDING_TEXT]);
    expect(screen.getByText(DEFAULT_PENDING_TEXT)).toBeTruthy();
    expect(button.querySelector('.iq-spinner')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps focus and the same element when pending toggles', () => {
    const { rerender } = render(<Button>Run</Button>);
    const button = screen.getByRole('button', { name: 'Run' });
    button.focus();
    rerender(<Button pending>Run</Button>);
    expect(screen.getByRole('button', { name: 'Run' })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('is not activatable with a disabled reason, which is visible and linked', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <Button disabledReason="No route configured" onPress={onPress}>
        Start
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter} ');
    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(descriptions(button)).toEqual(['No route configured']);
    expect(screen.getByText('No route configured')).toBeTruthy();
  });

  it('does not submit a form while unavailable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" disabledReason="Fill in the reason first">
          Submit
        </Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders a decorative leading icon and keeps the text as the name', () => {
    render(
      <Button icon="plus" variant="quiet" size="lg">
        New Task
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'New Task' });
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.className).toContain('iq-button--quiet');
    expect(button.className).toContain('iq-button--lg');
  });

  it('has no bare disabled prop', () => {
    // @ts-expect-error -- unavailability always carries a reason.
    void (<Button disabled>Start</Button>);
  });
});

describe('IconButton', () => {
  it('requires a label at the type level and uses it as the accessible name', () => {
    // @ts-expect-error -- an icon-only button without a label is a type error.
    void (<IconButton icon="settings" />);
    render(<IconButton icon="settings" label="Settings" />);
    const button = screen.getByRole('button', { name: 'Settings' });
    expect(button.getAttribute('aria-label')).toBe('Settings');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('reflects expanded and pressed state', () => {
    const { rerender } = render(<IconButton icon="chevron-down" label="Details" expanded={false} />);
    const button = screen.getByRole('button', { name: 'Details' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    rerender(<IconButton icon="chevron-down" label="Details" expanded />);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    rerender(<IconButton icon="panel-left" label="Details" pressed />);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    rerender(<IconButton icon="panel-left" label="Details" />);
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.hasAttribute('aria-expanded')).toBe(false);
  });

  it('activates from the keyboard and renders round send and stop', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onStop = vi.fn();
    render(
      <>
        <IconButton variant="send" label="Send" onPress={onSend} />
        <IconButton variant="stop" label="Stop" onPress={onStop} />
      </>,
    );
    await user.tab();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.keyboard(' ');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(stop.className).toContain('iq-icon-button--round');
    expect(stop.querySelector('.iq-icon-button-stop')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Send' }).querySelector('svg')).toBeTruthy();
  });

  it('shows and links a disabled reason and ignores activation', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<IconButton icon="share-2" label="Share" disabledReason="Sharing arrives later" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Share' });
    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(descriptions(button)).toEqual(['Sharing arrives later']);
  });
});

describe('Switch', () => {
  it('flips aria-checked and the visible On/Off text on Space and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Apply method" onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Apply method' });
    expect(control.tagName).toBe('BUTTON');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.textContent).toContain('Off');
    await user.tab();
    await user.keyboard(' ');
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(control.textContent).toContain('On');
    await user.keyboard('{Enter}');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('follows a controlled value', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [on, setOn] = useState(true);
      return <Switch label="Show checks" checked={on} onChange={setOn} />;
    }
    render(<Controlled />);
    const control = screen.getByRole('switch', { name: 'Show checks' });
    expect(control.getAttribute('aria-checked')).toBe('true');
    await user.click(control);
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('does not change while disabled and links the reason', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Automation" disabledReason="Automations arrive later" onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Automation' });
    await user.tab();
    await user.keyboard(' ');
    await user.click(control);
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.textContent).toContain('Off');
    expect(onChange).not.toHaveBeenCalled();
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(descriptions(control)).toEqual(['Automations arrive later']);
  });
});

describe('Choice', () => {
  const options = [
    { value: 'task', label: 'This Task' },
    { value: 'engagement', label: 'This Engagement', description: 'Every Task in the Engagement.' },
    { value: 'workspace', label: 'This Workspace' },
  ];

  it('groups radios in a fieldset with a legend', () => {
    render(<RadioGroup legend="Scope" instruction="Choose one." options={options} defaultValue="task" />);
    const group = screen.getByRole('group', { name: 'Scope' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')?.textContent).toBe('Scope');
    expect(descriptions(group)).toEqual(['Choose one.']);
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });

  it('selects and focuses the next option on ArrowDown and reports its value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RadioGroup legend="Scope" options={options} defaultValue="task" onChange={onChange} />);
    await user.tab();
    const first = screen.getByRole('radio', { name: 'This Task' });
    expect(document.activeElement).toBe(first);
    await user.keyboard('{ArrowDown}');
    const second = screen.getByRole('radio', { name: 'This Engagement' });
    expect(document.activeElement).toBe(second);
    expect((second as HTMLInputElement).checked).toBe(true);
    expect((first as HTMLInputElement).checked).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith('engagement');
  });

  it('makes a described option a card whose description is linked, not part of the name', () => {
    render(<RadioGroup legend="Scope" options={options} />);
    const radio = screen.getByRole('radio', { name: 'This Engagement' });
    expect(descriptions(radio)).toEqual(['Every Task in the Engagement.']);
    expect(radio.closest('.iq-choice')?.className).toContain('iq-choice--card');
  });

  it('toggles a checkbox on Space independently of its siblings', async () => {
    const user = userEvent.setup();
    render(
      <CheckboxGroup legend="Exports">
        <Checkbox label="Workbook" />
        <Checkbox label="Summary" defaultChecked />
      </CheckboxGroup>,
    );
    expect(screen.getByRole('group', { name: 'Exports' }).tagName).toBe('FIELDSET');
    const workbook = screen.getByRole('checkbox', { name: 'Workbook' }) as HTMLInputElement;
    const summary = screen.getByRole('checkbox', { name: 'Summary' }) as HTMLInputElement;
    await user.tab();
    expect(document.activeElement).toBe(workbook);
    await user.keyboard(' ');
    expect(workbook.checked).toBe(true);
    expect(summary.checked).toBe(true);
    await user.tab();
    await user.keyboard(' ');
    expect(summary.checked).toBe(false);
    expect(workbook.checked).toBe(true);
  });

  it('disables an option or a whole group with a visible, linked reason', () => {
    render(
      <>
        <RadioGroup legend="Route" options={[{ value: 'local', label: 'Local' }, { value: 'remote', label: 'Remote', disabledReason: 'No route configured' }]} />
        <RadioGroup legend="Mode" disabledReason="Policy fixes the mode" options={[{ value: 'a', label: 'A' }]} />
      </>,
    );
    const remote = screen.getByRole('radio', { name: 'Remote' }) as HTMLInputElement;
    expect(remote.disabled).toBe(true);
    expect(descriptions(remote)).toEqual(['No route configured']);
    const mode = screen.getByRole('group', { name: 'Mode' }) as HTMLFieldSetElement;
    expect(mode.disabled).toBe(true);
    expect(descriptions(mode)).toEqual(['Policy fixes the mode']);
  });
});

describe('TextField', () => {
  it('keeps typed text when an error is set and links the error', async () => {
    const user = userEvent.setup();
    function Validated() {
      const [error, setError] = useState<string>();
      return <TextField label="Amount" instruction="Two decimals." placeholder="0.00" error={error} onChange={(value) => setError(/^\d+\.\d\d$/.test(value) ? undefined : 'Use two decimals.')} />;
    }
    render(<Validated />);
    const field = screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement;
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    await user.type(field, '12,4');
    expect(field.value).toBe('12,4');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(descriptions(field)).toEqual(['Two decimals.', 'Use two decimals.']);
    expect(screen.getByText('Use two decimals.')).toBeTruthy();
  });

  it('has a persistent label that is not the placeholder', async () => {
    const user = userEvent.setup();
    render(<TextField label="Reason" placeholder="Why this change" />);
    const field = screen.getByRole('textbox', { name: 'Reason' }) as HTMLInputElement;
    expect(field.labels?.[0]?.textContent).toBe('Reason');
    expect(field.placeholder).toBe('Why this change');
    await user.type(field, 'Matches');
    expect(screen.getByText('Reason').tagName).toBe('LABEL');
    expect(screen.getByRole('textbox', { name: 'Reason' })).toBe(field);
  });

  it('renders multiline, read-only and disabled states', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextField multiline rows={3} label="Notes" />
        <TextField label="Task" readOnly defaultValue="Q3 reconciliation" />
        <TextField label="Route" disabledReason="No route configured" />
      </>,
    );
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes.getAttribute('rows')).toBe('3');
    const task = screen.getByRole('textbox', { name: 'Task' }) as HTMLInputElement;
    await user.type(task, 'x');
    expect(task.value).toBe('Q3 reconciliation');
    expect(task.readOnly).toBe(true);
    const route = screen.getByRole('textbox', { name: 'Route' }) as HTMLInputElement;
    expect(route.disabled).toBe(true);
    expect(descriptions(route)).toEqual(['No route configured']);
  });
});

describe('component tokens', () => {
  const design = parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(designMd)![1]!) as { components: Record<string, Record<string, string>> };

  it.each(Object.keys(components))('%s equals DESIGN.md components, both ways', (name) => {
    expect(components[name as keyof typeof components]).toEqual(design.components[name]);
  });

  it('resolves references and rejects unknown ones', () => {
    expect(resolveToken(components.TextField.border)).toBe('#5b636e');
    expect(resolveToken(components.TextField.focusRing)).toBe('0 0 0 3px #dfe7f5');
    expect(resolveToken(components.Button.height)).toBe('28px');
    expect(() => resolveToken('{colors.nope}')).toThrow(/unknown token reference/);
  });
});

describe('primitives.css', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('uses colours only through token variables', () => {
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('uses only token sizes and the .45 disabled opacity', () => {
    const tokenSizes = new Set<string>([
      ...Object.values(spacing),
      ...Object.values(rounded),
      ...Object.values(components).flatMap((group) => Object.values(group).map((value) => resolveToken(value))),
      ...Object.values(typography).map((role) => role.fontSize),
      ...resolveToken(components.TextField.focusRing).split(' '),
      // DESIGN.md component table literals: TextField 7×9px padding, checkbox 4px radius, 9px stop square.
      '7px', '9px', '4px',
      // The 1px border width of every source component.
      '1px',
    ]);
    const used = [...rules.matchAll(/(\d+(?:\.\d+)?px)/g)].map((match) => match[1]!);
    expect(used.filter((size) => !tokenSizes.has(size))).toEqual([]);
    const opacities = [...rules.matchAll(/opacity:\s*([\d.]+)/g)].map((match) => match[1]);
    expect(new Set(opacities)).toEqual(new Set([components.Button.disabledOpacity, '0']));
  });

  it('marks focus with the blue-600 edge and the 3px blue-150 ring', () => {
    expect(rules).toMatch(/\.iq-button:focus-visible,[\s\S]*?\{\s*outline: 1px solid var\(--blue-600\);\s*outline-offset: 3px;\s*box-shadow: 0 0 0 3px var\(--blue-150\);/);
    expect(rules).toMatch(/\.iq-field-control:focus-visible \{\s*border-color: var\(--blue-600\);\s*box-shadow: 0 0 0 3px var\(--blue-150\);/);
  });

  it('uses the essential ink-600 boundary for the field, the off switch and unselected choices', () => {
    expect(rules).toMatch(/\.iq-field-control \{[^}]*border: 1px solid var\(--ink-600\);/);
    expect(rules).toMatch(/\.iq-switch-track \{[^}]*border: 1px solid var\(--ink-600\);/);
    expect(rules).toMatch(/\.iq-choice-box \{[^}]*border: 1px solid var\(--ink-600\);/);
  });

  it('removes the spin under reduced motion and animates nothing else', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(rules);
    expect(reduced?.[1]).toMatch(/\.iq-spinner \{\s*animation: none;/);
    const animations = [...rules.matchAll(/animation:\s*([^;]+);/g)].map((match) => match[1]!.trim());
    expect(animations).toEqual(['iq-spin var(--spin-duration) linear infinite', 'none']);
  });

  it('keeps the pending text visible: it is a DOM node, not an animation', () => {
    render(<Button pending>Save</Button>);
    expect(screen.getByText(DEFAULT_PENDING_TEXT).className).toBe('iq-note');
  });
});

describe('primitive sources', () => {
  const sources = fs.readdirSync(primitivesDir).filter((file) => file.endsWith('.tsx'));

  it('add no key handling of their own and no business operations', () => {
    for (const file of sources) {
      const source = fs.readFileSync(path.join(primitivesDir, file), 'utf8');
      expect(source, file).not.toMatch(/onKey(Down|Up|Press)|addEventListener/);
      expect(source, file).not.toMatch(/window\.inquello|fetch\(|ipc/);
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    }
  });
});

describe('specimen', () => {
  it('renders every hook and selector the rendered pairs read', () => {
    render(<Specimen />);
    const main = document.querySelector('main')!;
    expect(JSON.parse(main.getAttribute('data-contrast-pairs')!)).toEqual(RENDERED_PAIRS);
    expect(RENDERED_PAIRS.length).toBe(CONTRAST_PAIRS.filter((pair) => pair.render).length);
    const missing: string[] = [];
    for (const { id, render: target } of RENDERED_PAIRS) {
      const hook = document.querySelector(`[data-contrast~="${target!.hook}"]`);
      if (!hook) {
        missing.push(`${id}: hook ${target!.hook}`);
        continue;
      }
      for (const read of [target!.foreground, target!.adjacent]) {
        if (read.selector !== ':scope' && !hook.querySelector(read.selector)) missing.push(`${id}: ${read.selector}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('labels every control', () => {
    render(<Specimen />);
    const controls = [...document.querySelectorAll<HTMLElement>('button, input, textarea')];
    expect(controls.length).toBeGreaterThan(20);
    for (const control of controls) {
      const name = control.getAttribute('aria-label') ?? control.getAttribute('aria-labelledby') ?? (control as HTMLInputElement).labels?.[0]?.textContent ?? control.textContent;
      expect(name?.trim(), control.outerHTML.slice(0, 80)).toBeTruthy();
    }
  });
});
