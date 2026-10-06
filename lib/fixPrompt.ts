import { CATEGORY_META, type AnalysisResult, type Category, type Check } from "./types";

/**
 * Some fixes live outside the codebase (CDN dashboards, firewall rules) or need
 * facts only the site owner has. The prompt says so, so the agent asks instead
 * of inventing authors, statistics or sources.
 */
const OUTSIDE_CODE: Record<string, string> = {
  "waf-block":
    "This is usually a CDN/WAF setting (Cloudflare, Vercel Firewall, Akamai), not code. If you cannot find it in the repo, give me exact dashboard steps instead.",
  https: "HTTPS is configured at the host/CDN. Give me steps if it is not in the repo.",
};

const NEEDS_OWNER_INPUT = new Set(["stats", "citations", "author", "dates", "freshness"]);

function formatCheck(check: Check, n: number): string {
  const lines = [
    `${n}. [${check.status === "fail" ? "FAIL" : "IMPROVE"}] ${check.label}`,
    `   Observed: ${check.detail}`,
  ];
  if (check.fix) lines.push(`   Fix: ${check.fix}`);
  if (OUTSIDE_CODE[check.id]) lines.push(`   Note: ${OUTSIDE_CODE[check.id]}`);
  if (NEEDS_OWNER_INPUT.has(check.id)) {
    lines.push(
      "   Note: Needs real facts. Do not invent authors, numbers, dates or sources. Add the structure and ask me for the content.",
    );
  }
  return lines.join("\n");
}

/** Turns a scan into a self-contained prompt a coding agent can act on. */
export function buildFixPrompt(result: AnalysisResult): string {
  const issues = result.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const passing = result.checks.filter((c) => c.status === "pass");

  if (issues.length === 0) {
    return `My page ${result.finalUrl} passed all ${result.checks.length} AI-search readiness checks (score ${result.score}/100). Review the codebase and confirm nothing in recent changes would break crawler access, server-rendered content or structured data.`;
  }

  const sections: string[] = [];
  let n = 1;
  for (const category of Object.keys(CATEGORY_META) as Category[]) {
    const inCategory = issues
      .filter((c) => c.category === category)
      // fails first: they cost the most score
      .sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === "fail" ? -1 : 1));
    if (inCategory.length === 0) continue;
    const body = inCategory.map((c) => formatCheck(c, n++)).join("\n\n");
    sections.push(`## ${CATEGORY_META[category].label}\n\n${body}`);
  }

  return `I need you to fix my website so AI search engines (ChatGPT, Perplexity, Claude, Copilot, Google AI Overviews) can reach, read and cite it.

A scan of ${result.finalUrl} scored ${result.score}/100 (grade ${result.grade}) on AI-search readiness, with ${issues.length} of ${result.checks.length} checks needing work.${
    result.cappedReason ? `\n\nCRITICAL: ${result.cappedReason} Fix this first.` : ""
  }

# How to work

1. First inspect the codebase: identify the framework, how pages are rendered, and where robots.txt, the sitemap, metadata and structured data are generated.
2. Fix the issues below in the order given. Failures before improvements.
3. Make changes that fit the existing code style. Do not rewrite unrelated code.
4. Do not invent content. Where a fix needs real information (authors, statistics, dates, sources), add the structure and ask me for the facts.
5. Do not break what already passes (listed at the end).
6. When done, give me: a summary of every change, anything you could not do in code (with exact steps for me), and how to verify each fix.

# Issues to fix

${sections.join("\n\n")}

# Already passing — do not regress

${passing.map((c) => `- ${c.label}`).join("\n")}`;
}
