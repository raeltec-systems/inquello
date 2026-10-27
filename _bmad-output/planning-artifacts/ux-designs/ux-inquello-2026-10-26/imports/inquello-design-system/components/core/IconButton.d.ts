export interface IconButtonProps {
  icon?: string;
  /** Required accessible label, also shown as tooltip */
  label: string;
  /** ghost (default), outline, send (round dark arrow), stop (round dark square) */
  variant?: 'ghost' | 'outline' | 'send' | 'stop';
  size?: number;
  active?: boolean;
  onClick?: () => void;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
