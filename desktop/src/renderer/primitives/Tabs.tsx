/**
 * `Tabs`, `TabList`, `Tab` and `TabPanel`: switch between views of the same
 * work (DESIGN.md `components.Tabs`).
 *
 * - WAI-ARIA tabs: `role="tablist"` (named by `label`), `<button role="tab">`
 *   with `aria-selected` and `aria-controls`, `role="tabpanel"` labelled by
 *   its tab.
 * - One tab stop (the selected tab). ArrowRight/ArrowLeft move focus to the
 *   next or previous tab, wrapping; Home and End to the first and last.
 * - `activation="manual"` (the default): moving focus does not select;
 *   Enter or Space (native button activation) selects the focused tab.
 *   `activation="automatic"` selects on focus and is opt-in.
 * - Every panel stays mounted; an unselected one is only `hidden`, so a
 *   panel's own state (scroll, typed text, selected row) survives switching.
 *
 * Selecting only changes the view and reports the value through `onChange`.
 */
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import { idFragment, rovingIndex } from './shared';

export type TabsActivation = 'manual' | 'automatic';

interface TabsContextValue {
  baseId: string;
  selected: string;
  activation: TabsActivation;
  select: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`${component} must be inside <Tabs>`);
  return context;
}

const tabId = (baseId: string, value: string) => `${baseId}tab-${idFragment(value)}`;
const panelId = (baseId: string, value: string) => `${baseId}panel-${idFragment(value)}`;

interface TabsCommonProps {
  /** Manual by default: focus moves on arrows, Enter or Space selects. */
  activation?: TabsActivation;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/** Exactly one tab is selected from the start: pass `value` (controlled) or `defaultValue`. */
export type TabsProps = TabsCommonProps & ({ value: string; defaultValue?: never } | { value?: never; defaultValue: string });

export function Tabs({ activation = 'manual', onChange, children, className, ...selection }: TabsProps): ReactElement {
  const baseId = useId();
  const [local, setLocal] = useState(selection.defaultValue ?? '');
  const controlled = selection.value !== undefined;
  const selected = controlled ? selection.value! : local;
  const select = (value: string) => {
    if (!controlled) setLocal(value);
    if (value !== selected) onChange?.(value);
  };
  return (
    <TabsContext.Provider value={{ baseId, selected, activation, select }}>
      <div className={['iq-tabs', className].filter(Boolean).join(' ')}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  /** Accessible name of the tab list. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function TabList({ label, children, className }: TabListProps): ReactElement {
  const { activation, select } = useTabs('TabList');
  const listRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const target = rovingIndex(event.key, index, tabs.length, 'horizontal');
    if (target === null) return;
    event.preventDefault();
    const tab = tabs[target]!;
    tab.focus();
    if (activation === 'automatic' && tab.dataset.value !== undefined) select(tab.dataset.value);
  };
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={['iq-tab-list', className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  /** Visible label and accessible name. */
  children: string;
  /** Optional count shown after the label, in the muted 11px mono. */
  count?: number;
  className?: string;
}

export function Tab({ value, children, count, className }: TabProps): ReactElement {
  const { baseId, selected, select } = useTabs('Tab');
  const isSelected = value === selected;
  return (
    <button
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-selected={isSelected}
      aria-controls={panelId(baseId, value)}
      tabIndex={isSelected ? 0 : -1}
      data-value={value}
      className={['iq-tab', className].filter(Boolean).join(' ')}
      onClick={() => select(value)}
    >
      <span className="iq-tab-label">{children}</span>
      {/* The space keeps the accessible name "Changes 3", not "Changes3"; flex layout drops it visually. */}
      {count !== undefined ? ' ' : null}
      {count !== undefined ? <span className="iq-tab-count">{count}</span> : null}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps): ReactElement {
  const { baseId, selected } = useTabs('TabPanel');
  return (
    <div
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      hidden={value !== selected}
      tabIndex={0}
      className={['iq-tab-panel', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
