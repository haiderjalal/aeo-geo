import Link from "next/link";
import { BRAND } from "@/lib/brand";

interface SiteHeaderProps {
  /** Marks the matching nav item as the current page. */
  current?: "home" | "leaderboard";
}

export default function SiteHeader({ current = "home" }: SiteHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6">
      <Link href="/" className="flex items-center gap-2.5" aria-current={current === "home" ? "page" : undefined}>
        <span className="block size-3.5 rounded-[3px] bg-mark" aria-hidden="true" />
        <span className="font-mono text-sm tracking-tight text-ink">{BRAND.name}</span>
      </Link>

      <div className="flex items-center gap-5">
        <span className="hidden font-mono text-[11px] text-ink-faint md:inline">
          33 checks · first scan free · then $10
        </span>
        <nav aria-label="Primary">
          <Link
            href="/leaderboard"
            aria-current={current === "leaderboard" ? "page" : undefined}
            className={`font-mono text-sm text-ink underline-offset-4 hover:underline ${
              current === "leaderboard" ? "underline decoration-mark decoration-2" : ""
            }`}
          >
            Leaderboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
