export interface SegmentedControlProps {
  options: { value: string; label: React.ReactNode }[];
  value: string;
  onChange?: (value: string) => void;
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
