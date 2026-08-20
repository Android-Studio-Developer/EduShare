import agent from "../assets/icons/agent.svg";
import alex from "../assets/icons/alex.svg";
import apple from "../assets/icons/apple.svg";
import balloon from "../assets/icons/balloon.svg";
import cake from "../assets/icons/cake.svg";
import carrot from "../assets/icons/carrot.svg";
import cookie from "../assets/icons/cookie.svg";
import fish from "../assets/icons/fish.svg";
import llama from "../assets/icons/llamma.svg";
import map from "../assets/icons/map.svg";
import panda from "../assets/icons/panda.svg";
import pickaxe from "../assets/icons/pickaxe.svg";
import potion from "../assets/icons/potion.svg";
import rail from "../assets/icons/rail.svg";
import sign from "../assets/icons/sign.svg";
import steve from "../assets/icons/steve.svg";
import water from "../assets/icons/water.svg";

export interface CodeIcon {
  id: string;
  label: string;
  src: string;
}

export const ICON_PALETTE: CodeIcon[] = [
  { id: "steve", label: "Steve", src: steve },
  { id: "alex", label: "Alex", src: alex },
  { id: "agent", label: "Agent", src: agent },
  { id: "apple", label: "Apple", src: apple },
  { id: "cookie", label: "Cookie", src: cookie },
  { id: "cake", label: "Cake", src: cake },
  { id: "carrot", label: "Carrot", src: carrot },
  { id: "fish", label: "Fish", src: fish },
  { id: "balloon", label: "Balloon", src: balloon },
  { id: "pickaxe", label: "Pickaxe", src: pickaxe },
  { id: "potion", label: "Potion", src: potion },
  { id: "rail", label: "Rail", src: rail },
  { id: "sign", label: "Sign", src: sign },
  { id: "water", label: "Water Bucket", src: water },
  { id: "llama", label: "Llama", src: llama },
  { id: "panda", label: "Panda", src: panda },
  { id: "map", label: "Map", src: map },
];

const ICON_MAP = new Map(ICON_PALETTE.map((icon) => [icon.id, icon]));

export function getIcon(id: string): CodeIcon {
  return ICON_MAP.get(id) ?? ICON_PALETTE[0];
}

export const CODE_LENGTH = 4;
