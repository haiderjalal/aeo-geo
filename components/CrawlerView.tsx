import type { CSSProperties, ReactNode } from "react";

/**
 * The thesis, shown rather than argued: one page, two versions, aligned row by
 * row so the losses land as a diff. Left is what a person sees; right is what an
 * AI crawler actually receives — no JavaScript, no layout, just liftable text.
 */

interface Row {
  id: string;
  rendered: ReactNode;
  retrieved: ReactNode;
}

function Lost({ label, reason }: { label: string; reason: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-ink-faint line-through decoration-flag decoration-2">{label}</span>
      <span className="text-[11px] text-ink-faint">{reason}</span>
    </span>
  );
}

const ROWS: Row[] = [
  {
    id: "hero",
    rendered: <div className="h-16 rounded bg-gradient-to-br from-rule to-rule-strong" />,
    retrieved: <Lost label="[hero image]" reason="no alt text" />,
  },
  {
    id: "headline",
    rendered: <p className="display text-xl">Peptide research, simplified</p>,
    retrieved: (
      <span>
        <span className="text-ink-faint">&lt;h1&gt;</span> Peptide research, simplified
      </span>
    ),
  },
  {
    id: "body",
    rendered: (
      <p className="text-sm leading-relaxed text-ink-soft">
        Lab-tested compounds with certificates of analysis on every batch.
      </p>
    ),
    retrieved: (
      <span className="mark" style={{ "--mark-delay": "1s" } as CSSProperties}>
        Lab-tested compounds with certificates of analysis on every batch.
      </span>
    ),
  },
  {
    id: "price",
    rendered: (
      <p className="flex items-baseline gap-2">
        <span className="display text-lg">$129</span>
        <span className="text-xs text-ink-faint">per 10mg vial</span>
      </p>
    ),
    retrieved: <Lost label="$129" reason="rendered by JavaScript" />,
  },
  {
    id: "cta",
    rendered: (
      <span className="w-fit rounded-md bg-ink px-3.5 py-2 text-xs font-medium text-paper">
        Get pricing
      </span>
    ),
    retrieved: <Lost label="Get pricing" reason="button, not readable text" />,
  },
];

/** Only rendered on narrow screens, where the column headers are hidden. */
function CellLabel({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase sm:hidden">
      {children}
    </span>
  );
}

function ColumnHead({ index, title, note }: { index: string; title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] text-ink-faint">{index}</span>
      <h3 className="font-mono text-[11px] tracking-[0.18em] text-ink uppercase">{title}</h3>
      <span className="ml-auto hidden font-mono text-[11px] text-ink-faint sm:inline">{note}</span>
    </div>
  );
}

export default function CrawlerView() {
  return (
    <section aria-labelledby="two-versions">
      <h2 id="two-versions" className="sr-only">
        The same page, rendered and retrieved
      </h2>

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-rule bg-paper-raised sm:grid-cols-2">
        {/* Column headers carry the labels on wide screens only. Stacked, they
            would orphan themselves from the rows below, so each cell labels
            itself instead — see CellLabel. */}
        <div className="hidden border-b border-rule px-6 py-4 sm:block">
          <ColumnHead index="01" title="Rendered" note="what a person sees" />
        </div>
        <div className="hidden border-b border-rule bg-paper px-6 py-4 sm:block sm:border-l">
          <ColumnHead index="02" title="Retrieved" note="what GPTBot receives" />
        </div>

        {/* Paired rows — each cell sits opposite its counterpart */}
        {ROWS.map((row, i) => {
          // `last:` can't be used here — inside a display:contents wrapper it
          // matches every second cell rather than the final row. Stacked, the
          // rendered cell keeps its rule to stay separated from its partner.
          const isLast = i === ROWS.length - 1;
          const cell =
            "rise flex min-h-[4.5rem] flex-col justify-center gap-2 border-rule px-6 py-4";
          return (
            <div key={row.id} className="contents">
              <div
                className={`${cell} border-b ${isLast ? "sm:border-b-0" : ""}`}
                style={{ "--delay": `${0.1 + i * 0.06}s` } as CSSProperties}
              >
                <CellLabel>Rendered</CellLabel>
                {row.rendered}
              </div>
              <div
                className={`${cell} bg-paper font-mono text-[13px] leading-relaxed sm:border-l ${
                  isLast ? "" : "border-b"
                }`}
                style={{ "--delay": `${0.16 + i * 0.06}s` } as CSSProperties}
              >
                <CellLabel>Retrieved</CellLabel>
                {row.retrieved}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-soft">
        No major AI crawler runs JavaScript. Anything that appears only after hydration — prices,
        specs, whole sections — is invisible to the engines deciding what to cite.{" "}
        <span className="text-ink">Citable tells you which half of your page survives.</span>
      </p>
    </section>
  );
}
