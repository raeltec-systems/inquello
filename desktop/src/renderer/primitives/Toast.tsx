/**
 * `Toast`: brief, noncritical result feedback (DESIGN.md `components.Toast`).
 *
 * - `role="status"`: announced politely; it never moves focus.
 * - Only a `transient` toast dismisses itself, after `TOAST_DISMISS_MS`
 *   (the source's 2.6s). Hovering or focusing it holds it; leaving it starts a
 *   fresh 2.6s. A transient toast is a tab stop so keyboard users can hold
 *   it too. A toast without `transient` stays until the caller removes it.
 * - There is no error, warning or required-action kind: those stay in
 *   persistent UI. Passing `kind` is a type error; at runtime it renders
 *   nothing and warns.
 * - A toast is never proof that a file was saved or an external action
 *   happened; that evidence lives in persistent context.
 * - No positioning or queue: the caller places the single toast.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

/** The source container's dismissal delay. */
export const TOAST_DISMISS_MS = 2600;

export interface ToastProps {
  children: ReactNode;
  /** Replaceable feedback that dismisses itself after 2.6s. */
  transient?: boolean;
  /** Called once when a transient toast dismisses itself. */
  onDismiss?: () => void;
  /** Toasts carry no kind: errors and required actions stay in persistent UI. */
  kind?: never;
  className?: string;
}

export function Toast(props: ToastProps): ReactElement | null {
  const { children, transient = false, onDismiss, className } = props;
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const rejected = (props as { kind?: unknown }).kind !== undefined;

  useEffect(() => {
    if (rejected || !transient || dismissed || hovered || focused) return undefined;
    const timer = setTimeout(() => {
      setDismissed(true);
      dismiss.current?.();
    }, TOAST_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [rejected, transient, dismissed, hovered, focused]);

  if (rejected) {
    console.warn(`Toast: no ${JSON.stringify((props as { kind?: unknown }).kind)} kind; errors and required actions stay in persistent UI. Nothing rendered.`);
    return null;
  }
  if (dismissed) return null;
  return (
    <div
      role="status"
      className={['iq-toast', className].filter(Boolean).join(' ')}
      tabIndex={transient ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {children}
    </div>
  );
}
