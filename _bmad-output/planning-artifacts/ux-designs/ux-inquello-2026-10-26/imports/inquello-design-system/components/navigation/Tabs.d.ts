export interface TabsProps {
  tabs: { value: string; label: React.ReactNode; count?: number | string }[];
  value: string;
  onChange?: (value: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
