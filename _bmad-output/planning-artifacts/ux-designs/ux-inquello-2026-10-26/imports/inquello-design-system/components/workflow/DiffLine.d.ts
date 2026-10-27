export interface DiffLineProps {
  kind?: 'add' | 'del' | 'change' | 'context';
  /** Row number, cell reference or paragraph number */
  gutter?: React.ReactNode;
  children?: React.ReactNode;
}
export declare function DiffLine(props: DiffLineProps): JSX.Element;
