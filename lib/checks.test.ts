import { describe, it, expect } from "vitest";
import { runChecks, type PageInput } from "./checks";
import type { FetchedDoc } from "./fetch";
import type { Check } from "./types";

function doc(over: Partial<FetchedDoc> = {}): FetchedDoc {
  return {
    ok: true,
    status: 200,
    finalUrl: "https://example.com/",
    headers: new Headers(),
    body: "",
    ms: 10,
    ...over,
  };
}

function input(pageHtml: string, over: Partial<PageInput> = {}): PageInput {
  return {
    url: new URL("https://example.com/"),
    page: doc({ body: pageHtml }),
    bot: doc({ body: pageHtml }),
    robots: doc({ body: "User-agent: *\nAllow: /" }),
    llms: doc({ status: 404 }),
    llmsFull: doc({ status: 404 }),
    sitemap: doc({ status: 404 }),
    markdown: doc({ status: 404 }),
    ...over,
  };
}

function by(checks: Check[], id: string): Check {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`no check with id ${id}`);
  return found;
}

const VOCAB = (
  "retrieval passage ranking context window citation answer engine crawler index embedding " +
  "structure heading paragraph summary source evidence provenance signal relevance corpus " +
  "document segment boundary extraction pipeline reranking synthesis prompt query intent " +
  "overview snippet threshold vector similarity token chunking freshness attribution author " +
  "schema markup entity knowledge graph crawlable parseable rendered markdown sitemap robots " +
  "latency coverage recall precision grounding hallucination verbatim quotation statistic study"
).split(" ");

/** Varied filler, so fixtures do not accidentally trip the keyword-density check. */
const para = (n: number) =>
  `<p>${Array.from({ length: n }, (_, i) => VOCAB[i % VOCAB.length]).join(" ")}.</p>`;

const ARTICLE = `<html><head><title>How chunking affects AI citations</title>
<meta name="description" content="A practical look at how retrieval systems split pages into passages and what that means for your content.">
<link rel="canonical" href="https://example.com/">
<script type="application/ld+json">{"@type":"Article","author":{"@type":"Person","name":"A B"},"datePublished":"${new Date().toISOString()}"}</script>
<script type="application/ld+json">{"@type":"Organization","name":"Example"}</script>
</head><body><main><article>
<h1>How chunking affects AI citations</h1>
<h2>What is chunking?</h2>${para(60)}${para(120)}
<h2>How do engines pick passages?</h2>${para(45)}
<h2>Why does structure matter?</h2>${para(60)}${para(140)}
<p>Traffic rose 41% and costs fell $2,000, a 3x improvement across 900 million sessions and 10k accounts.</p>
<table><tr><td>a</td></tr></table>
<ul><li>1</li><li>2</li><li>3</li></ul>
<a href="https://arxiv.org/x">src</a><a href="https://dl.acm.org/y">src</a><a href="https://google.com/z">src</a>
</article></main><nav></nav><footer></footer></body></html>`;

describe("extractability", () => {
  it("fails a client-rendered page with no content in the raw HTML", () => {
    const spa = `<html><body><div id="root"></div><script>${"const x=1;".repeat(4000)}</script></body></html>`;
    expect(by(runChecks(input(spa)), "ssr").status).toBe("fail");
  });

  it("passes a server-rendered article", () => {
    expect(by(runChecks(input(ARTICLE)), "ssr").status).toBe("pass");
  });
});

describe("a well-formed article", () => {
  const checks = runChecks(input(ARTICLE));
  const shouldPass = [
    "h1", "question-headings", "answer-blocks", "tables", "lists", "faq",
    "jsonld", "jsonld-valid", "schema-entity", "schema-page",
    "stats", "citations", "author", "dates", "freshness", "stuffing",
    "semantic", "meta", "canonical", "robots-ai", "waf-block",
  ];

  it.each(shouldPass)("passes %s", (id) => {
    expect(by(checks, id).status).toBe("pass");
  });

  it("never attaches a fix to a passing check", () => {
    expect(checks.filter((c) => c.status === "pass" && c.fix !== undefined)).toEqual([]);
  });

  it("always attaches a fix to a failing or warning check", () => {
    const actionable = runChecks(input("<html><body><p>thin</p></body></html>"));
    const missing = actionable.filter(
      (c) => (c.status === "fail" || c.status === "warn") && typeof c.fix !== "string",
    );
    expect(missing).toEqual([]);
  });
});

describe("access blocking", () => {
  it("detects a firewall that 403s GPTBot while serving browsers normally", () => {
    const result = runChecks(input(ARTICLE, { bot: doc({ status: 403, body: "" }) }));
    expect(by(result, "waf-block").status).toBe("fail");
  });

  it("detects a robots.txt Disallow and names the blocked bot", () => {
    const result = runChecks(
      input(ARTICLE, { robots: doc({ body: "User-agent: GPTBot\nDisallow: /" }) }),
    );
    expect(by(result, "robots-ai").status).toBe("fail");
    expect(by(result, "robots-ai").detail).toContain("GPTBot");
  });
});

describe("authority", () => {
  it("flags unparseable JSON-LD rather than ignoring it", () => {
    const badLd = `<html><body><p>x</p><script type="application/ld+json">{nope</script></body></html>`;
    expect(by(runChecks(input(badLd)), "jsonld-valid").status).toBe("fail");
  });

  it("catches keyword stuffing, the one tactic that actively hurts", () => {
    const stuffed = `<html><body>${para(300)}<p>${"peptides ".repeat(120)}</p></body></html>`;
    expect(by(runChecks(input(stuffed)), "stuffing").status).toBe("fail");
  });
});
