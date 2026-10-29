export type TimeFieldProps = {
  label: string;
  /** `HH:mm`, or empty when not set. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};
