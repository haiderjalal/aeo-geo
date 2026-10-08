import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";
import { finishFreeScan, hasFreeScan, reserveFreeScan, visitorId, VISITOR_COOKIE } from "@/lib/scanAccess";

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
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

  let visitor: string | null;
  try {
    visitor = visitorId(request.cookies.get(VISITOR_COOKIE)?.value);
    if (!visitor) return NextResponse.json({ success: false, message: "Please reload the page to initialize your free scan." }, { status: 409 });
    if (!hasFreeScan(visitor)) return NextResponse.json({ success: false, paymentRequired: true, message: "Your free scan has been used. Additional scans cost $10 USD, with your report delivered to WhatsApp after payment verification." }, { status: 402 });
    if (!reserveFreeScan(visitor)) return NextResponse.json({ success: false, message: "A scan is already running. Please wait and try again." }, { status: 409 });
  } catch {
    return NextResponse.json({ success: false, message: "Scan access is temporarily unavailable." }, { status: 503 });
  }

  try {
    const data = await analyze(url);
    finishFreeScan(visitor, true);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    finishFreeScan(visitor, false);
    // Surface only the messages we author; never leak fetch internals.
    const message =
      error instanceof Error && error.message.length < 200
        ? error.message
        : "Something went wrong analyzing that page.";
    console.error("analyze failed", { url, error });
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
