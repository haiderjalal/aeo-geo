import { describe, it, expect } from "vitest";
import { parseRobots, isAllowed, hasExplicitGroup } from "./robots";

const groups = parseRobots(`
User-agent: *
Disallow: /admin/

User-agent: GPTBot
User-agent: PerplexityBot
Disallow: /

User-agent: ClaudeBot
Disallow:

User-agent: Bingbot
Disallow: /private/
Allow: /private/public-page
`);

describe("robots.txt evaluation", () => {
  it("blocks an agent named in a Disallow-all group", () => {
    expect(isAllowed(groups, "GPTBot", "/")).toBe(false);
  });

  it("applies a shared group to every agent listed in it", () => {
    expect(isAllowed(groups, "PerplexityBot", "/blog")).toBe(false);
  });

  it("treats an empty Disallow as allow-everything", () => {
    expect(isAllowed(groups, "ClaudeBot", "/")).toBe(true);
  });

  it("falls back to the wildcard group for unnamed agents", () => {
    expect(isAllowed(groups, "Googlebot", "/admin/x")).toBe(false);
    expect(isAllowed(groups, "Googlebot", "/blog")).toBe(true);
  });

  it("lets the longest matching rule win, with Allow breaking ties", () => {
    expect(isAllowed(groups, "Bingbot", "/private/x")).toBe(false);
    expect(isAllowed(groups, "Bingbot", "/private/public-page")).toBe(true);
  });

  it("allows everything when robots.txt is empty", () => {
    expect(isAllowed(parseRobots(""), "GPTBot", "/")).toBe(true);
  });

  it("honours wildcard and end-anchor patterns", () => {
    const wild = parseRobots("User-agent: *\nDisallow: /*.pdf$\nDisallow: /a*/b");
    expect(isAllowed(wild, "x", "/docs/file.pdf")).toBe(false);
    expect(isAllowed(wild, "x", "/docs/file.pdf?v=1")).toBe(true);
    expect(isAllowed(wild, "x", "/alpha/b")).toBe(false);
  });

  it("reports whether an agent has its own group", () => {
    expect(hasExplicitGroup(groups, "gptbot")).toBe(true);
    expect(hasExplicitGroup(groups, "Claude-SearchBot")).toBe(false);
  });
});
