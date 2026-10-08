import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { finishFreeScan, hasFreeScan, newVisitor, reserveFreeScan, visitorId } from "./scanAccess";

process.env.SCAN_DATA_DIR = mkdtempSync(join(tmpdir(), "citable-access-test-"));

describe("free scan access", () => {
  it("recognizes a signed visitor and rejects tampered tokens", () => {
    const visitor = newVisitor();
    expect(visitorId(visitor.token)).toBe(visitor.id);
    expect(visitorId(`${visitor.token.slice(0, -1)}${visitor.token.endsWith("0") ? "1" : "0"}`)).toBeNull();
    expect(visitorId("../../invalid")).toBeNull();
  });

  it("prevents concurrent scans from claiming the same allowance", () => {
    const { id } = newVisitor();
    expect(reserveFreeScan(id)).toBe(true);
    expect(reserveFreeScan(id)).toBe(false);
  });

  it("consumes the allowance after a successful scan", () => {
    const { id } = newVisitor();
    reserveFreeScan(id);
    finishFreeScan(id, true);
    expect(hasFreeScan(id)).toBe(false);
    expect(reserveFreeScan(id)).toBe(false);
  });

  it("returns the allowance after a failed scan", () => {
    const { id } = newVisitor();
    reserveFreeScan(id);
    finishFreeScan(id, false);
    expect(hasFreeScan(id)).toBe(true);
    expect(reserveFreeScan(id)).toBe(true);
  });

  it("rejects an unknown visitor", () => {
    expect(hasFreeScan("unknown")).toBe(false);
    expect(reserveFreeScan("unknown")).toBe(false);
  });
});
