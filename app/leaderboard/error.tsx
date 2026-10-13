"use client";

import { useEffect } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function LeaderboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("leaderboard render failed", { error });
  }, [error]);

  return (
    <>
      <SiteHeader current="leaderboard" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
        <p role="alert" className="mt-10 rounded-lg border-l-4 border-flag bg-flag-soft px-5 py-4 text-sm text-ink">
          The leaderboard could not be loaded right now. Please try again in a moment.
        </p>
        <div className="mt-6 flex items-center gap-5">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-ink px-6 py-3 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5"
          >
            Try again
          </button>
          <Link href="/" className="text-sm text-ink underline underline-offset-4">
            Back to the scanner
          </Link>
        </div>
      </main>
    </>
  );
}
