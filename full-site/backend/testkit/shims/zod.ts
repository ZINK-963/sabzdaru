/** زیرمجموعهٔ zod که routeهای پروژه استفاده می‌کنند — فقط وقتی zod واقعی نصب نیست (در محیط واقعی zod خودش استفاده می‌شود) */
type Issue = { path: (string | number)[]; message: string };
class Z {
  _opt = false; _hasDef = false; _def: any; _checks: ((v: any) => string | null)[] = []; _trim = false;
  _c(): this { const c = Object.create(Object.getPrototypeOf(this)); Object.assign(c, this); c._checks = [...this._checks]; return c; }
  _parse(v: any, _p: any, _i: Issue[]): any { return v; }
  _run(v: any, path: (string | number)[], issues: Issue[]): any {
    if (v === undefined) { if (this._hasDef) return typeof this._def === "function" ? this._def() : structuredClone(this._def); if (this._opt) return undefined; issues.push({ path, message: "Required" }); return undefined; }
    return this._parse(v, path, issues);
  }
  safeParse(v: any) {
    const issues: Issue[] = []; const data = this._run(v, [], issues);
    if (issues.length) return { success: false as const, error: { issues, flatten() { const fieldErrors: Record<string, string[]> = {}, formErrors: string[] = []; for (const i of issues) { if (!i.path.length) formErrors.push(i.message); else (fieldErrors[String(i.path[0])] = fieldErrors[String(i.path[0])] || []).push(i.message); } return { formErrors, fieldErrors }; } } };
    return { success: true as const, data };
  }
  parse(v: any) { const r = this.safeParse(v); if (!r.success) throw Object.assign(new Error("ZodError"), { issues: r.error.issues }); return r.data; }
  refine(fn: (v: any) => boolean, opts?: any) { const c = this._c(); const msg = typeof opts === "string" ? opts : opts?.message || "Invalid"; c._checks.push((v) => (fn(v) ? null : msg)); return c; }
  optional() { const c = this._c(); c._opt = true; return c; }
  default(d: any) { const c = this._c(); c._hasDef = true; c._def = d; return c; }
  or(other: Z) { return new ZUnion([this, other]); }
}
class ZString extends Z {
  _parse(v: any, path: any, issues: Issue[]) {
    if (typeof v !== "string") { issues.push({ path, message: "Expected string, received " + typeof v }); return undefined; }
    const s = this._trim ? v.trim() : v; for (const c of this._checks) { const m = c(s); if (m) { issues.push({ path, message: m }); return undefined; } } return s;
  }
  min(n: number) { const c = this._c(); c._checks.push((s) => (s.length < n ? `String must contain at least ${n} character(s)` : null)); return c; }
  max(n: number) { const c = this._c(); c._checks.push((s) => (s.length > n ? `String must contain at most ${n} character(s)` : null)); return c; }
  regex(re: RegExp, msg = "Invalid") { const c = this._c(); c._checks.push((s) => (re.test(s) ? null : msg)); return c; }
  email() { return this.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"); }
  url() { const c = this._c(); c._checks.push((s) => { try { new URL(s); return null; } catch { return "Invalid url"; } }); return c; }
  datetime() { return this.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, "Invalid datetime"); }
  trim() { const c = this._c(); c._trim = true; return c; }
}
class ZNumber extends Z {
  _coerce = false;
  _parse(v: any, path: any, issues: Issue[]) {
    const n = this._coerce ? (v === "" || v === null ? NaN : Number(v)) : v;
    if (typeof n !== "number" || Number.isNaN(n)) { issues.push({ path, message: "Expected number" }); return undefined; }
    for (const c of this._checks) { const m = c(n); if (m) { issues.push({ path, message: m }); return undefined; } } return n;
  }
  int() { const c = this._c(); c._checks.push((n) => (Number.isInteger(n) ? null : "Expected integer")); return c; }
  positive() { const c = this._c(); c._checks.push((n) => (n > 0 ? null : "Number must be greater than 0")); return c; }
  min(x: number) { const c = this._c(); c._checks.push((n) => (n >= x ? null : `Number must be greater than or equal to ${x}`)); return c; }
  max(x: number) { const c = this._c(); c._checks.push((n) => (n <= x ? null : `Number must be less than or equal to ${x}`)); return c; }
}
class ZBoolean extends Z { _parse(v: any, p: any, i: Issue[]) { if (typeof v !== "boolean") { i.push({ path: p, message: "Expected boolean" }); return undefined; } return v; } }
class ZLiteral extends Z { constructor(public lit: any) { super(); } _parse(v: any, p: any, i: Issue[]) { if (v !== this.lit) { i.push({ path: p, message: `Invalid literal value, expected ${JSON.stringify(this.lit)}` }); return undefined; } return v; } }
class ZEnum extends Z { constructor(public vals: string[]) { super(); } _parse(v: any, p: any, i: Issue[]) { if (!this.vals.includes(v)) { i.push({ path: p, message: `Invalid enum value. Expected ${this.vals.join(" | ")}` }); return undefined; } return v; } }
class ZUnion extends Z { constructor(public opts: Z[]) { super(); } _parse(v: any, p: any, i: Issue[]) { for (const o of this.opts) { const r = o.safeParse(v); if (r.success) return r.data; } i.push({ path: p, message: "Invalid input" }); return undefined; } }
class ZArray extends Z {
  constructor(public item: Z) { super(); }
  _parse(v: any, path: any, issues: Issue[]) {
    if (!Array.isArray(v)) { issues.push({ path, message: "Expected array" }); return undefined; }
    const out = v.map((x, idx) => this.item._run(x, [...path, idx], issues));
    for (const c of this._checks) { const m = c(v); if (m) { issues.push({ path, message: m }); return undefined; } } return out;
  }
  min(n: number) { const c = this._c(); c._checks.push((a) => (a.length < n ? `Array must contain at least ${n} element(s)` : null)); return c; }
  max(n: number) { const c = this._c(); c._checks.push((a) => (a.length > n ? `Array must contain at most ${n} element(s)` : null)); return c; }
}
class ZObject extends Z {
  _refs: { fn: (v: any) => boolean; message: string; path: string[] }[] = [];
  constructor(public shape: Record<string, Z>) { super(); }
  _c(): this { const c = super._c(); c._refs = [...this._refs]; return c; }
  _parse(v: any, path: any, issues: Issue[]) {
    if (!v || typeof v !== "object" || Array.isArray(v)) { issues.push({ path, message: "Expected object" }); return undefined; }
    const out: any = {}; const before = issues.length;
    for (const [k, s] of Object.entries(this.shape)) { const r = s._run(v[k], [...path, k], issues); if (r !== undefined) out[k] = r; }
    if (issues.length === before) for (const r of this._refs) if (!r.fn(out)) issues.push({ path: [...path, ...r.path], message: r.message });
    return out;
  }
  refine(fn: (v: any) => boolean, opts: { message: string; path?: string[] } | string) { const c = this._c(); const o = typeof opts === "string" ? { message: opts } : opts; c._refs.push({ fn, message: o.message, path: o.path || [] }); return c; }
}
const coerceNum = () => { const n = new ZNumber(); n._coerce = true; return n; };
export const z = { string: () => new ZString(), number: () => new ZNumber(), boolean: () => new ZBoolean(), literal: (v: any) => new ZLiteral(v), enum: (v: string[]) => new ZEnum(v), array: (i: Z) => new ZArray(i), object: (s: Record<string, Z>) => new ZObject(s), coerce: { number: coerceNum } };
