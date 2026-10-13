import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getLeaderboardPage, LEADERBOARD_PAGE_SIZE, leaderboardHost, recordScan } from "./leaderboard";
import { db } from "./scanAccess";
import type { AnalysisResult, Grade } from "./types";

process.env.SCAN_DATA_DIR = mkdtempSync(join(tmpdir(), "citable-leaderboard-test-"));

function gradeFor(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function scan(finalUrl: string, score: number, { httpOk = true }: { httpOk?: boolean } = {}): AnalysisResult {
  return {
    url: finalUrl,
    finalUrl,
    fetchedAt: "2026-10-13T00:00:00.000Z",
    score,
    grade: gradeFor(score),
    categories: [],
    checks: [
      {
        id: "http-ok",
        category: "access",
        label: "Page returns HTTP 200",
        status: httpOk ? "pass" : "fail",
        weight: 2,
        detail: "",
      },
    ],
  };
}

beforeEach(() => {
  // Reading a page creates the table on a fresh database, then every test starts empty.
  getLeaderboardPage(1);
  db().exec("DELETE FROM leaderboard");
});

describe("leaderboardHost", () => {
  it("collapses www, case, ports, paths and trailing dots into one key", () => {
    expect(leaderboardHost("https://www.Example.com/")).toBe("example.com");
    expect(leaderboardHost("https://example.com:8443/pricing?x=1#y")).toBe("example.com");
    expect(leaderboardHost("https://example.com./")).toBe("example.com");
  });

  it("keeps real subdomains as separate sites", () => {
    expect(leaderboardHost("https://blog.example.com/")).toBe("blog.example.com");
  });

  it("rejects IP addresses, bare labels and unparseable input", () => {
    expect(leaderboardHost("http://93.184.216.34/")).toBeNull();
    expect(leaderboardHost("http://0x5db8d822/")).toBeNull();
    expect(leaderboardHost("http://[2606:2800:220:1::1]/")).toBeNull();
    expect(leaderboardHost("http://localhost:3000/")).toBeNull();
    expect(leaderboardHost("not a url")).toBeNull();
  });

  it("keeps internationalised domains in their punycode form", () => {
    expect(leaderboardHost("https://münchen.example/")).toBe("xn--mnchen-3ya.example");
  });
});

describe("recordScan", () => {
  it("lists a new site and reports its rank", () => {
    const placement = recordScan(scan("https://www.alpha.com/", 62));
    expect(placement).toEqual({ host: "alpha.com", rank: 1, total: 1, score: 62, grade: "C", improved: true });
  });

  it("keeps the best score when a site is rescanned worse", () => {
    recordScan(scan("https://alpha.com/", 80));
    const placement = recordScan(scan("https://alpha.com/", 40));
    expect(placement).toMatchObject({ score: 80, grade: "B", improved: false, total: 1 });
    expect(getLeaderboardPage(1).entries[0]).toMatchObject({ host: "alpha.com", score: 80, grade: "B", scans: 2 });
  });

  it("raises the score when a site is rescanned better", () => {
    recordScan(scan("https://alpha.com/", 40));
    const placement = recordScan(scan("https://www.alpha.com/", 90));
    expect(placement).toMatchObject({ score: 90, grade: "A", improved: true });
    expect(getLeaderboardPage(1).entries[0]).toMatchObject({ score: 90, grade: "A", scans: 2 });
  });

  it("ranks higher scores first", () => {
    recordScan(scan("https://low.com/", 30));
    recordScan(scan("https://high.com/", 95));
    const placement = recordScan(scan("https://mid.com/", 60));
    expect(placement).toMatchObject({ rank: 2, total: 3 });
    expect(getLeaderboardPage(1).entries.map((e) => e.host)).toEqual(["high.com", "mid.com", "low.com"]);
  });

  it("gives a tie to whoever reached the score first", () => {
    recordScan(scan("https://early.com/", 70));
    recordScan(scan("https://late.com/", 70));
    // Same-millisecond inserts would fall back to alphabetical order; pin the clock.
    db().prepare("UPDATE leaderboard SET scored_at = ? WHERE host = ?").run("2026-01-01T00:00:00.000Z", "late.com");
    db().prepare("UPDATE leaderboard SET scored_at = ? WHERE host = ?").run("2025-01-01T00:00:00.000Z", "early.com");
    expect(getLeaderboardPage(1).entries.map((e) => e.host)).toEqual(["early.com", "late.com"]);
    expect(recordScan(scan("https://late.com/", 70))).toMatchObject({ rank: 2 });
  });

  it("does not list pages that did not return HTTP 200", () => {
    expect(recordScan(scan("https://broken.com/", 20, { httpOk: false }))).toBeNull();
    expect(getLeaderboardPage(1).total).toBe(0);
  });

  it("does not list IP-address hosts", () => {
    expect(recordScan(scan("http://93.184.216.34/", 70))).toBeNull();
    expect(getLeaderboardPage(1).total).toBe(0);
  });

  it("keeps hidden sites off the board, out of the ranks, and hidden after a rescan", () => {
    recordScan(scan("https://visible.com/", 50));
    recordScan(scan("https://removed.com/", 99));
    db().prepare("UPDATE leaderboard SET hidden = 1 WHERE host = ?").run("removed.com");

    expect(recordScan(scan("https://removed.com/", 99))).toBeNull();
    const board = getLeaderboardPage(1);
    expect(board.total).toBe(1);
    expect(board.entries.map((e) => e.host)).toEqual(["visible.com"]);
    expect(recordScan(scan("https://visible.com/", 50))).toMatchObject({ rank: 1, total: 1 });
  });
});

describe("getLeaderboardPage", () => {
  it("returns an empty board without error", () => {
    expect(getLeaderboardPage(1)).toEqual({
      entries: [],
      total: 0,
      page: 1,
      pages: 1,
      pageSize: LEADERBOARD_PAGE_SIZE,
    });
  });

  it("paginates with ranks that continue across pages", () => {
    const count = LEADERBOARD_PAGE_SIZE + 5;
    for (let i = 0; i < count; i++) recordScan(scan(`https://site${String(i).padStart(2, "0")}.com/`, 100 - i));

    const first = getLeaderboardPage(1);
    expect(first).toMatchObject({ total: count, pages: 2, page: 1 });
    expect(first.entries).toHaveLength(LEADERBOARD_PAGE_SIZE);
    expect(first.entries[0]).toMatchObject({ rank: 1, host: "site00.com", score: 100 });

    const second = getLeaderboardPage(2);
    expect(second.entries).toHaveLength(5);
    expect(second.entries[0].rank).toBe(LEADERBOARD_PAGE_SIZE + 1);
  });

  it("clamps out-of-range and invalid page numbers", () => {
    recordScan(scan("https://only.com/", 50));
    expect(getLeaderboardPage(99).page).toBe(1);
    expect(getLeaderboardPage(-3).page).toBe(1);
    expect(getLeaderboardPage(Number.NaN).page).toBe(1);
    expect(getLeaderboardPage(Number.POSITIVE_INFINITY).page).toBe(1);
  });
});
