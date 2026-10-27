export interface ButtonProps {
  /** primary = the one dark action per view; secondary = outlined; quiet = grey fill (toggles like Changes); ghost = text only */
  variant?: 'primary' | 'secondary' | 'quiet' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** Leading Lucide icon name */
  icon?: string;
  /** Keyboard hint shown after the label, e.g. "⏎" */
  kbd?: string;
  disabled?: boolean;
  /** Let the label shrink with an ellipsis when space runs out (pass style={{ flex: '0 1 auto', minWidth: 0 }}) */
  truncate?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
/** @startingPoint section="Controls" subtitle="Primary, secondary, quiet and ghost buttons" viewport="700x220" */
export declare function Button(props: ButtonProps): JSX.Element;
