/**
 * `Menu`: a trigger button and a floating list of context actions or
 * selections (DESIGN.md `components.Menu`).
 *
 * - The trigger is a native `<button>` with `aria-haspopup="menu"` and
 *   `aria-expanded`; activating it (click, Enter or Space) opens the menu and
 *   focuses the first enabled item.
 * - In the menu, ArrowDown/ArrowUp move focus (wrapping), Home and End go to
 *   the first and last item, and Enter or Space activates the focused item.
 *   Unavailable items are reached too: they stay listed and focusable with
 *   `aria-disabled`, their reason visible and linked, and activating them
 *   does nothing.
 * - Escape closes the menu and returns focus to the trigger; so does a click
 *   outside the menu (unless that click focused another control). Tab closes
 *   it and focus continues in page order from the trigger.
 * - Item kinds: `action` (`menuitem`, never a checkmark), `checkbox`
 *   (`menuitemcheckbox`) and a `radio` group (`menuitemradio`, exactly one
 *   checked). Only the last two show a checkmark, and only when checked.
 * - Placement is simple anchoring below the trigger; no positioning library.
 *
 * Items only call the caller's handlers; the menu performs nothing itself.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import type { ButtonVariant } from './Button';
import { DENSE_ICON_SIZE, describedBy, idFragment, Note, rovingIndex } from './shared';

interface ItemText {
  label: string;
  /** Secondary text, linked through `aria-describedby`. */
  description?: string;
  /** Why the item is unavailable. It stays listed and focusable; activation does nothing. */
  disabledReason?: string;
}

export interface MenuAction extends ItemText {
  kind?: 'action';
  onSelect?: () => void;
}

export interface MenuCheckbox extends ItemText {
  kind: 'checkbox';
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

export interface MenuRadioOption extends ItemText {
  value: string;
}

export interface MenuRadioGroup {
  kind: 'radio';
  /** Accessible name of the group. */
  label: string;
  /** The one checked option. */
  value: string;
  options: readonly MenuRadioOption[];
  onChange?: (value: string) => void;
}

export type MenuEntry = MenuAction | MenuCheckbox | MenuRadioGroup;

export interface MenuProps {
  /** Visible trigger text and its accessible name. */
  label: string;
  /** Muted heading at the top of the list; also names the menu. */
  heading?: string;
  items: readonly MenuEntry[];
  triggerVariant?: ButtonVariant;
  /** Open on first render without moving focus (specimens). */
  defaultOpen?: boolean;
  className?: string;
}

const ROW = '[data-menu-row]';

const unavailable = (item: ItemText) => item.disabledReason !== undefined && item.disabledReason !== '';

interface RowProps extends ItemText {
  id: string;
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  checked?: boolean;
  /** Reserve the checkmark column (the menu holds selectable items). */
  checkColumn: boolean;
  onActivate: () => void;
}

function Row({ id, role, label, description, disabledReason, checked, checkColumn, onActivate }: RowProps): ReactElement {
  const off = unavailable({ label, disabledReason });
  const hasDescription = description !== undefined && description !== '';
  const selectable = role !== 'menuitem';
  return (
    <div
      id={id}
      role={role}
      tabIndex={-1}
      data-menu-row=""
      aria-checked={selectable ? checked === true : undefined}
      aria-disabled={off ? true : undefined}
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy(hasDescription && `${id}-description`, off && `${id}-reason`)}
      className={['iq-menu-item', off && 'iq-menu-item--disabled'].filter(Boolean).join(' ')}
      onClick={() => {
        if (!off) onActivate();
      }}
    >
      {checkColumn ? (
        <span className="iq-menu-check" aria-hidden="true">
          {selectable && checked ? <Icon name="check" size={DENSE_ICON_SIZE} /> : null}
        </span>
      ) : null}
      <span className="iq-menu-text">
        <span id={`${id}-label`} className="iq-menu-label">
          {label}
        </span>
        {hasDescription ? (
          <span id={`${id}-description`} className="iq-menu-description">
            {description}
          </span>
        ) : null}
        {off ? <Note id={`${id}-reason`}>{disabledReason!}</Note> : null}
      </span>
    </div>
  );
}

export function Menu({ label, heading, items, triggerVariant = 'secondary', defaultOpen = false, className }: MenuProps): ReactElement {
  const baseId = useId();
  const triggerId = `${baseId}trigger`;
  const menuId = `${baseId}menu`;
  const headingId = `${baseId}heading`;
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef(false);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Opening by the trigger focuses the first enabled item (or the first item when none is enabled).
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    const rows = [...(menuRef.current?.querySelectorAll<HTMLElement>(ROW) ?? [])];
    (rows.find((row) => row.getAttribute('aria-disabled') !== 'true') ?? rows[0])?.focus();
  }, [open]);

  // A click outside closes the menu and returns focus to the trigger, unless
  // the click itself focused another control (focus is never pulled away from it).
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
      const active = document.activeElement;
      if (!active || active === document.body || (root && root.contains(active))) triggerRef.current?.focus();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      // Close and let Tab continue in page order from the trigger.
      close(true);
      return;
    }
    const rows = [...(menuRef.current?.querySelectorAll<HTMLElement>(ROW) ?? [])];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      rows[index]?.click();
      return;
    }
    const target = rovingIndex(event.key, Math.max(index, 0), rows.length, 'vertical');
    if (target === null) return;
    event.preventDefault();
    rows[index < 0 && event.key === 'ArrowDown' ? 0 : target]?.focus();
  };

  const checkColumn = items.some((item) => item.kind === 'checkbox' || item.kind === 'radio');
  const rows: ReactNode[] = items.map((item, index) => {
    const id = `${menuId}-${index}`;
    if (item.kind === 'radio') {
      return (
        <div key={id} role="group" aria-label={item.label} className="iq-menu-group">
          {item.options.map((option) => (
            <Row
              key={option.value}
              id={`${id}-${idFragment(option.value)}`}
              role="menuitemradio"
              label={option.label}
              description={option.description}
              disabledReason={option.disabledReason}
              checked={option.value === item.value}
              checkColumn={checkColumn}
              onActivate={() => {
                if (option.value !== item.value) item.onChange?.(option.value);
                close(true);
              }}
            />
          ))}
        </div>
      );
    }
    if (item.kind === 'checkbox') {
      return (
        <Row
          key={id}
          id={id}
          role="menuitemcheckbox"
          label={item.label}
          description={item.description}
          disabledReason={item.disabledReason}
          checked={item.checked}
          checkColumn={checkColumn}
          onActivate={() => item.onChange?.(!item.checked)}
        />
      );
    }
    return (
      <Row
        key={id}
        id={id}
        role="menuitem"
        label={item.label}
        description={item.description}
        disabledReason={item.disabledReason}
        checkColumn={checkColumn}
        onActivate={() => {
          close(true);
          item.onSelect?.();
        }}
      />
    );
  });

  return (
    <span ref={rootRef} className={['iq-menu-root', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`iq-button iq-button--${triggerVariant} iq-button--md iq-menu-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) {
            close(false);
            return;
          }
          focusOnOpen.current = true;
          setOpen(true);
        }}
      >
        <span className="iq-button-label">{label}</span>
        <Icon name="chevron-down" size={DENSE_ICON_SIZE} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={heading ? headingId : triggerId}
          aria-orientation="vertical"
          className="iq-menu"
          onKeyDown={handleMenuKeyDown}
        >
          {heading ? (
            <div id={headingId} className="iq-menu-heading" aria-hidden="true">
              {heading}
            </div>
          ) : null}
          {rows}
        </div>
      ) : null}
    </span>
  );
}
