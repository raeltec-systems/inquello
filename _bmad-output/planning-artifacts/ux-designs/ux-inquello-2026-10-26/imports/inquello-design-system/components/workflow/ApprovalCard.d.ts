export interface ApprovalCardProps {
  /** Which specialist or item is asking, e.g. "Subsequent clearance · R4" */
  context?: React.ReactNode;
  /** The question, in plain language */
  children: React.ReactNode;
  /** Exact message that would be sent, shown before approval */
  quote?: React.ReactNode;
  approveLabel?: string;
  altLabel?: string;
  dismissLabel?: string;
  onApprove?: () => void;
  onAlt?: () => void;
  onDismiss?: () => void;
  note?: React.ReactNode;
}
/** @startingPoint section="Review" subtitle="Agent asks before contacting a client" viewport="700x220" */
export declare function ApprovalCard(props: ApprovalCardProps): JSX.Element;
