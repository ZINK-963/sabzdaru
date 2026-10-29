function parseCookies(h: string | null) { const m: Record<string, string> = {}; for (const part of (h || "").split(/;\s*/)) { const i = part.indexOf("="); if (i > 0) m[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1)); } return m; }
export class NextRequest extends Request {
  get nextUrl() { return new URL(this.url); }
  get cookies() { const jar = parseCookies(this.headers.get("cookie")); return { get: (n: string) => (n in jar ? { name: n, value: jar[n] } : undefined) }; }
}
export class NextResponse extends Response {
  static json(body: any, init?: { status?: number; headers?: Record<string, string> }) { return new NextResponse(JSON.stringify(body), { status: init?.status ?? 200, headers: { "content-type": "application/json", ...(init?.headers || {}) } }); }
  static redirect(url: string | URL, status = 307) { return new NextResponse(null, { status, headers: { location: String(url) } }); }
  static next() { return new NextResponse(null, { status: 200, headers: { "x-middleware-next": "1" } }); }
}
