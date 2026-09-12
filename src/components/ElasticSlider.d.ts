import type { ReactElement, ReactNode } from "react";

export interface ElasticSliderProps {
  value?: number;
  defaultValue?: number;
  startingValue?: number;
  maxValue?: number;
  className?: string;
  isStepped?: boolean;
  stepSize?: number;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  showValue?: boolean;
  valueFormatter?: (value: number) => ReactNode;
  ariaLabel?: string;
  onChange?: (value: number) => void;
}

export default function ElasticSlider(props: ElasticSliderProps): ReactElement;
