"use client";

import { useMemo, useState } from "react";
import { buildFixPrompt } from "@/lib/fixPrompt";
import type { AnalysisResult } from "@/lib/types";

/** Clipboard API needs a secure context; fall back to a hidden textarea elsewhere. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export default function FixPrompt({ result }: { result: AnalysisResult }) {
  const prompt = useMemo(() => buildFixPrompt(result), [result]);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const issues = result.checks.filter((c) => c.status === "fail" || c.status === "warn").length;

  async function handleCopy(): Promise<void> {
    setState((await copyText(prompt)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <section
      aria-labelledby="fix-prompt"
      className="mt-16 rounded-lg border border-ink bg-paper-raised p-6 sm:p-8"
    >
      <p className="eyebrow">Fix it with Claude</p>
      <h3 id="fix-prompt" className="display mt-3 text-4xl">
        Hand the fixes to <span className="mark">your AI</span>.
      </h3>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
        One prompt with all {issues} issues, ordered by impact, with what was observed and how to fix
        each. Paste it into Claude Code (or Claude with your codebase) and it will make the changes.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-ink px-6 py-3.5 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5"
        >
          {state === "copied" ? "Copied ✓" : "Copy fix prompt"}
        </button>
        <span className="font-mono text-xs text-ink-faint">
          {prompt.length.toLocaleString()} characters
        </span>
        <span aria-live="polite" className="text-sm text-ink">
          {state === "failed" && "Couldn't copy — select the text below instead."}
        </span>
      </div>

      <details className="group mt-6">
        <summary className="cursor-pointer font-mono text-xs text-ink-soft select-none hover:text-ink">
          Preview prompt
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-rule bg-paper p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {prompt}
        </pre>
      </details>
    </section>
  );
}
