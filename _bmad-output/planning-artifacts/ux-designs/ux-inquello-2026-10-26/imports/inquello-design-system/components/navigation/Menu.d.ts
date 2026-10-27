export interface MenuItem { label: React.ReactNode; description?: React.ReactNode; checked?: boolean; onSelect?: () => void; }
export interface MenuProps {
  heading?: React.ReactNode;
  items: MenuItem[];
  width?: number;
}
export declare function Menu(props: MenuProps): JSX.Element;
