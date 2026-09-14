"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AnalysisResult, Check, CheckStatus } from "@/lib/types";

/** Status is expressed by weight and one flag colour, never by a rainbow. */
const TICK: Record<CheckStatus, { h: string; bg: string }> = {
  fail: { h: "100%", bg: "bg-flag" },
  warn: { h: "52%", bg: "bg-rule-strong" },
  pass: { h: "70%", bg: "bg-ink" },
  na: { h: "22%", bg: "bg-rule" },
};

/**
 * Three steps of loudness: outline is fine, solid ink wants attention, flag is
 * broken. The mark colour stays reserved for brand moments so it keeps meaning.
 */
const CHIP: Record<CheckStatus, { label: string; className: string }> = {
  fail: { label: "Fail", className: "bg-flag text-paper" },
  warn: { label: "Improve", className: "bg-ink text-paper" },
  pass: { label: "Pass", className: "border border-rule-strong text-ink-faint" },
  na: { label: "N/A", className: "border border-rule text-ink-faint" },
};

const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2, na: 3 };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Counts up to `target` once on mount. The number is the headline, so it earns motion. */
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    // Reduced motion runs the same path with zero duration, so the first frame
    // lands on the final value rather than setting state synchronously here.
    const ms = prefersReducedMotion() ? 0 : duration;
    const started = performance.now();

    const step = (now: number) => {
      const t = ms === 0 ? 1 : Math.min((now - started) / ms, 1);
      // easeOutExpo, so it lands rather than crawls
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

function Finding({ check, index }: { check: Check; index: number }) {
  const chip = CHIP[check.status];
  return (
    <li
      className="rise grid gap-x-5 gap-y-2 border-t border-rule py-5 sm:grid-cols-[8rem_minmax(0,44rem)]"
      style={{ "--delay": `${Math.min(index * 0.03, 0.5)}s` } as CSSProperties}
    >
      <div>
        <span
          className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase ${chip.className}`}
        >
          {chip.label}
        </span>
      </div>
      <div className="min-w-0">
        <h4 className="text-[15px] font-medium text-ink">{check.label}</h4>
        <p className="mt-1 font-mono text-[13px] leading-relaxed break-words text-ink-soft">
          {check.detail}
        </p>
        {check.fix && (
          <p className="mt-2.5 border-l-2 border-mark pl-3 text-sm leading-relaxed text-ink">
            {check.fix}
          </p>
        )}
      </div>
    </li>
  );
}

export default function ScoreReport({ result }: { result: AnalysisResult }) {
  const score = useCountUp(result.score);
  const attention = result.checks.filter((c) => c.status === "fail" || c.status === "warn").length;

  return (
    <section aria-label="Analysis results" className="mt-16">
      <p className="eyebrow">Scanned</p>
      <p
        className="mt-2 truncate font-mono text-sm text-ink-soft"
        title={result.finalUrl}
      >
        {result.finalUrl}
      </p>

      {/* ---------- Headline score ---------- */}
      <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="flex items-baseline gap-2">
          <span
            className="display text-[7rem] leading-[0.8] tabular-nums sm:text-[10rem]"
            aria-label={`Score ${result.score} out of 100`}
          >
            {score}
          </span>
          <span className="font-mono text-sm text-ink-faint">/100</span>
        </div>

        <div
          className={`rise grid size-16 place-items-center rounded-lg ${
            result.cappedReason ? "bg-flag text-paper" : "bg-mark text-ink"
          }`}
          style={{ "--delay": "0.6s" } as CSSProperties}
        >
          <span className="display text-4xl">{result.grade}</span>
        </div>

        <p
          className="fade mb-1 max-w-xs text-sm leading-relaxed text-ink-soft"
          style={{ "--delay": "0.75s" } as CSSProperties}
        >
          {attention === 0
            ? "Every check passed. This page is ready to be retrieved and cited."
            : `${attention} of ${result.checks.length} checks need attention.`}
        </p>
      </div>

      {/* ---------- Spectrum: one tick per check, the page's fingerprint ---------- */}
      <div className="mt-8">
        <div
          className="flex h-16 items-end gap-[3px]"
          role="img"
          aria-label={`${result.checks.length} checks: ${attention} need attention`}
        >
          {result.checks.map((c, i) => {
            const t = TICK[c.status];
            return (
              <div
                key={c.id}
                title={`${c.label} — ${CHIP[c.status].label}`}
                className={`tick flex-1 rounded-sm ${t.bg}`}
                style={{ height: t.h, "--delay": `${0.5 + i * 0.018}s` } as CSSProperties}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2 rounded-sm bg-flag" aria-hidden="true" /> fail
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2 rounded-sm bg-rule-strong" aria-hidden="true" /> improve
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2 rounded-sm bg-ink" aria-hidden="true" /> pass
          </span>
        </div>
      </div>

      {result.cappedReason && (
        <p
          className="fade mt-8 rounded-lg border-l-4 border-flag bg-flag-soft px-5 py-4 text-sm leading-relaxed text-ink"
          style={{ "--delay": "0.4s" } as CSSProperties}
        >
          {result.cappedReason}
        </p>
      )}

      {/* ---------- Category meters ---------- */}
      <div className="mt-14 space-y-6">
        {result.categories.map((cat, i) => (
          <div key={cat.category}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-mono text-[11px] tracking-[0.16em] text-ink uppercase">
                {cat.label}
              </h3>
              <span className="font-mono text-xs text-ink-faint">
                <span className="text-ink">{cat.score}</span> · {cat.weight}% of score
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-rule">
              <div
                // Length already carries the precision, so colour only has to
                // answer one question: is this category holding the page back?
                className={`meter-fill h-full rounded-full ${
                  cat.score >= 55 ? "bg-ink" : "bg-flag"
                }`}
                style={{ "--w": `${cat.score}%`, "--delay": `${0.7 + i * 0.1}s` } as CSSProperties}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Findings ---------- */}
      <div className="mt-16">
        {result.categories.map((cat) => {
          const checks = result.checks
            .filter((c) => c.category === cat.category)
            .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
          return (
            <div key={cat.category} className="mt-12 first:mt-0">
              <h3 className="display text-3xl">{cat.label}</h3>
              <ul className="mt-5">
                {checks.map((c, i) => (
                  <Finding key={c.id} check={c} index={i} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-16 border-t border-rule pt-6 text-sm leading-relaxed text-ink-soft">
        This scores <span className="text-ink">AI readiness</span> — the signals you control on your
        own page. It does not measure whether you are currently cited in ChatGPT, Perplexity or AI
        Overviews, which depends on domain authority and third-party consensus that no single URL
        fetch can see.
      </p>
    </section>
  );
}
