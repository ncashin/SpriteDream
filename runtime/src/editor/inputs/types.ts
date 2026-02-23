import type React from "react";

export type InputDisplayProps = {
  value: unknown;
  onChange?: (val: unknown) => void;
  displayValue: unknown;
};

export type InputDisplayComponent = (props: InputDisplayProps) => React.ReactNode;
