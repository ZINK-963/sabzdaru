/**
 * سرور تست/دمو که کد واقعی routeهای Next.js (فایل‌های route.ts زیر backend/app) را اجرا می‌کند:
 * Prisma → fake-prisma (از روی schema.prisma)، Redis → حافظه، next/* → shim. seed واقعی را اجرا می‌کند.
 * فرانت‌اند را هم با همان هدرهای next.config.js (CSP و…) سرو می‌کند.
 *   npx tsx testkit/server.ts        (PORT=4700 DEV_FIXED_OTP=123456 ...)
 */
import "./register";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
const ROOT = path.resolve(__dirname, "..");
const FRONT = path.resolve(process.env.FRONTEND_DIR || path.join(ROOT, "..", "frontend"));
const PORT = +(process.env.PORT || 4700);
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.SEED_DEMO = process.env.SEED_DEMO ?? "1";   // سرور تست/دمو داده‌ٔ نمایشی دارد
process.env.CRON_SECRET = process.env.CRON_SECRET || "dev-cron";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://fake";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://fake";

const { als } = require("./shims/next-headers");
const { NextRequest } = require("./shims/next-server");
const nextConfig = require(path.join(ROOT, "next.config.js"));

type RouteEntry = { re: RegExp; keys: string[]; file: string; mod?: any };
function walk(dir: string, out: string[] = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (e.name === "route.ts") out.push(p); } return out; }
const routes: RouteEntry[] = walk(path.join(ROOT, "app")).map((file) => {
  const rel = path.relative(path.join(ROOT, "app"), path.dirname(file)).split(path.sep); const keys: string[] = [];
  const pat = rel.map((seg) => { const c = /^\[\.\.\.(\w+)\]$/.exec(seg); if (c) { keys.push(c[1]); return "(.+)"; } const m = /^\[(\w+)\]$/.exec(seg); if (m) { keys.push(m[1]); return "([^/]+)"; } return seg.replace(/[.*+?^${}()|\\]/g, "\\$&"); }).join("/");
  return { re: new RegExp("^/" + pat + "/?$"), keys, file };
}).sort((a, b) => (a.keys.length - b.keys.length) || b.file.length - a.file.length);

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
const hdrs = async () => { const list = typeof nextConfig.headers === "function" ? await nextConfig.headers() : []; const h: Record<string, string> = {}; for (const r of list) for (const x of r.headers) h[x.key] = x.value; return h; };
const rewrites = async () => (typeof nextConfig.rewrites === "function" ? await nextConfig.rewrites() : []);

function matchRewrite(rules: any[], pathname: string): string | null {
  for (const r of rules) {
    const keys: string[] = []; const re = new RegExp("^" + r.source.replace(/:(\w+)\*/g, (_: string, k: string) => { keys.push(k); return "(.*)"; }).replace(/:(\w+)/g, (_: string, k: string) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    const m = re.exec(pathname); if (m) return r.destination.replace(/:(\w+)\*?/g, (_: string, k: string) => m[keys.indexOf(k) + 1] ?? "");
  } return null;
}

async function pack(res: Response, cookies: string[]) { const headers: Record<string, string | string[]> = {}; res.headers.forEach((v, k) => (headers[k] = v)); if (cookies.length) headers["set-cookie"] = cookies; return { status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) }; }
async function runRoute(req: http.IncomingMessage, pathname: string, body: Buffer | null, origin: string): Promise<{ status: number; headers: Record<string, string | string[]>; body: Buffer } | null> {
  const r = routes.find((x) => x.re.test(pathname)); if (!r) return null;
  r.mod = r.mod || require(r.file); const m = r.re.exec(pathname)!; const params: Record<string, string> = {}; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
  const method = req.method || "GET"; const fn = r.mod[method]; if (!fn) return { status: 405, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify({ error: "متد مجاز نیست" })) };
  const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v != null) h.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  const nreq = new NextRequest(origin + req.url, { method, headers: h, body: body && !["GET", "HEAD"].includes(method) ? body : undefined });
  const ctx = { req: nreq, setCookies: [] as string[] };
  return als.run(ctx, async () => {
    if (pathname.startsWith("/api/admin")) { const mw = require(path.join(ROOT, "middleware.ts")); const out = await mw.middleware(nreq); if (out && !out.headers.get("x-middleware-next")) return pack(out, ctx.setCookies); }
    const res: Response = await fn(nreq, { params });
    return pack(res, ctx.setCookies);
  });
}

async function main() {
  await require(path.join(ROOT, "prisma", "seed.ts")).main();
  const base = await hdrs(); const rw = await rewrites();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://x"); let pathname = decodeURIComponent(url.pathname); const origin = `http://${req.headers.host}`;
      const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer); const body = chunks.length ? Buffer.concat(chunks) : null;
      if (pathname === "/__test/reset") { const { resetDb } = require("./fake-prisma"); const { __flushRedis } = require("./shims/ioredis"); resetDb(); __flushRedis(); await require(path.join(ROOT, "prisma", "seed.ts")).main(); res.writeHead(200); return res.end("ok"); }
      const rewritten = matchRewrite(rw, pathname); if (rewritten) pathname = rewritten.split("?")[0];
      let out = await runRoute(req, pathname, body, origin);
      if (!out && pathname.startsWith("/api/")) out = { status: 404, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify({ error: "مسیر پیدا نشد" })) };
      if (!out) { // static (the synced frontend)
        const rel = pathname === "/" ? "/index.html" : pathname; const file = path.join(FRONT, rel);
        if (!file.startsWith(FRONT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...base }); return res.end("404"); }
        out = { status: 200, headers: { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" }, body: fs.readFileSync(file) };
      }
      res.writeHead(out.status, { ...base, ...out.headers }); res.end(out.body);
    } catch (e: any) { console.error(e); res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "harness error: " + e.message })); }
  });
  server.listen(PORT, () => console.log(`testkit server (REAL Next route code + fake Prisma) → http://localhost:${PORT}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
