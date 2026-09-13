import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Check, CheckStatus } from "./types";
import type { FetchedDoc } from "./fetch";
import { parseRobots, isAllowed } from "./robots";

export interface PageInput {
  url: URL;
  page: FetchedDoc;
  bot: FetchedDoc;
  robots: FetchedDoc;
  llms: FetchedDoc;
  llmsFull: FetchedDoc;
  sitemap: FetchedDoc;
  markdown: FetchedDoc;
}

/** Bots that read the live web to answer questions. Blocking one forfeits citation there. */
const SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Google-Extended",
  "Bingbot",
] as const;

const STOPWORDS = new Set(
  (
    "the a an and or but if then than that this these those of to in for on with at by from as is are was were be been being " +
    "it its we you your our their they he she his her i me my us not no so can will just have has had do does did about " +
    "more most other some such only own same too very don now what which who whom when where why how all any both each will"
  ).split(" "),
);

const SOCIAL_HOSTS =
  /(facebook|twitter|instagram|linkedin|youtube|tiktok|pinterest|reddit)\.|^x\.com$|^t\.co$/i;

function check(
  id: string,
  category: Check["category"],
  label: string,
  weight: number,
  status: CheckStatus,
  detail: string,
  fix?: string,
): Check {
  return { id, category, label, weight, status, detail, ...(status === "pass" ? {} : { fix }) };
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

function visibleText($: CheerioAPI): string {
  const body = $("body").clone();
  body.find("script, style, noscript, svg, template, iframe").remove();
  return body.text().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- access

function accessChecks(input: PageInput): Check[] {
  const { page, bot, robots, sitemap, url } = input;
  const out: Check[] = [];

  out.push(
    page.status === 200
      ? check("http-ok", "access", "Page returns HTTP 200", 2, "pass", `Responded 200 in ${page.ms}ms.`)
      : check(
          "http-ok",
          "access",
          "Page returns HTTP 200",
          2,
          "fail",
          page.error ? `Request failed: ${page.error}.` : `Responded HTTP ${page.status}.`,
          "AI crawlers drop non-200 responses. Fix the status code or redirect chain before anything else.",
        ),
  );

  out.push(
    url.protocol === "https:"
      ? check("https", "access", "Served over HTTPS", 1, "pass", "Secure connection.")
      : check(
          "https",
          "access",
          "Served over HTTPS",
          1,
          "fail",
          "Served over plain HTTP.",
          "Move to HTTPS. Several AI crawlers skip insecure origins outright.",
        ),
  );

  if (!robots.ok || robots.status !== 200) {
    out.push(
      check(
        "robots-exists",
        "access",
        "robots.txt is reachable",
        2,
        "warn",
        `No robots.txt found (HTTP ${robots.status || "no response"}).`,
        "Publish /robots.txt naming the AI crawlers explicitly, so your policy is stated rather than assumed.",
      ),
    );
    out.push(
      check(
        "robots-ai",
        "access",
        "AI search crawlers are allowed",
        6,
        "warn",
        "Cannot confirm crawler policy without a robots.txt.",
        "Add a robots.txt that explicitly allows OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended and Bingbot.",
      ),
    );
  } else {
    const groups = parseRobots(robots.body);
    const path = url.pathname || "/";
    const blocked = SEARCH_BOTS.filter((b) => !isAllowed(groups, b, path));
    out.push(
      check("robots-exists", "access", "robots.txt is reachable", 2, "pass", "robots.txt found and parsed."),
    );
    out.push(
      blocked.length === 0
        ? check(
            "robots-ai",
            "access",
            "AI search crawlers are allowed",
            6,
            "pass",
            `All ${SEARCH_BOTS.length} major AI search crawlers may fetch this page.`,
          )
        : check(
            "robots-ai",
            "access",
            "AI search crawlers are allowed",
            6,
            "fail",
            `Blocked by robots.txt: ${blocked.join(", ")}.`,
            `Remove the Disallow rules for ${blocked.join(", ")}. Each blocked bot is a platform that can never cite you. Block CCBot instead if the goal is opting out of model training.`,
          ),
    );
  }

  // The highest-signal check here: many sites block AI bots at the CDN without
  // ever touching robots.txt, so robots.txt alone reports a false all-clear.
  const botBlocked =
    page.status === 200 &&
    (bot.status === 403 || bot.status === 429 || bot.status === 503 || bot.status === 0);
  const botThin =
    page.status === 200 && bot.status === 200 && bot.body.length < page.body.length * 0.5;

  out.push(
    botBlocked
      ? check(
          "waf-block",
          "access",
          "No firewall block on AI crawler requests",
          6,
          "fail",
          `Requesting as GPTBot returned ${bot.status || bot.error}, while a browser request returned 200.`,
          "Your CDN or WAF is challenging AI crawlers. Allowlist the AI bot user agents in your Cloudflare/WAF settings. This is invisible in robots.txt and silently removes you from AI answers.",
        )
      : botThin
        ? check(
            "waf-block",
            "access",
            "No firewall block on AI crawler requests",
            6,
            "warn",
            `GPTBot received a much smaller response (${bot.body.length} vs ${page.body.length} bytes).`,
            "Check whether your edge serves a reduced or challenge page to AI crawlers.",
          )
        : check(
            "waf-block",
            "access",
            "No firewall block on AI crawler requests",
            6,
            "pass",
            "GPTBot receives the same page a browser does.",
          ),
  );

  out.push(
    sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body)
      ? check("sitemap", "access", "XML sitemap is available", 2, "pass", "sitemap.xml found and parses.")
      : check(
          "sitemap",
          "access",
          "XML sitemap is available",
          2,
          "warn",
          "No parseable /sitemap.xml.",
          "Publish a sitemap and reference it from robots.txt so crawlers find every page without guessing.",
        ),
  );

  return out;
}

// -------------------------------------------------------- extractability

function extractabilityChecks($: CheerioAPI, text: string, input: PageInput): Check[] {
  const out: Check[] = [];
  const wordCount = words(text).length;
  const scriptBytes = $("script")
    .toArray()
    .reduce((n, el) => n + ($(el).html()?.length ?? 0), 0);

  // No major AI crawler executes JavaScript, so content that only exists after
  // hydration is invisible to every one of them.
  const clientRendered = wordCount < 200 && scriptBytes > 20_000;
  out.push(
    clientRendered
      ? check(
          "ssr",
          "extractability",
          "Content is present in the raw HTML",
          8,
          "fail",
          `Only ${wordCount} words in the server HTML alongside ${Math.round(scriptBytes / 1024)}KB of inline script, so the content appears to be client-rendered.`,
          "No major AI crawler runs JavaScript. Server-render or statically generate the main content so it exists in the initial HTML response.",
        )
      : wordCount < 300
        ? check(
            "ssr",
            "extractability",
            "Content is present in the raw HTML",
            8,
            "warn",
            `Only ${wordCount} words of text in the server HTML.`,
            "Thin pages rarely get cited. Aim for substantive, self-contained content in the initial HTML.",
          )
        : check(
            "ssr",
            "extractability",
            "Content is present in the raw HTML",
            8,
            "pass",
            `${wordCount} words available without running JavaScript.`,
          ),
  );

  const h1s = $("h1");
  out.push(
    h1s.length === 1
      ? check(
          "h1",
          "extractability",
          "Exactly one H1",
          2,
          "pass",
          `H1: ${h1s.first().text().trim().slice(0, 80)}`,
        )
      : check(
          "h1",
          "extractability",
          "Exactly one H1",
          2,
          h1s.length === 0 ? "fail" : "warn",
          `Found ${h1s.length} H1 elements.`,
          "Use a single H1 that states what the page answers. Models use it to decide what the page is about.",
        ),
  );

  const headings = $("h1, h2, h3, h4, h5, h6")
    .toArray()
    .map((el) => ({ level: Number(el.tagName[1]), text: $(el).text().trim() }))
    .filter((h) => h.text.length > 0);

  let skips = 0;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) skips++;
  }
  out.push(
    headings.length >= 3 && skips === 0
      ? check(
          "heading-order",
          "extractability",
          "Heading hierarchy is unbroken",
          2,
          "pass",
          `${headings.length} headings, no skipped levels.`,
        )
      : check(
          "heading-order",
          "extractability",
          "Heading hierarchy is unbroken",
          2,
          "warn",
          headings.length < 3
            ? `Only ${headings.length} headings on the page.`
            : `${skips} skipped heading level(s).`,
          "Headings are how retrieval systems segment a page. Use H2/H3 in order, with no jumps.",
        ),
  );

  const questionish = headings.filter(
    (h) =>
      /\?$/.test(h.text) ||
      /^(what|how|why|when|where|who|which|can|should|does|do|is|are)\b/i.test(h.text),
  );
  out.push(
    questionish.length >= 2
      ? check(
          "question-headings",
          "extractability",
          "Headings match how people ask questions",
          3,
          "pass",
          `${questionish.length} question-shaped headings.`,
        )
      : check(
          "question-headings",
          "extractability",
          "Headings match how people ask questions",
          3,
          questionish.length === 1 ? "warn" : "fail",
          `${questionish.length} question-shaped heading(s).`,
          "Phrase H2/H3s the way users phrase queries, e.g. How does X work? rather than Overview. Query fan-out retrieves against these.",
        ),
  );

  // Self-contained 40-60 word passages are the unit AI systems actually extract.
  const paragraphs = $("p")
    .toArray()
    .map((el) => words($(el).text()).length)
    .filter((n) => n > 0);
  const answerBlocks = paragraphs.filter((n) => n >= 30 && n <= 80).length;
  out.push(
    answerBlocks >= 3
      ? check(
          "answer-blocks",
          "extractability",
          "Extractable answer blocks present",
          5,
          "pass",
          `${answerBlocks} paragraphs in the 30-80 word extraction sweet spot.`,
        )
      : check(
          "answer-blocks",
          "extractability",
          "Extractable answer blocks present",
          5,
          answerBlocks >= 1 ? "warn" : "fail",
          `${answerBlocks} paragraph(s) in the extractable range.`,
          "Lead each section with a direct 40-60 word answer that stands on its own, with no back-references to earlier paragraphs.",
        ),
  );

  const median = paragraphs.length
    ? [...paragraphs].sort((a, b) => a - b)[Math.floor(paragraphs.length / 2)]
    : 0;
  out.push(
    paragraphs.length === 0
      ? check(
          "para-length",
          "extractability",
          "Paragraphs are chunk-sized",
          2,
          "fail",
          "No paragraph elements found.",
          "Use real p elements. Text in bare divs is harder to segment cleanly.",
        )
      : median <= 120
        ? check(
            "para-length",
            "extractability",
            "Paragraphs are chunk-sized",
            2,
            "pass",
            `Median paragraph is ${median} words.`,
          )
        : check(
            "para-length",
            "extractability",
            "Paragraphs are chunk-sized",
            2,
            "warn",
            `Median paragraph is ${median} words.`,
            "Long paragraphs get split mid-thought during chunking. Break them so each conveys one idea.",
          ),
  );

  const tables = $("table").length;
  out.push(
    tables > 0
      ? check("tables", "extractability", "Comparison data in tables", 2, "pass", `${tables} table(s) found.`)
      : check(
          "tables",
          "extractability",
          "Comparison data in tables",
          2,
          "warn",
          "No tables on the page.",
          "Comparison articles are the most-cited content type. Where you compare options, use a real table. Models extract rows far more reliably than prose.",
        ),
  );

  const lists = $("ul, ol")
    .toArray()
    .filter((el) => $(el).children("li").length >= 3).length;
  out.push(
    lists > 0
      ? check("lists", "extractability", "Process content in lists", 1, "pass", `${lists} substantive list(s).`)
      : check(
          "lists",
          "extractability",
          "Process content in lists",
          1,
          "warn",
          "No lists with 3 or more items.",
          "Use ordered lists for steps and unordered for enumerations. Both survive chunking better than prose.",
        ),
  );

  const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/i.test(input.page.body);
  out.push(
    questionish.length >= 3 || hasFaqSchema
      ? check(
          "faq",
          "extractability",
          "FAQ-style question and answer content",
          2,
          "pass",
          hasFaqSchema
            ? "FAQPage markup present."
            : `${questionish.length} question headings form an implicit FAQ.`,
        )
      : check(
          "faq",
          "extractability",
          "FAQ-style question and answer content",
          2,
          "warn",
          "No FAQ section detected.",
          "Add an FAQ answering the real follow-up questions in your category. Perplexity in particular favours pages with FAQ structure.",
        ),
  );

  return out;
}

// ---------------------------------------------------------------- schema

interface SchemaInfo {
  blocks: number;
  invalid: number;
  types: Set<string>;
}

function readSchema($: CheerioAPI): SchemaInfo {
  const info: SchemaInfo = { blocks: 0, invalid: 0, types: new Set() };

  const collect = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") info.types.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && info.types.add(x));
    if (Array.isArray(obj["@graph"])) collect(obj["@graph"]);
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    info.blocks++;
    try {
      collect(JSON.parse($(el).text()));
    } catch {
      info.invalid++;
    }
  });
  return info;
}

const ENTITY_TYPES = ["Organization", "WebSite", "LocalBusiness", "Person", "Corporation"];
const PAGE_TYPES = [
  "Article",
  "BlogPosting",
  "NewsArticle",
  "TechArticle",
  "Product",
  "SoftwareApplication",
  "HowTo",
  "FAQPage",
  "Recipe",
  "Course",
  "Event",
  "Service",
];

function schemaChecks(schema: SchemaInfo): Check[] {
  const out: Check[] = [];
  const has = (list: string[]) => list.some((t) => schema.types.has(t));

  out.push(
    schema.blocks > 0
      ? check(
          "jsonld",
          "schema",
          "JSON-LD structured data present",
          4,
          "pass",
          `${schema.blocks} JSON-LD block(s): ${[...schema.types].join(", ") || "no @type declared"}.`,
        )
      : check(
          "jsonld",
          "schema",
          "JSON-LD structured data present",
          4,
          "fail",
          "No JSON-LD found.",
          "Add JSON-LD structured data. It is the highest-leverage single change for Google AI Overviews and correlates with a 30-40% visibility lift on other engines.",
        ),
  );

  out.push(
    schema.blocks === 0
      ? check("jsonld-valid", "schema", "Structured data parses cleanly", 3, "na", "No JSON-LD to validate.")
      : schema.invalid === 0
        ? check(
            "jsonld-valid",
            "schema",
            "Structured data parses cleanly",
            3,
            "pass",
            "All JSON-LD blocks are valid JSON.",
          )
        : check(
            "jsonld-valid",
            "schema",
            "Structured data parses cleanly",
            3,
            "fail",
            `${schema.invalid} of ${schema.blocks} JSON-LD block(s) failed to parse.`,
            "Invalid JSON-LD is ignored entirely. Validate at validator.schema.org.",
          ),
  );

  out.push(
    has(ENTITY_TYPES)
      ? check(
          "schema-entity",
          "schema",
          "Publisher entity is declared",
          3,
          "pass",
          `Entity type: ${ENTITY_TYPES.filter((t) => schema.types.has(t)).join(", ")}.`,
        )
      : check(
          "schema-entity",
          "schema",
          "Publisher entity is declared",
          3,
          "fail",
          "No Organization, WebSite or Person schema.",
          "Add Organization (or LocalBusiness) schema with sameAs links to your profiles. This is how engines tie the page to a known entity.",
        ),
  );

  out.push(
    has(PAGE_TYPES)
      ? check(
          "schema-page",
          "schema",
          "Page-type schema is declared",
          3,
          "pass",
          `Page type: ${PAGE_TYPES.filter((t) => schema.types.has(t)).join(", ")}.`,
        )
      : check(
          "schema-page",
          "schema",
          "Page-type schema is declared",
          3,
          "fail",
          "No Article, Product, HowTo or FAQPage schema.",
          "Declare what this page is with the matching schema type so retrieval systems know how to use it.",
        ),
  );

  out.push(
    schema.types.has("FAQPage")
      ? check("schema-faq", "schema", "FAQPage markup", 2, "pass", "FAQPage schema present.")
      : check(
          "schema-faq",
          "schema",
          "FAQPage markup",
          2,
          "warn",
          "No FAQPage schema.",
          "Where you have question and answer content, mark it up as FAQPage. Perplexity cites pages with FAQ structured data noticeably more often.",
        ),
  );

  return out;
}

// ------------------------------------------------------------- authority

function authorityChecks($: CheerioAPI, text: string, input: PageInput): Check[] {
  const out: Check[] = [];
  const tokens = words(text);
  const wordCount = tokens.length || 1;
  const raw = input.page.body;

  // Princeton GEO (KDD 2024): statistics (+37%) and cited sources (+40%) were the
  // two strongest levers tested. Both come down to machine-verifiable provenance.
  const stats = text.match(/(\$\s?\d|\d[\d,.]*\s?(%|percent|x\b|million|billion|bn|k\b))/gi) ?? [];
  const per1k = (stats.length / wordCount) * 1000;
  out.push(
    per1k >= 4
      ? check(
          "stats",
          "authority",
          "Statistics with concrete numbers",
          5,
          "pass",
          `${stats.length} statistics (${per1k.toFixed(1)} per 1,000 words).`,
        )
      : check(
          "stats",
          "authority",
          "Statistics with concrete numbers",
          5,
          per1k >= 1.5 ? "warn" : "fail",
          `${stats.length} statistics (${per1k.toFixed(1)} per 1,000 words).`,
          "Adding sourced statistics raised citation visibility ~37% in the Princeton GEO study. Replace claims like industry leading with a dated number and its source.",
        ),
  );

  const host = input.url.hostname.replace(/^www\./, "");
  const outbound = new Set<string>();
  $("a[href^='http']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    try {
      const h = new URL(href).hostname.replace(/^www\./, "");
      if (h !== host && !SOCIAL_HOSTS.test(h)) outbound.add(h);
    } catch {
      /* ignore malformed hrefs */
    }
  });
  out.push(
    outbound.size >= 3
      ? check(
          "citations",
          "authority",
          "Outbound citations to other sources",
          5,
          "pass",
          `Links to ${outbound.size} distinct external domains.`,
        )
      : check(
          "citations",
          "authority",
          "Outbound citations to other sources",
          5,
          outbound.size >= 1 ? "warn" : "fail",
          `Links to ${outbound.size} distinct external domain(s).`,
          "Citing authoritative sources was the strongest single tactic measured: +40%, and up to +115% for lower-ranked pages. Link out to the research you reference.",
        ),
  );

  const authorHit =
    /"author"\s*:/i.test(raw) ||
    $('meta[name="author"]').length > 0 ||
    $('[rel="author"], [itemprop="author"], .author, .byline').length > 0 ||
    /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text.slice(0, 4000));
  out.push(
    authorHit
      ? check("author", "authority", "Author attribution", 4, "pass", "An author or byline is declared.")
      : check(
          "author",
          "authority",
          "Author attribution",
          4,
          "fail",
          "No author, byline or author schema found.",
          "Name a real author with credentials. E-E-A-T signals weigh heavily in Google AI Overviews, and anonymous pages lose to attributed ones.",
        ),
  );

  const dateStrings = [
    ...(raw.match(/"date(Published|Modified)"\s*:\s*"([^"]+)"/gi) ?? []),
    ...$("time[datetime]")
      .toArray()
      .map((el) => $(el).attr("datetime") ?? ""),
    $('meta[property="article:modified_time"]').attr("content") ?? "",
    $('meta[property="article:published_time"]').attr("content") ?? "",
  ];
  const dates = dateStrings
    .map((s) => new Date((s.match(/\d{4}-\d{2}-\d{2}[T\d:+\-.Z]*/) ?? [s])[0]))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getFullYear() > 2000);

  out.push(
    dates.length > 0
      ? check(
          "dates",
          "authority",
          "Publication or update date",
          3,
          "pass",
          `${dates.length} machine-readable date(s) found.`,
        )
      : check(
          "dates",
          "authority",
          "Publication or update date",
          3,
          "fail",
          "No machine-readable date on the page.",
          "Expose a visible Last updated date plus dateModified in schema. Undated content loses to dated content because recency is weighted heavily.",
        ),
  );

  if (dates.length === 0) {
    out.push(check("freshness", "authority", "Content is recent", 3, "na", "No date to evaluate."));
  } else {
    const newest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const days = Math.floor((Date.now() - newest.getTime()) / 86_400_000);
    out.push(
      days <= 180
        ? check("freshness", "authority", "Content is recent", 3, "pass", `Last dated ${days} days ago.`)
        : check(
            "freshness",
            "authority",
            "Content is recent",
            3,
            days <= 365 ? "warn" : "fail",
            `Last dated ${days} days ago.`,
            "ChatGPT cites content updated within 30 days roughly 3x more often. Refresh competitive pages quarterly and update the date honestly.",
          ),
    );
  }

  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 4 || STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const [topTerm, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const density = (topCount / wordCount) * 100;
  out.push(
    density < 3
      ? check(
          "stuffing",
          "authority",
          "No keyword stuffing",
          3,
          "pass",
          `Top term ${topTerm || "n/a"} is ${density.toFixed(1)}% of the text.`,
        )
      : check(
          "stuffing",
          "authority",
          "No keyword stuffing",
          3,
          density < 4.5 ? "warn" : "fail",
          `Top term ${topTerm} is ${density.toFixed(1)}% of the text (${topCount} of ${wordCount} words).`,
          "Keyword stuffing was the only tactic in the Princeton study that actively reduced AI visibility, at -10%. Write naturally; repetition no longer helps.",
        ),
  );

  return out;
}

// ------------------------------------------------------- machine-readable

function machineChecks($: CheerioAPI, input: PageInput): Check[] {
  const out: Check[] = [];
  const { llms, llmsFull, markdown } = input;

  const llmsOk = llms.status === 200 && /^\s*#/.test(llms.body) && llms.body.length > 50;
  out.push(
    llmsOk
      ? check("llmstxt", "machine", "llms.txt at the domain root", 3, "pass", `Found (${llms.body.length} bytes).`)
      : check(
          "llmstxt",
          "machine",
          "llms.txt at the domain root",
          3,
          "warn",
          "No valid /llms.txt.",
          "Add /llms.txt, a short markdown index of what you do and your key pages. No engine has confirmed it as a ranking signal, but it is cheap and helps agents orient.",
        ),
  );

  out.push(
    llmsFull.status === 200 && llmsFull.body.length > 200
      ? check(
          "llmsfull",
          "machine",
          "llms-full.txt companion",
          1,
          "pass",
          `Found (${Math.round(llmsFull.body.length / 1024)}KB).`,
        )
      : check(
          "llmsfull",
          "machine",
          "llms-full.txt companion",
          1,
          "warn",
          "No /llms-full.txt.",
          "Optional bonus: serve your full content in one file so an agent gets everything in a single request.",
        ),
  );

  const semantic = ["main", "article", "nav", "header", "footer"].filter((t) => $(t).length > 0);
  out.push(
    semantic.length >= 3
      ? check("semantic", "machine", "Semantic HTML landmarks", 3, "pass", `Uses ${semantic.join(", ")}.`)
      : check(
          "semantic",
          "machine",
          "Semantic HTML landmarks",
          3,
          semantic.length >= 1 ? "warn" : "fail",
          `Only ${semantic.length} landmark element(s) found.`,
          "Agents read the accessibility tree. Use main, article, nav, header and footer instead of anonymous divs.",
        ),
  );

  const imgs = $("img").toArray();
  const missingAlt = imgs.filter((el) => $(el).attr("alt") === undefined).length;
  out.push(
    imgs.length === 0
      ? check("alt", "machine", "Images have alt attributes", 2, "na", "No images on the page.")
      : missingAlt === 0
        ? check(
            "alt",
            "machine",
            "Images have alt attributes",
            2,
            "pass",
            `All ${imgs.length} images have an alt attribute.`,
          )
        : check(
            "alt",
            "machine",
            "Images have alt attributes",
            2,
            missingAlt / imgs.length > 0.3 ? "fail" : "warn",
            `${missingAlt} of ${imgs.length} images are missing alt.`,
            "Add alt text describing the image. Use an empty alt only for purely decorative images.",
          ),
  );

  const title = $("title").text().trim();
  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  out.push(
    title.length >= 15 && desc.length >= 50
      ? check(
          "meta",
          "machine",
          "Title and meta description",
          2,
          "pass",
          `Title ${title.length} chars, description ${desc.length} chars.`,
        )
      : check(
          "meta",
          "machine",
          "Title and meta description",
          2,
          title && desc ? "warn" : "fail",
          `Title ${title.length} chars, description ${desc.length} chars.`,
          "Write a descriptive title (15-60 chars) and a meta description (50-160 chars) that state what the page answers.",
        ),
  );

  const canonical = $('link[rel="canonical"]').attr("href");
  out.push(
    canonical
      ? check("canonical", "machine", "Canonical URL declared", 2, "pass", canonical)
      : check(
          "canonical",
          "machine",
          "Canonical URL declared",
          2,
          "warn",
          "No canonical link element.",
          "Declare a canonical URL so duplicate paths consolidate into one citable address.",
        ),
  );

  const servesMarkdown =
    markdown.status === 200 &&
    (/text\/markdown/i.test(markdown.headers.get("content-type") ?? "") ||
      (input.page.headers.get("link") ?? "").includes("text/markdown"));
  out.push(
    servesMarkdown
      ? check(
          "markdown",
          "machine",
          "Markdown representation for agents",
          2,
          "pass",
          "The page can be served as markdown.",
        )
      : check(
          "markdown",
          "machine",
          "Markdown representation for agents",
          2,
          "warn",
          "No markdown version offered.",
          "Emerging technique: return markdown at the same URL for Accept: text/markdown (with a Vary header), or advertise a parallel .md file via a Link header.",
        ),
  );

  return out;
}

export function runChecks(input: PageInput): Check[] {
  const $ = cheerio.load(input.page.body || "<html></html>");
  const text = visibleText($);
  const schema = readSchema($);

  return [
    ...accessChecks(input),
    ...extractabilityChecks($, text, input),
    ...schemaChecks(schema),
    ...authorityChecks($, text, input),
    ...machineChecks($, input),
  ];
}
