export interface FileChipProps {
  type?: 'pdf' | 'xls' | 'doc' | 'folder';
  name?: React.ReactNode;
  onRemove?: () => void;
  /** chip (bordered, default) or tag (just the coloured type label) */
  variant?: 'chip' | 'tag';
}
export declare function FileChip(props: FileChipProps): JSX.Element;
