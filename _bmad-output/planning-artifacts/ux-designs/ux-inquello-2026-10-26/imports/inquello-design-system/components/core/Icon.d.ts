export interface IconProps {
  /** Lucide icon name from assets/icons, e.g. "file-spreadsheet" */
  name: string;
  /** Pixel size. 16 in UI, 14 in dense rows. */
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Accessible label; omit for decorative icons */
  title?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
