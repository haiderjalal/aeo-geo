export type CheckStatus = "pass" | "warn" | "fail" | "na";

export type Category =
  | "access"
  | "extractability"
  | "schema"
  | "authority"
  | "machine";

export interface Check {
  id: string;
  category: Category;
  /** Human-readable name of what was tested. */
  label: string;
  status: CheckStatus;
  /** Relative importance inside its category. */
  weight: number;
  /** What we actually observed on the page. */
  detail: string;
  /** What to do about it. Omitted when the check passed. */
  fix?: string;
}

export interface CategoryScore {
  category: Category;
  label: string;
  /** 0-100 within this category. */
  score: number;
  /** This category's share of the overall score. */
  weight: number;
}

export interface AnalysisResult {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  /** 0-100. Capped when AI crawlers cannot reach the page at all. */
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  /** Set when a blocking failure caps the score, explaining why. */
  cappedReason?: string;
  categories: CategoryScore[];
  checks: Check[];
}

export const CATEGORY_META: Record<Category, { label: string; weight: number }> = {
  access: { label: "Crawler & Bot Access", weight: 25 },
  extractability: { label: "Content Extractability", weight: 25 },
  authority: { label: "Authority Signals", weight: 20 },
  schema: { label: "Structured Data", weight: 15 },
  machine: { label: "Machine Readability", weight: 15 },
};
