import { assertPublicUrl, fetchDoc, GPTBOT_UA } from "./fetch";
import { runChecks, type PageInput } from "./checks";
import { CATEGORY_META, type AnalysisResult, type Category, type Check, type CategoryScore } from "./types";

const STATUS_VALUE = { pass: 1, warn: 0.5, fail: 0, na: 0 } as const;

/** If AI crawlers cannot reach the page, no amount of good content matters. */
const BLOCKING_REASONS: Record<string, string> = {
  "http-ok": "the page does not return HTTP 200",
  "robots-ai": "robots.txt blocks AI search crawlers",
  "waf-block": "your firewall or CDN is blocking AI crawler requests",
};
const BLOCKED_CEILING = 40;

function scoreCategory(checks: Check[], category: Category): CategoryScore {
  const scored = checks.filter((c) => c.category === category && c.status !== "na");
  const total = scored.reduce((n, c) => n + c.weight, 0);
  const earned = scored.reduce((n, c) => n + c.weight * STATUS_VALUE[c.status], 0);
  return {
    category,
    label: CATEGORY_META[category].label,
    score: total === 0 ? 0 : Math.round((earned / total) * 100),
    weight: CATEGORY_META[category].weight,
  };
}

function toGrade(score: number): AnalysisResult["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export async function analyze(rawUrl: string): Promise<AnalysisResult> {
  const url = await assertPublicUrl(rawUrl);
  const root = `${url.protocol}//${url.host}`;

  // Independent requests, so fire them together rather than in a waterfall.
  const [page, bot, robots, llms, llmsFull, sitemap, markdown] = await Promise.all([
    fetchDoc(url.href),
    fetchDoc(url.href, { ua: GPTBOT_UA }),
    fetchDoc(`${root}/robots.txt`),
    fetchDoc(`${root}/llms.txt`),
    fetchDoc(`${root}/llms-full.txt`),
    fetchDoc(`${root}/sitemap.xml`),
    fetchDoc(url.href, { accept: "text/markdown" }),
  ]);

  if (page.status === 0) {
    throw new Error(
      page.error === "timeout"
        ? "That site took too long to respond."
        : "Could not reach that URL. Check the address and try again.",
    );
  }

  const input: PageInput = { url, page, bot, robots, llms, llmsFull, sitemap, markdown };
  const checks = runChecks(input);
  const categories = (Object.keys(CATEGORY_META) as Category[]).map((c) => scoreCategory(checks, c));

  const weighted = categories.reduce((n, c) => n + (c.score * c.weight) / 100, 0);
  let score = Math.round(weighted);

  const blockers = checks
    .filter((c) => c.status === "fail" && c.id in BLOCKING_REASONS)
    .map((c) => BLOCKING_REASONS[c.id]);
  const cappedReason =
    blockers.length > 0 && score > BLOCKED_CEILING
      ? `Score capped at ${BLOCKED_CEILING} because ${blockers.join(", and ")}. AI engines cannot cite a page they cannot fetch, so every other improvement on this page is blocked behind that.`
      : undefined;
  if (cappedReason) score = BLOCKED_CEILING;

  return {
    url: rawUrl,
    finalUrl: page.finalUrl,
    fetchedAt: new Date().toISOString(),
    score,
    grade: toGrade(score),
    cappedReason,
    categories,
    checks,
  };
}
