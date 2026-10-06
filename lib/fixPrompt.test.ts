import { describe, it, expect } from "vitest";
import { buildFixPrompt } from "./fixPrompt";
import type { AnalysisResult, Check } from "./types";

const check = (over: Partial<Check>): Check => ({
  id: "x",
  category: "access",
  label: "Some check",
  status: "pass",
  weight: 1,
  detail: "observed",
  ...over,
});

const result = (checks: Check[], over: Partial<AnalysisResult> = {}): AnalysisResult => ({
  url: "https://example.com",
  finalUrl: "https://example.com/",
  fetchedAt: "2026-10-06T00:00:00Z",
  score: 40,
  grade: "D",
  categories: [],
  checks,
  ...over,
});

describe("buildFixPrompt", () => {
  const checks = [
    check({ id: "sitemap", label: "XML sitemap", status: "warn", weight: 2, fix: "Add sitemap" }),
    check({ id: "robots-ai", label: "AI crawlers allowed", status: "fail", weight: 6, fix: "Allow bots" }),
    check({ id: "stats", category: "authority", label: "Statistics", status: "fail", fix: "Add stats" }),
    check({ id: "https", label: "HTTPS", status: "pass" }),
  ];
  const prompt = buildFixPrompt(result(checks, { cappedReason: "Score capped at 40." }));

  it("includes the URL, score and cap reason", () => {
    expect(prompt).toContain("https://example.com/");
    expect(prompt).toContain("40/100");
    expect(prompt).toContain("CRITICAL: Score capped at 40.");
  });

  it("orders failures before improvements within a category", () => {
    expect(prompt.indexOf("AI crawlers allowed")).toBeLessThan(prompt.indexOf("XML sitemap"));
  });

  it("tells the agent not to invent facts for content checks", () => {
    const stats = prompt.slice(prompt.indexOf("Statistics"));
    expect(stats).toMatch(/Do not invent/);
  });

  it("lists passing checks as do-not-regress, not as issues", () => {
    const [issues, passing] = prompt.split("# Already passing");
    expect(issues).not.toContain("HTTPS");
    expect(passing).toContain("- HTTPS");
  });

  it("returns a short confirmation prompt when nothing fails", () => {
    const clean = buildFixPrompt(result([check({ status: "pass" })], { score: 100, grade: "A" }));
    expect(clean).toContain("passed all 1");
    expect(clean).not.toContain("# Issues to fix");
  });
});
