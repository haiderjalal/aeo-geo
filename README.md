# Citable

Paste a URL, get a 0–100 **AI readiness score** and a prioritized fix list for how that page will be
crawled, parsed and cited by AI search engines (ChatGPT, Perplexity, Claude, Copilot, Google AI Overviews).

## What it measures — and what it deliberately does not

This scores **AI readiness**: the signals a site owner controls on their own page. It is deterministic,
and every finding is traceable to something observed in the response. The first page scan per browser is free; additional scans cost $10 USD with manual WhatsApp report delivery.

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

## Design

The brand is built on one idea: a highlighter marking a passage for extraction — which is
literally what an AI engine does to your page when it decides to cite you.

| Token | Value | Role |
|---|---|---|
| `paper` | `#F2F3EF` | Cool off-white ground, not warm cream |
| `ink` | `#12140F` | Near-black with a green undertone to match the paper |
| `mark` | `#D8FF3C` | The highlighter. Only ever used *behind* ink, never as a text colour |
| `flag` | `#FF4D22` | Failure only, borrowed from HTTP error semantics |

Type is a three-voice system: **Bricolage Grotesque** for display (set huge and tight),
**Instrument Sans** for body, and **IBM Plex Mono** as the protocol voice — anything a machine
wrote: URLs, headers, status codes, check details.

Two signature elements carry the thesis:

- **The Rendered / Retrieved diff** on the idle page — the same mock page twice, aligned row by
  row, so what the crawler loses reads as a diff rather than an argument.
- **The spectrum** in the report — one tick per check, drawn in sequence. A healthy page is a calm
  even barcode; a single orange tick is visible instantly.

Names live in `lib/brand.ts`, so renaming is a one-file change. All motion is gated behind
`prefers-reduced-motion`.

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
  ScoreReport.tsx        score, spectrum, category meters, findings
  CrawlerView.tsx        the Rendered / Retrieved diff
lib/
  brand.ts               name and tagline — the only file a rebrand touches
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
- Free scan allowances are persisted in SQLite and linked to signed, HttpOnly browser cookies. Failed scans do not consume the allowance; concurrent scans cannot spend it twice.

## Payments and report requests

Customers pay $10 USD using the provided Wise payment link for `@haiderj23`, then prepare an email to `haiderjalal@musme.co` or a WhatsApp message to `+92 3438067821` with their website, email, WhatsApp number (including country code), and Wise transfer reference. The buttons open the selected app; customers attach their receipt or payment screenshot and send it themselves. They can also use the direct WhatsApp contact link to send requests or payment proof without completing the form. The site does not claim that a message has been sent.

Verify the recipient and $10 USD receipt in Wise before scanning the requested page and sending its report manually over WhatsApp. The payment link does not automatically verify payment or unlock the public scanner. Pricing, recipient, payment link, and inbox are configured in `lib/payments.ts`. Ensure the Wise payment request accepts repeat customer payments and the expected USD amount before launch.

The scanner uses Node.js SQLite (Node 22.13+ or 24+). Set `SCAN_DATA_DIR` to a persistent writable directory on a single Node server; it defaults to `.scan-data`. Back up the database and cookie secret together. Ephemeral/serverless deployment and multiple independent instances need a shared persistent database before launch. Browser identity is anonymous: clearing cookies or using another browser allows a new free scan. Strict one-free-scan-per-person enforcement requires verified accounts.

Page reports are not stored. Only visitor identifiers, allowance usage, and temporary scan reservations are persisted. Paid report details are sent through the customer's email app or WhatsApp and are handled by your team.
