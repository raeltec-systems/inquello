export interface PlanStepProps {
  state?: 'done' | 'running' | 'pending';
  label: React.ReactNode;
  meta?: React.ReactNode;
}
export declare function PlanStep(props: PlanStepProps): JSX.Element;
