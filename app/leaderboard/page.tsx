import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { getLeaderboardPage } from "@/lib/leaderboard";
import { PAYMENTS } from "@/lib/payments";
import type { Grade } from "@/lib/types";

// Reads SQLite on every request; the board changes whenever someone scans.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string | string[] }>;

const DESCRIPTION =
  "Sites ranked by their best AI readiness score: how well AI search engines can reach, read and cite the page.";

const GRADE_CHIP: Record<Grade, string> = {
  A: "bg-mark text-ink",
  B: "bg-ink text-paper",
  C: "bg-ink text-paper",
  D: "border border-rule-strong text-ink",
  F: "bg-flag text-paper",
};

/** Matches the report's category meters: ink while healthy, flag when holding the page back. */
const HEALTHY_SCORE = 55;

function parsePage(raw: string | string[] | undefined): number {
  return Number(Array.isArray(raw) ? raw[0] : raw);
}

function pageHref(page: number): string {
  return page > 1 ? `/leaderboard?page=${page}` : "/leaderboard";
}

/** Lets a long hostname wrap after a dot rather than mid-word, without changing the copied text. */
function Hostname({ host }: { host: string }) {
  const labels = host.split(".");
  return (
    <>
      {labels.map((label, index) => (
        <span key={index}>
          {label}
          {index < labels.length - 1 && (
            <>
              .<wbr />
            </>
          )}
        </span>
      ))}
    </>
  );
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const page = Math.max(1, Math.trunc(parsePage((await searchParams).page)) || 1);
  const title = `Leaderboard${page > 1 ? `, page ${page}` : ""} — ${BRAND.name}`;
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: pageHref(page) },
    openGraph: { title, description: DESCRIPTION, url: pageHref(page), type: "website" },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION },
  };
}

export default async function LeaderboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { page: rawPage } = await searchParams;
  const requestedPage = parsePage(rawPage);
  const board = getLeaderboardPage(requestedPage);
  // Send ?page=999, ?page=abc and the like to the page they resolve to, so one
  // page of content never lives at several URLs.
  if (rawPage !== undefined && board.page !== requestedPage) redirect(pageHref(board.page));
  const first = board.entries[0]?.rank ?? 0;
  const last = board.entries.at(-1)?.rank ?? 0;

  return (
    <>
      <SiteHeader current="leaderboard" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
        <div className="pt-10 sm:pt-16">
          <p className="eyebrow">Leaderboard</p>
          <h1 className="display mt-4 text-[clamp(2.5rem,8vw,5.5rem)]">
            <span className="mark text-ink" style={{ "--mark-delay": "0.3s" } as CSSProperties}>
              Most citable
            </span>{" "}
            sites.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Every site scanned with {BRAND.name} is ranked by its best AI readiness score. Only the hostname, score and
            grade are shown. Reports are never published.
          </p>
        </div>

        {board.total === 0 ? (
          <section aria-label="Leaderboard" className="mt-14 rounded-lg border border-rule-strong bg-paper-raised px-6 py-12">
            <h2 className="display text-3xl">Nobody is on the board yet.</h2>
            <p className="mt-3 max-w-xl text-ink-soft">
              Scan a page and its site takes the first spot. Your first scan is free.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-ink px-6 py-3 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5"
            >
              Scan your site
            </Link>
          </section>
        ) : (
          <section aria-label="Leaderboard" className="mt-12">
            <p className="font-mono text-xs text-ink-faint">
              {board.total.toLocaleString("en-US")} {board.total === 1 ? "site" : "sites"} ranked · showing {first}–{last}
            </p>

            <table className="mt-4 w-full text-left">
              <caption className="sr-only">Sites ranked by best AI readiness score, highest first</caption>
              <thead>
                <tr className="border-b border-rule-strong font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
                  <th scope="col" className="w-12 py-3 pr-2 font-normal sm:w-20 sm:pr-3">
                    Rank
                  </th>
                  <th scope="col" className="py-3 pr-2 font-normal sm:pr-3">
                    Site
                  </th>
                  <th scope="col" className="w-12 py-3 pr-2 text-right font-normal sm:w-64 sm:pr-3 sm:text-left">
                    Score
                  </th>
                  <th scope="col" className="w-10 py-3 text-right font-normal sm:w-14">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((entry) => (
                  <tr key={entry.host} className="border-b border-rule">
                    <td className="py-3.5 pr-2 align-middle sm:py-4 sm:pr-3">
                      <span
                        className={`inline-block min-w-7 rounded px-1 py-0.5 text-center font-mono text-[13px] tabular-nums sm:min-w-8 sm:px-1.5 sm:text-sm ${
                          entry.rank <= 3 ? "bg-mark text-ink" : "text-ink-soft"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="py-3.5 pr-2 align-middle font-mono text-[13px] break-words text-ink sm:py-4 sm:pr-3 sm:text-[15px]">
                      <Hostname host={entry.host} />
                    </td>
                    <td className="py-3.5 pr-2 align-middle sm:py-4 sm:pr-3">
                      <div className="flex items-center justify-end gap-3 sm:justify-start">
                        <span className="w-8 text-right font-mono text-[13px] text-ink tabular-nums sm:text-sm">{entry.score}</span>
                        <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-rule sm:block" aria-hidden="true">
                          <div
                            className={`h-full rounded-full ${entry.score >= HEALTHY_SCORE ? "bg-ink" : "bg-flag"}`}
                            style={{ width: `${entry.score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 text-right align-middle sm:py-4">
                      <span
                        className={`inline-grid size-7 place-items-center rounded font-mono text-[13px] sm:size-8 sm:text-sm ${GRADE_CHIP[entry.grade]}`}
                      >
                        {entry.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {board.pages > 1 && (
              <nav aria-label="Leaderboard pages" className="mt-8 flex items-center justify-between font-mono text-sm">
                {board.page > 1 ? (
                  <Link href={pageHref(board.page - 1)} rel="prev" className="text-ink underline underline-offset-4">
                    ← Previous
                  </Link>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="text-ink-faint">
                  Page {board.page} of {board.pages}
                </span>
                {board.page < board.pages ? (
                  <Link href={pageHref(board.page + 1)} rel="next" className="text-ink underline underline-offset-4">
                    Next →
                  </Link>
                ) : (
                  <span aria-hidden="true" />
                )}
              </nav>
            )}
          </section>
        )}

        <section aria-label="How the leaderboard works" className="mt-16 border-t border-rule pt-8">
          <h2 className="display text-2xl">Want to climb?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Fix what the report flags and scan again; a site keeps its best score. A site is listed once a scanned page
            returns HTTP 200, and <span className="font-mono text-ink">www.</span> and the bare domain count as one
            site. Ties go to whoever reached the score first.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg bg-ink px-6 py-3 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5"
          >
            Scan your site
          </Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-rule px-6 py-8">
        <p className="font-mono text-[11px] text-ink-faint">
          {BRAND.name} · AI readiness leaderboard · to have a site removed, email{" "}
          <a href={`mailto:${PAYMENTS.email}`} className="underline underline-offset-4">
            {PAYMENTS.email}
          </a>
        </p>
      </footer>
    </>
  );
}
