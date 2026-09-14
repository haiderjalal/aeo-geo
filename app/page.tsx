"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import ScoreReport from "@/components/ScoreReport";
import CrawlerView from "@/components/CrawlerView";
import { BRAND } from "@/lib/brand";
import type { AnalysisResult } from "@/lib/types";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (payload.success) setResult(payload.data as AnalysisResult);
      else setError(payload.message ?? "Something went wrong.");
    } catch {
      setError("Could not reach the scanner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const idle = !result && !loading && !error;

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="block size-3.5 rounded-[3px] bg-mark" aria-hidden="true" />
          <span className="font-mono text-sm tracking-tight text-ink">{BRAND.name}</span>
        </div>
        <span className="font-mono text-[11px] text-ink-faint">33 checks · free · no account</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
        {/* ---------- Hero ---------- */}
        <div className="pt-10 sm:pt-20">
          <h1 className="display text-[clamp(2.75rem,9vw,7rem)]">
            <span className="rise block" style={{ "--delay": "0.05s" } as CSSProperties}>
              Every site has
            </span>
            <span className="rise block" style={{ "--delay": "0.15s" } as CSSProperties}>
              two versions.
            </span>
          </h1>

          <p
            className="rise mt-7 max-w-2xl text-lg leading-relaxed text-ink-soft"
            style={{ "--delay": "0.3s" } as CSSProperties}
          >
            The one people see, and the one{" "}
            <span className="mark text-ink" style={{ "--mark-delay": "0.7s" } as CSSProperties}>
              AI search retrieves
            </span>
            . Paste a URL to find out which parts of your page survive the second one.
          </p>

          {/* ---------- Scan form ---------- */}
          <form
            onSubmit={handleSubmit}
            className="rise mt-10 flex flex-col gap-3 sm:flex-row"
            style={{ "--delay": "0.4s" } as CSSProperties}
          >
            <label htmlFor="url" className="sr-only">
              Page URL to scan
            </label>
            <input
              id="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              disabled={loading}
              className="flex-1 rounded-lg border border-rule-strong bg-paper-raised px-5 py-4 font-mono text-[15px] text-ink transition-colors placeholder:text-ink-faint focus:border-ink focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-lg bg-ink px-8 py-4 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0"
            >
              {loading ? "Scanning…" : "Scan page"}
            </button>
          </form>

          <p aria-live="polite" className="sr-only">
            {loading ? "Scanning page, please wait." : result ? "Scan complete." : ""}
          </p>

          {error && (
            <p
              role="alert"
              className="fade mt-6 rounded-lg border-l-4 border-flag bg-flag-soft px-5 py-4 text-sm text-ink"
            >
              {error}
            </p>
          )}
        </div>

        {/* ---------- Loading skeleton ---------- */}
        {loading && (
          <div className="mt-16 space-y-6" aria-hidden="true">
            <div className="shimmer h-28 w-56 rounded-lg" />
            <div className="flex h-16 items-end gap-[3px]">
              {Array.from({ length: 33 }).map((_, i) => (
                <div
                  key={i}
                  className="shimmer flex-1 rounded-sm"
                  style={{ height: `${30 + ((i * 37) % 60)}%` }}
                />
              ))}
            </div>
            <div className="shimmer h-2 w-full rounded-full" />
            <div className="shimmer h-2 w-4/5 rounded-full" />
          </div>
        )}

        {result && <ScoreReport result={result} />}

        {/* ---------- Idle: the thesis, shown ---------- */}
        {idle && (
          <div className="rise mt-16 sm:mt-24" style={{ "--delay": "0.55s" } as CSSProperties}>
            <CrawlerView />
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-rule px-6 py-8">
        <p className="font-mono text-[11px] text-ink-faint">
          {BRAND.name} · static analysis · nothing is stored
        </p>
      </footer>
    </>
  );
}
