/**
 * The design specimen the `--smoke` probe reads. Story 1.5: title, one
 * decorative and one informative icon, and a visually hidden span in each of
 * the five IBM Plex faces. Story 1.6: every primitive in each state, each in
 * a `data-contrast` hook, with the rendered contrast pairs declared on the
 * root in `data-contrast-pairs`. Nothing here performs an operation.
 */
import type { ReactElement, ReactNode } from 'react';

import { CONTRAST_PAIRS } from './design/contrast';
import { Icon } from './icons/Icon';
import { Button, Checkbox, CheckboxGroup, IconButton, RadioGroup, Switch, TextField, type ButtonVariant } from './primitives';

const FACES = [
  ['sans', 400],
  ['sans', 500],
  ['sans', 600],
  ['mono', 400],
  ['mono', 500],
] as const;

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'quiet', 'ghost'];

/** The pairs the probe re-reads from computed styles. */
export const RENDERED_PAIRS = CONTRAST_PAIRS.filter((pair) => pair.render !== null).map(({ id, kind, render }) => ({ id, kind, render }));

function Hook({ name, children }: { name: string; children: ReactNode }): ReactElement {
  return (
    <div className="specimen-hook" data-contrast={name}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="specimen-section" aria-label={title}>
      <h2 className="specimen-heading">{title}</h2>
      <div className="specimen-row">{children}</div>
    </section>
  );
}

export function Specimen(): ReactElement {
  return (
    <main className="specimen" data-contrast-pairs={JSON.stringify(RENDERED_PAIRS)}>
      <h1 className="specimen-title">Inquello</h1>
      <p className="specimen-body">Design tokens, IBM Plex, icon semantics and the core primitives. Desktop features arrive in later stories.</p>

      <Section title="Button">
        {BUTTON_VARIANTS.map((variant) => (
          <Hook key={variant} name={`button-${variant}`}>
            <Button variant={variant} icon={variant === 'primary' ? 'plus' : undefined}>
              {`${variant[0]!.toUpperCase()}${variant.slice(1)}`}
            </Button>
          </Hook>
        ))}
        {BUTTON_VARIANTS.map((variant) => (
          <Hook key={`${variant}-pending`} name={`button-${variant}-pending`}>
            <Button variant={variant} pending>
              {`${variant[0]!.toUpperCase()}${variant.slice(1)} pending`}
            </Button>
          </Hook>
        ))}
        <Hook name="button-disabled">
          <Button variant="primary" disabledReason="No route configured">
            Start
          </Button>
        </Hook>
        <Hook name="button-sizes">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </Hook>
      </Section>

      <Section title="IconButton">
        <Hook name="icon-button-ghost">
          <IconButton icon="settings" label="Settings" />
        </Hook>
        <Hook name="icon-button-outline">
          <IconButton variant="outline" icon="paperclip" label="Attach" />
        </Hook>
        <Hook name="icon-button-active">
          <IconButton variant="active" icon="panel-left" label="Sidebar" pressed />
        </Hook>
        <Hook name="icon-button-expanded">
          <IconButton icon="chevron-down" label="Details" expanded />
        </Hook>
        <Hook name="icon-button-send">
          <IconButton variant="send" label="Send" />
        </Hook>
        <Hook name="icon-button-stop">
          <IconButton variant="stop" label="Stop" />
        </Hook>
        <Hook name="icon-button-disabled">
          <IconButton icon="share-2" label="Share" disabledReason="Sharing arrives later" />
        </Hook>
      </Section>

      <Section title="TextField">
        <Hook name="text-field">
          <TextField label="Reason" instruction="Shown to reviewers." placeholder="Why this change" defaultValue="Matches the ledger" />
        </Hook>
        <Hook name="text-field-multiline">
          <TextField multiline label="Notes" placeholder="Add a note" />
        </Hook>
        <Hook name="text-field-error">
          <TextField label="Amount" defaultValue="12,40" error="Use a full stop for decimals." />
        </Hook>
        <Hook name="text-field-read-only">
          <TextField label="Task" readOnly defaultValue="Q3 reconciliation" />
        </Hook>
        <Hook name="text-field-disabled">
          <TextField label="Route" disabledReason="No route configured" />
        </Hook>
      </Section>

      <Section title="Switch">
        <Hook name="switch-off">
          <Switch label="Apply method" />
        </Hook>
        <Hook name="switch-on">
          <Switch label="Show checks" defaultChecked />
        </Hook>
        <Hook name="switch-disabled">
          <Switch label="Automation" disabledReason="Automations arrive later" />
        </Hook>
      </Section>

      <Section title="Choice">
        <Hook name="checkbox-unselected">
          <Checkbox label="Include notes" />
        </Hook>
        <Hook name="checkbox-selected">
          <Checkbox label="Include sources" defaultChecked />
        </Hook>
        <Hook name="radio-group">
          <RadioGroup
            legend="Scope"
            instruction="Choose one."
            defaultValue="task"
            options={[
              { value: 'task', label: 'This Task' },
              { value: 'engagement', label: 'This Engagement' },
            ]}
          />
        </Hook>
        <Hook name="card-group">
          <RadioGroup
            legend="Treatment"
            defaultValue="explain"
            options={[
              { value: 'explain', label: 'Explain', description: 'Record why the difference is acceptable.' },
              { value: 'adjust', label: 'Adjust', description: 'Propose a correcting entry.' },
            ]}
          />
        </Hook>
        <Hook name="choice-disabled">
          <CheckboxGroup legend="Exports">
            <Checkbox label="Workbook" />
            <Checkbox label="Share link" disabledReason="Sharing arrives later" />
          </CheckboxGroup>
        </Hook>
      </Section>

      <div className="specimen-icons">
        <span className="specimen-icon-row" data-probe="icon-decorative">
          <Icon name="search" />
          <span>Search</span>
        </span>
        <span className="specimen-icon-row" data-probe="icon-informative">
          <Icon name="triangle-alert" label="Needs evidence" />
        </span>
      </div>
      <div className="specimen-weights" aria-hidden="true">
        {FACES.map(([family, weight]) => (
          <span key={`${family}-${weight}`} className={`specimen-${family} specimen-${weight}`}>
            Inquello {family} {weight}
          </span>
        ))}
      </div>
    </main>
  );
}
