const store = new Map<string, { v: string; exp: number | null }>();
const alive = (k: string) => { const e = store.get(k); if (!e) return null; if (e.exp && e.exp < Date.now()) { store.delete(k); return null; } return e; };
export class Redis {
  constructor(_url?: string) { /* shared in-memory store */ }
  async get(k: string) { return alive(k)?.v ?? null; }
  async set(k: string, v: string, mode?: string, ttl?: number) { store.set(k, { v: String(v), exp: mode === "EX" && ttl ? Date.now() + ttl * 1000 : null }); return "OK"; }
  async del(...ks: string[]) { let n = 0; for (const k of ks) if (store.delete(k)) n++; return n; }
  async incr(k: string) { const e = alive(k); const n = (e ? Number(e.v) : 0) + 1; store.set(k, { v: String(n), exp: e?.exp ?? null }); return n; }
  async expire(k: string, s: number) { const e = alive(k); if (e) e.exp = Date.now() + s * 1000; return e ? 1 : 0; }
}
export const __flushRedis = () => store.clear();
