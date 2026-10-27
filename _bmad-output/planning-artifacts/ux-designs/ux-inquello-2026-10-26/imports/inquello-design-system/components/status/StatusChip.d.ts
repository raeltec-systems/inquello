export interface StatusChipProps {
  /** Where the item is: suggested (agent proposal), investigating, open, evidence (needs evidence), waiting (on someone), accepted, explained */
  status?: 'suggested' | 'investigating' | 'open' | 'evidence' | 'waiting' | 'accepted' | 'explained';
  /** Initials of the person who made the call; renders the green decision marker */
  decidedBy?: string;
  children?: React.ReactNode;
}
/** @startingPoint section="Review" subtitle="Item statuses with the decision marker" viewport="700x200" */
export declare function StatusChip(props: StatusChipProps): JSX.Element;
