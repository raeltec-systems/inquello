export interface AvatarProps {
  /** person = initials disc; agent = the Inquello symbol */
  kind?: 'person' | 'agent';
  initials?: string;
  /** decided = solid green, used as the "decided by a person" marker */
  tone?: 'blue' | 'green' | 'amber' | 'decided';
  size?: number;
  label?: string;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
