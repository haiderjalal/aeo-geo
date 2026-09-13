import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 4_000_000;

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
export const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";

export interface FetchedDoc {
  ok: boolean;
  status: number;
  finalUrl: string;
  headers: Headers;
  body: string;
  ms: number;
  error?: string;
}

/**
 * Blocks loopback, link-local, and RFC1918 ranges so a pasted URL cannot be
 * used to probe the host network. Every user-supplied URL passes through here.
 */
function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6 === "::1" || v6 === "::") return true;
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique local
    if (v6.startsWith("fe80")) return true; // link local
    // IPv4-mapped IPv6 (::ffff:10.0.0.1)
    const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be analyzed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Private and local addresses cannot be analyzed.");
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error("That domain could not be resolved.");
      });
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Private and local addresses cannot be analyzed.");
  }
  return url;
}

export async function fetchDoc(
  url: string,
  init: { ua?: string; accept?: string } = {},
): Promise<FetchedDoc> {
  const started = Date.now();
  const empty = (error: string): FetchedDoc => ({
    ok: false,
    status: 0,
    finalUrl: url,
    headers: new Headers(),
    body: "",
    ms: Date.now() - started,
    error,
  });

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": init.ua ?? BROWSER_UA,
        accept: init.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    // Re-validate after redirects: a public URL can redirect into a private one.
    if (res.url && res.url !== url) {
      await assertPublicUrl(res.url);
    }

    const reader = res.body?.getReader();
    let body = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        body += decoder.decode(value, { stream: true });
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      headers: res.headers,
      body,
      ms: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return empty(message.includes("timed out") || message.includes("abort") ? "timeout" : message);
  }
}
