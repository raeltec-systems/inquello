export interface ChoiceProps {
  type?: 'radio' | 'checkbox';
  checked?: boolean;
  label: React.ReactNode;
  /** With a description the choice renders as a bordered option card */
  description?: React.ReactNode;
  onChange?: (checked: boolean) => void;
}
export declare function Choice(props: ChoiceProps): JSX.Element;
