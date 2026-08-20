import { CODE_LENGTH, ICON_PALETTE } from "./icons";

export function randomIconCode(): string[] {
  return Array.from(
    { length: CODE_LENGTH },
    () => ICON_PALETTE[Math.floor(Math.random() * ICON_PALETTE.length)].id,
  );
}
