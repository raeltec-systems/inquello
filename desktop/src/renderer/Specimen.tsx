/**
 * The design specimen the `--smoke` probe reads. Story 1.5: title, one
 * decorative and one informative icon, and a visually hidden span in each of
 * the five IBM Plex faces. Story 1.6: every primitive in each state, each in
 * a `data-contrast` hook, with the rendered contrast pairs declared on the
 * root in `data-contrast-pairs`. Story 1.7: Avatar, Badge, SegmentedControl,
 * Tabs, Menu (closed for the focus probe, and open for its item pairs) and
 * every StatusChip state. Story 1.8: every JudgmentTag kind, FileChip type
 * and state, PlanStep state (the running one is what the probe watches under
 * reduced motion), an ApprovalCard, every DiffLine kind and stage, and a
 * persistent Toast. Story 1.10b adds the Account block, the one part that
 * performs operations: sign-in, sign-out and the identity status through the
 * named `inquello.identity` operations. Nothing else here performs one.
 */
import type { ReactElement, ReactNode } from 'react';

import { Account } from './Account';
import { CONTRAST_PAIRS } from './design/contrast';
import { Icon } from './icons/Icon';
import {
  ApprovalCard,
  Avatar,
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  DiffLine,
  FileChip,
  IconButton,
  JudgmentTag,
  Menu,
  PlanSteps,
  RadioGroup,
  SegmentedControl,
  SOURCE_STATUSES,
  StatusChip,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Toast,
  type ButtonVariant,
  type MenuEntry,
  type PlanStepItem,
} from './primitives';

const FACES = [
  ['sans', 400],
  ['sans', 500],
  ['sans', 600],
  ['mono', 400],
  ['mono', 500],
] as const;

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'quiet', 'ghost'];

const MENU_ITEMS: readonly MenuEntry[] = [
  { label: 'Copy reference', description: 'Copies the item identifier.' },
  { kind: 'checkbox', label: 'Show sources', checked: true },
  {
    kind: 'radio',
    label: 'Sort by',
    value: 'amount',
    options: [
      { value: 'amount', label: 'Amount' },
      { value: 'date', label: 'Date' },
    ],
  },
  { label: 'Share link', disabledReason: 'Sharing arrives later' },
];

const PLAN: readonly PlanStepItem[] = [
  { id: 'read', label: 'Read the bank statement', state: 'done', meta: '42 lines' },
  { id: 'match', label: 'Match statement lines to the ledger', state: 'running' },
  { id: 'explain', label: 'Explain the unmatched items', state: 'pending' },
  { id: 'request', label: 'Request the October statement', state: 'blocked' },
  { id: 'export', label: 'Export the workbook', state: 'failed' },
  { id: 'notes', label: 'Draft review notes', state: 'interrupted' },
];

/** Specimen handlers do nothing: no primitive performs an operation. */
const noop = (): void => {};

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

      <Section title="Account">
        <Account />
      </Section>

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

      <Section title="Avatar">
        <Hook name="avatar-blue">
          <Avatar name="Dana Osei" initials="DO" />
        </Hook>
        <Hook name="avatar-green">
          <Avatar name="Mia Laine" initials="ML" tone="green" />
        </Hook>
        <Hook name="avatar-amber">
          <Avatar name="Ravi Shah" initials="RS" tone="amber" size={32} />
        </Hook>
        <Hook name="avatar-decided">
          <Avatar name="Dana Osei" initials="DO" decided={{ recordedIdentity: 'Dana Osei' }} />
        </Hook>
        <Hook name="avatar-agent">
          <Avatar kind="agent" size={20} />
          <Avatar kind="agent" />
          <Avatar kind="agent" size={32} />
        </Hook>
      </Section>

      <Section title="Badge">
        <Hook name="badge-attention">
          <Badge count={3} label="items need evidence" />
        </Hook>
        <Hook name="badge-neutral">
          <Badge count={12} label="open items" tone="neutral" />
        </Hook>
        <Hook name="badge-accent">
          <Badge count={2} label="suggestions" tone="accent" />
        </Hook>
      </Section>

      <Section title="SegmentedControl">
        <Hook name="segmented">
          <SegmentedControl
            label="Artifact view"
            defaultValue="summary"
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'items', label: 'Reconciling items' },
            ]}
          />
        </Hook>
      </Section>

      <Section title="Tabs">
        <Hook name="tabs">
          <Tabs defaultValue="changes">
            <TabList label="Artifact views">
              <Tab value="changes" count={3}>
                Changes
              </Tab>
              <Tab value="preview">Preview</Tab>
              <Tab value="summary" count={12}>
                Summary
              </Tab>
            </TabList>
            <TabPanel value="changes">Three proposed changes.</TabPanel>
            <TabPanel value="preview">Preview of the workbook.</TabPanel>
            <TabPanel value="summary">Twelve reconciling items.</TabPanel>
          </Tabs>
        </Hook>
      </Section>

      <Section title="Menu">
        <Hook name="menu-trigger">
          <Menu label="Item actions" items={MENU_ITEMS} />
        </Hook>
        <Hook name="menu-open">
          <Menu label="View options" heading="This item" items={MENU_ITEMS} defaultOpen />
        </Hook>
      </Section>

      <Section title="StatusChip">
        {SOURCE_STATUSES.map((status) => (
          <Hook key={status} name={`status-${status}`}>
            <StatusChip status={status} />
          </Hook>
        ))}
        <Hook name="status-other">
          <StatusChip status="unlinked" label="Thread unlinked" />
        </Hook>
        <Hook name="status-decided">
          <StatusChip status="accepted" decidedBy={{ name: 'Dana Osei', initials: 'DO', recordedIdentity: 'specimen:dana-osei' }} />
        </Hook>
      </Section>

      <Section title="JudgmentTag">
        <Hook name="judgment-calculation">
          <JudgmentTag kind="calculation">Unreconciled difference 1,240.00</JudgmentTag>
        </Hook>
        <Hook name="judgment-observation">
          <JudgmentTag kind="observation">Two deposits post a day late</JudgmentTag>
        </Hook>
        <Hook name="judgment-suggestion">
          <JudgmentTag kind="suggestion">Treat as a timing difference</JudgmentTag>
        </Hook>
        <Hook name="judgment-decision">
          <JudgmentTag kind="decision" basis={{ by: 'Dana Osei', scope: 'Q3 bank reconciliation' }}>
            Accept the timing difference
          </JudgmentTag>
        </Hook>
        <Hook name="judgment-gap">
          <JudgmentTag kind="gap" uppercase={false}>
            No statement for October
          </JudgmentTag>
        </Hook>
      </Section>

      <Section title="FileChip">
        <Hook name="file-pdf">
          <FileChip type="pdf" name="bank-statement-sep.pdf" source="Uploaded from this computer" />
        </Hook>
        <Hook name="file-xls">
          <FileChip type="xls" name="ledger-q3.xlsx" />
        </Hook>
        <Hook name="file-doc">
          <FileChip type="doc" name="policy-memo.docx" />
        </Hook>
        <Hook name="file-folder">
          <FileChip type="folder" name="Q3 evidence" />
        </Hook>
        <Hook name="file-other">
          <FileChip type="csv" typeLabel="CSV" name="bank-feed.csv" />
        </Hook>
        <Hook name="file-chip-remove">
          <FileChip type="xls" name="trial-balance.xlsx" onRemove={noop} />
        </Hook>
        <Hook name="file-failed">
          <FileChip type="pdf" name="scan-001.pdf" state="failed" />
        </Hook>
        <Hook name="file-unreadable">
          <FileChip type="pdf" name="scan-002.pdf" state="unreadable" />
        </Hook>
        <Hook name="file-permission-limited">
          <FileChip type="folder" name="Payroll" state="permission-limited" />
        </Hook>
      </Section>

      <Section title="PlanStep">
        <Hook name="plan-steps">
          <PlanSteps label="Plan" steps={PLAN} />
        </Hook>
      </Section>

      <Section title="ApprovalCard">
        <Hook name="approval approval-primary">
          <ApprovalCard
            context="Subsequent clearance · R4"
            action="Send the October statement request to Northwind Ltd"
            destination="accounts@northwind.example, by email"
            consequence="Northwind receives the request; the Task waits for their reply."
            quote="Please send the October bank statement for account 4471."
            primaryLabel="Send October statement request"
            onPrimary={noop}
            alternatives={[{ label: 'Edit the request', onSelect: noop }]}
          />
        </Hook>
      </Section>

      <Section title="DiffLine">
        <Hook name="diff">
          <div className="specimen-diff">
            <DiffLine kind="context" stage="suggested" gutter="R13">
              Opening balance 18,400.00
            </DiffLine>
            <DiffLine kind="delete" stage="suggested" gutter="R14">
              Deposit 1,240.00 unmatched
            </DiffLine>
            <DiffLine kind="add" stage="applied-locally" gutter="R14">
              Deposit 1,240.00 matched to 2 Oct
            </DiffLine>
            <DiffLine kind="change" stage="delivered" gutter="R15">
              Closing balance 19,640.00
            </DiffLine>
          </div>
        </Hook>
      </Section>

      <Section title="Toast">
        <Hook name="toast">
          <Toast>Copied the item reference</Toast>
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
