import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const VISITOR_COOKIE = "citable_visitor";
let database: DatabaseSync | undefined;
let secret: string;

function db() {
  if (database) return database;
  // Runtime data lives on a persistent volume and must not be bundled by Next.js.
  const directory = resolve(/* turbopackIgnore: true */ process.env.SCAN_DATA_DIR ?? ".scan-data");
  mkdirSync(directory, { recursive: true });
  const secretPath = resolve(directory, "cookie-secret");
  try {
    writeFileSync(secretPath, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  secret = readFileSync(secretPath, "utf8");
  database = new DatabaseSync(resolve(directory, "scans.sqlite"));
  database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0, reserved_until INTEGER NOT NULL DEFAULT 0)");
  return database;
}

function signature(id: string) {
  db();
  return createHmac("sha256", secret).update(id).digest("hex");
}

export function visitorId(token: string | undefined): string | null {
  if (!token) return null;
  const [id, signed, extra] = token.split(".");
  if (extra || !/^[a-f0-9-]{36}$/.test(id ?? "") || !/^[a-f0-9]{64}$/.test(signed ?? "")) return null;
  return timingSafeEqual(Buffer.from(signature(id)), Buffer.from(signed)) ? id : null;
}

export function newVisitor() {
  const id = randomUUID();
  db().prepare("INSERT INTO visitors (id) VALUES (?)").run(id);
  return { id, token: `${id}.${signature(id)}` };
}

export function hasFreeScan(id: string) {
  const row = db().prepare("SELECT used FROM visitors WHERE id = ?").get(id);
  return row?.used === 0;
}

export function reserveFreeScan(id: string) {
  const now = Date.now();
  return db().prepare("UPDATE visitors SET reserved_until = ? WHERE id = ? AND used = 0 AND reserved_until < ?")
    .run(now + 120_000, id, now).changes === 1;
}

export function finishFreeScan(id: string, success: boolean) {
  db().prepare("UPDATE visitors SET used = ?, reserved_until = 0 WHERE id = ?").run(success ? 1 : 0, id);
}
