import { NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

// ponytail: in-memory limiter, per instance. Swap for Redis/Vercel KV if this
// ever runs on more than one instance or gets real abuse traffic.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { success: false, message: "Too many scans. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  if (typeof url !== "string" || url.trim().length === 0 || url.length > 2048) {
    return NextResponse.json({ success: false, message: "Enter a URL to analyze." }, { status: 400 });
  }

  try {
    const data = await analyze(url);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    // Surface only the messages we author; never leak fetch internals.
    const message =
      error instanceof Error && error.message.length < 200
        ? error.message
        : "Something went wrong analyzing that page.";
    console.error("analyze failed", { url, error });
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
