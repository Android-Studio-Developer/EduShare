import type { ReactNode } from "react";

export interface DockItemDefinition {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
}

export interface DockProps {
  items: DockItemDefinition[];
  className?: string;
  spring?: { mass: number; stiffness: number; damping: number };
  magnification?: number;
  distance?: number;
  panelHeight?: number;
  dockHeight?: number;
  baseItemSize?: number;
}

export default function Dock(props: DockProps): ReactNode;
