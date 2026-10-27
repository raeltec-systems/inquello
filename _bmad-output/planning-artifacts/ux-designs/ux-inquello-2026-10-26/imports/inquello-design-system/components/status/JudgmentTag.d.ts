export interface JudgmentTagProps {
  /** What kind of claim a figure or statement is */
  kind?: 'calculation' | 'observation' | 'suggestion' | 'decision' | 'gap';
  children?: React.ReactNode;
  /** Mono uppercase label (default) or sentence-case legend style */
  uppercase?: boolean;
}
export declare function JudgmentTag(props: JudgmentTagProps): JSX.Element;
