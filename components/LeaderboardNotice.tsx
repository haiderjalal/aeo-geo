import type { CSSProperties } from "react";
import Link from "next/link";
import type { LeaderboardPlacement } from "@/lib/types";

/** Tells the visitor where their scan landed on the public board. */
export default function LeaderboardNotice({ placement }: { placement: LeaderboardPlacement }) {
  return (
    <aside
      aria-label="Leaderboard placement"
      className="fade mt-8 rounded-lg border-l-4 border-mark bg-paper-raised px-5 py-4"
      style={{ "--delay": "0.5s" } as CSSProperties}
    >
      <p className="text-[15px] text-ink">
        <span className="font-medium">
          Ranked #{placement.rank.toLocaleString("en-US")} of {placement.total.toLocaleString("en-US")}
        </span>{" "}
        on the leaderboard
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        {placement.improved ? (
          <>
            Listed as <span className="font-mono text-ink">{placement.host}</span> with a score of {placement.score}.
          </>
        ) : (
          <>
            <span className="font-mono text-ink">{placement.host}</span> already holds a higher score of{" "}
            {placement.score}, so the board keeps that one.
          </>
        )}{" "}
        <Link href="/leaderboard" className="text-ink underline underline-offset-4">
          View the leaderboard
        </Link>
      </p>
    </aside>
  );
}
