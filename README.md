# AEO / GEO Analyzer

Paste a URL, get a 0–100 **AI readiness score** and a prioritized fix list for how that page will be
crawled, parsed and cited by AI search engines (ChatGPT, Perplexity, Claude, Copilot, Google AI Overviews).

## What it measures — and what it deliberately does not

This scores **AI readiness**: the signals a site owner controls on their own page. It is deterministic,
free, and every finding is traceable to something observed in the response.

It does **not** measure AI *visibility* — whether you are actually cited in ChatGPT or AI Overviews.
That depends on domain authority, third-party consensus (reviews, Reddit, Wikipedia, analysts) and live
prompt tracking, none of which can be read from a URL. Tools that claim otherwise from a single fetch
are guessing. The report says this out loud.

## Scoring

| Category | Weight | What it covers |
|---|---:|---|
| Crawler & Bot Access | 25% | robots.txt policy per AI bot, **live GPTBot fetch to catch WAF/CDN blocks**, HTTPS, sitemap |
| Content Extractability | 25% | Content in raw HTML (no AI crawler runs JS), headings, answer blocks, tables, lists, FAQ |
| Authority Signals | 20% | Statistics, outbound citations, author attribution, dates, freshness, keyword stuffing |
| Structured Data | 15% | JSON-LD presence and validity, entity type, page type, FAQPage |
| Machine Readability | 15% | llms.txt, llms-full.txt, semantic HTML, alt text, meta, canonical, markdown negotiation |

**Score cap:** if AI crawlers are blocked in robots.txt, blocked by the firewall, or the page does not
return 200, the score is capped at 40. An engine cannot cite a page it cannot fetch, so no other
improvement matters until that is fixed.

The weighting reflects the [Princeton/IIT Delhi GEO study](https://dl.acm.org/doi/10.1145/3637528.3671900)
(KDD 2024), which found citing sources (+40%), statistics (+37%) and quotations (+30%) were the strongest
levers tested — and that keyword stuffing was the only tactic that actively *reduced* AI visibility (−10%).

## Development

```bash
npm run dev        # dev server
npm test           # vitest — robots.txt evaluator + check engine
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

## Layout

```
app/
  page.tsx               form + result state (client)
  api/analyze/route.ts   POST { url } -> AnalysisResult; rate limited
components/
  ScoreReport.tsx        presentational report
lib/
  analyze.ts             orchestration: parallel fetches, scoring, grade, cap
  checks.ts              the ~33 checks, grouped by category
  robots.ts              robots.txt evaluator (group precedence, wildcards, longest-match)
  fetch.ts               fetching with SSRF guards, timeouts, size cap, bot-UA probe
  types.ts               shared types and category weights
```

## Notes

- **SSRF**: every user-supplied URL is resolved and checked against loopback / link-local / RFC1918
  ranges before any request, and re-checked after redirects.
- **Rate limiting** is in-memory and per-instance. Move to Redis/Vercel KV before running multi-instance.
- Nothing is persisted. There is no database.
