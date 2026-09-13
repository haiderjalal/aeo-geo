import type { AnalysisResult, Check, CheckStatus } from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";

const STATUS_STYLE: Record<CheckStatus, { dot: string; text: string; label: string }> = {
  pass: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Pass" },
  warn: { dot: "bg-amber-400", text: "text-amber-300", label: "Improve" },
  fail: { dot: "bg-rose-500", text: "text-rose-300", label: "Fail" },
  na: { dot: "bg-zinc-600", text: "text-zinc-500", label: "N/A" },
};

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-lime-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-rose-400";
}

function barColor(score: number): string {
  if (score >= 85) return "bg-emerald-400";
  if (score >= 70) return "bg-lime-400";
  if (score >= 55) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-rose-400";
}

const PRIORITY: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2, na: 3 };

function CheckRow({ check }: { check: Check }) {
  const style = STATUS_STYLE[check.status];
  return (
    <li className="flex gap-3 border-t border-zinc-800/70 py-3 first:border-t-0">
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-zinc-100">{check.label}</span>
          <span className={`text-[11px] uppercase tracking-wider ${style.text}`}>{style.label}</span>
        </div>
        <p className="mt-0.5 text-sm break-words text-zinc-400">{check.detail}</p>
        {check.fix && (
          <p className="mt-1.5 border-l-2 border-zinc-700 pl-3 text-sm text-zinc-300">{check.fix}</p>
        )}
      </div>
    </li>
  );
}

export default function ScoreReport({ result }: { result: AnalysisResult }) {
  const failures = result.checks.filter((c) => c.status === "fail" || c.status === "warn").length;

  return (
    <section className="mt-12 space-y-10" aria-label="Analysis results">
      {/* Headline score */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-zinc-800 pb-8">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.2em] text-zinc-500 uppercase">AI readiness score</p>
          <p className="mt-2 truncate font-mono text-sm text-zinc-400" title={result.finalUrl}>
            {result.finalUrl}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {failures === 0
              ? "No issues found."
              : `${failures} of ${result.checks.length} checks need attention.`}
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-7xl leading-none font-semibold ${scoreColor(result.score)}`}>
            {result.score}
          </span>
          <span className="text-2xl text-zinc-600">/100</span>
          <span className={`ml-2 text-3xl font-semibold ${scoreColor(result.score)}`}>
            {result.grade}
          </span>
        </div>
      </div>

      {result.cappedReason && (
        <p className="rounded-md border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {result.cappedReason}
        </p>
      )}

      {/* Category breakdown */}
      <div className="space-y-4">
        {result.categories.map((cat) => (
          <div key={cat.category}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-200">{cat.label}</span>
              <span className="font-mono text-zinc-400">
                {cat.score}
                <span className="text-zinc-600"> · {cat.weight}% weight</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${barColor(cat.score)}`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Full findings, failures first */}
      {result.categories.map((cat) => {
        const checks = result.checks
          .filter((c) => c.category === cat.category)
          .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status]);
        return (
          <div key={cat.category}>
            <h2 className="text-xs tracking-[0.2em] text-zinc-500 uppercase">
              {CATEGORY_META[cat.category].label}
            </h2>
            <ul className="mt-3">
              {checks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </ul>
          </div>
        );
      })}

      <p className="border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-500">
        This scores <strong className="text-zinc-400">AI readiness</strong> — the signals you control
        on your own page. It does not measure whether you are actually cited in ChatGPT, Perplexity or
        AI Overviews, which depends on domain authority and third-party consensus that cannot be read
        from a URL. Scanned {new Date(result.fetchedAt).toLocaleString()}.
      </p>
    </section>
  );
}
