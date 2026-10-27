export interface TextFieldProps {
  multiline?: boolean;
  rows?: number;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Caption above the field, e.g. "Reason, saved with the decision" */
  label?: string;
  style?: React.CSSProperties;
}
export declare function TextField(props: TextFieldProps): JSX.Element;
