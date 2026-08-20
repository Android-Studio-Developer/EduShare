import { RANK_COLOR, RANK_LABEL } from "../lib/ranks";
import type { Rank } from "../types";

export default function RankBadge({ rank, className = "" }: { rank?: Rank; className?: string }) {
  if (!rank || rank === "none") return null;
  return (
    <span className={`shrink-0 rounded-md border border-current/30 px-1.5 py-0.5 font-mono text-[10px] font-bold ${RANK_COLOR[rank]} ${className}`}>
      {RANK_LABEL[rank]}
    </span>
  );
}
