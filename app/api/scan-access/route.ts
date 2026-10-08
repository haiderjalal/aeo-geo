import { NextRequest, NextResponse } from "next/server";
import { hasFreeScan, newVisitor, visitorId, VISITOR_COOKIE } from "@/lib/scanAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const existing = visitorId(request.cookies.get(VISITOR_COOKIE)?.value);
    const visitor = existing ? { id: existing, token: null } : newVisitor();
    const response = NextResponse.json({ freeScanAvailable: hasFreeScan(visitor.id) }, { headers: { "Cache-Control": "no-store" } });
    if (visitor.token) response.cookies.set(VISITOR_COOKIE, visitor.token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Scan access is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
