import { AsyncLocalStorage } from "node:async_hooks";
export type Ctx = { req: Request; setCookies: string[] };
export const als = new AsyncLocalStorage<Ctx>();
function ser(name: string, value: string, o: any = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=${o.path ?? "/"}`;
  if (o.maxAge != null) s += `; Max-Age=${o.maxAge}`; if (o.httpOnly) s += "; HttpOnly"; if (o.secure) s += "; Secure"; if (o.sameSite) s += `; SameSite=${o.sameSite[0].toUpperCase()}${o.sameSite.slice(1)}`;
  return s;
}
export function cookies() {
  const ctx = als.getStore(); if (!ctx) throw new Error("cookies() called outside a request");
  const jar: Record<string, string> = {}; for (const part of (ctx.req.headers.get("cookie") || "").split(/;\s*/)) { const i = part.indexOf("="); if (i > 0) jar[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1)); }
  return { get: (n: string) => (n in jar ? { name: n, value: jar[n] } : undefined), set: (n: string, v: string, o?: any) => { ctx.setCookies.push(ser(n, v, o)); }, delete: (n: string) => { ctx.setCookies.push(`${n}=; Path=/; Max-Age=0`); } };
}
