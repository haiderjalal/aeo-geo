"use client";

import { useState, type FormEvent } from "react";
import ScoreReport from "@/components/ScoreReport";
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
      setError("Could not reach the analyzer. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-24">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          AEO / GEO Analyzer
        </h1>
        <p className="mt-3 max-w-xl leading-relaxed text-zinc-400">
          Paste a URL to see how ready that page is to be found, parsed and cited by AI search
          engines — ChatGPT, Perplexity, Claude, Copilot and Google AI Overviews.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="url" className="sr-only">
          Page URL to analyze
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
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-md bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Scanning…" : "Analyze"}
        </button>
      </form>

      <p aria-live="polite" className="sr-only">
        {loading ? "Scanning page, please wait." : result ? "Analysis complete." : ""}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-12 space-y-4" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-md bg-zinc-900" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-900" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
          <div className="h-40 animate-pulse rounded-md bg-zinc-900" />
        </div>
      )}

      {result && <ScoreReport result={result} />}

      {!result && !loading && !error && (
        <section className="mt-16 border-t border-zinc-800 pt-8">
          <h2 className="text-xs tracking-[0.2em] text-zinc-500 uppercase">What gets checked</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {[
              ["Crawler & bot access", "Whether AI crawlers are blocked in robots.txt — or silently blocked by your firewall."],
              ["Content extractability", "Whether the page survives chunking: raw-HTML content, headings, answer blocks, tables."],
              ["Authority signals", "Statistics, outbound citations, author attribution, freshness, keyword stuffing."],
              ["Structured data", "JSON-LD presence, validity, and whether the right entity and page types are declared."],
              ["Machine readability", "llms.txt, semantic HTML, alt text, canonical, markdown for agents."],
            ].map(([term, desc]) => (
              <div key={term}>
                <dt className="text-sm font-medium text-zinc-200">{term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-zinc-500">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
