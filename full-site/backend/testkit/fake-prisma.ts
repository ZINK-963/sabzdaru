/**
 * یک «Prisma مجازی» برای اجرای کد واقعی routeها بدون PostgreSQL.
 * مدل‌ها، فیلدها، رابطه‌ها، یکتایی و کلیدهای خارجی مستقیم از prisma/schema.prisma خوانده می‌شوند؛
 * هر نام فیلد/رابطهٔ ناشناس در where/data/select/include/orderBy خطا می‌دهد (همان چیزی که Prisma واقعی
 * هنگام کامپایل یا اجرا می‌گوید). تراکنش‌ها سریالی‌اند و در خطا rollback می‌شوند.
 * فقط زیرمجموعهٔ API را که routeهای پروژه استفاده می‌کنند پیاده می‌کند و جایگزین Prisma واقعی نیست.
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

type Field = { name: string; type: string; list: boolean; optional: boolean; id: boolean; unique: boolean; hasDefault: boolean; def?: any; updatedAt: boolean; isModel: boolean; isEnum: boolean; rel?: { name?: string; fields: string[]; references: string[]; onDelete?: string } };
type Model = { name: string; delegate: string; fields: Record<string, Field>; uniques: string[][]; idField: string };
type Schema = { models: Record<string, Model>; enums: Record<string, string[]> };

class PrismaError extends Error { constructor(msg: string, public code: string, public meta?: any) { super(msg); this.name = "PrismaClientKnownRequestError"; } }
class ValidationError extends Error { constructor(msg: string) { super(msg); this.name = "PrismaClientValidationError"; } }

function attrs(rest: string) {
  const out: { name: string; args: string }[] = []; let i = 0;
  while (i < rest.length) {
    if (rest[i] === "@" && rest[i + 1] !== "@") {
      let j = i + 1; while (j < rest.length && /\w/.test(rest[j])) j++;
      const name = rest.slice(i + 1, j); let args = "";
      if (rest[j] === "(") { let d = 0, k = j; for (; k < rest.length; k++) { if (rest[k] === "(") d++; else if (rest[k] === ")") { d--; if (d === 0) break; } } args = rest.slice(j + 1, k); j = k + 1; }
      out.push({ name, args }); i = j;
    } else i++;
  }
  return out;
}
function parseDefault(expr: string): any {
  const e = expr.trim();
  if (e === "cuid()" || e === "uuid()") return () => "c" + crypto.randomBytes(12).toString("hex");
  if (e === "now()") return () => new Date();
  if (e === "autoincrement()") return "__auto__";
  if (/^".*"$/.test(e)) return e.slice(1, -1).replace(/\\"/g, '"');
  if (e === "true") return true; if (e === "false") return false; if (e === "[]") return () => [];
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  return e;
}
export function parseSchema(text: string): Schema {
  const enums: Record<string, string[]> = {};
  for (const m of text.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) enums[m[1]] = m[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
  const models: Record<string, Model> = {};
  for (const m of text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const model: Model = { name: m[1], delegate: m[1][0].toLowerCase() + m[1].slice(1), fields: {}, uniques: [], idField: "id" };
    for (let line of m[2].split("\n")) {
      line = line.replace(/\/\/.*$/, "").trim(); if (!line) continue;
      if (line.startsWith("@@")) { const u = /^@@unique\(\[([^\]]*)\]/.exec(line); if (u) model.uniques.push(u[1].split(",").map((s) => s.trim())); const id = /^@@id\(\[([^\]]*)\]/.exec(line); if (id) model.uniques.push(id[1].split(",").map((s) => s.trim())); continue; }
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line); if (!f) continue;
      const field: Field = { name: f[1], type: f[2], list: !!f[3], optional: !!f[4], id: false, unique: false, hasDefault: false, updatedAt: false, isModel: false, isEnum: !!enums[f[2]] };
      for (const a of attrs(f[5])) {
        if (a.name === "id") { field.id = true; field.unique = true; model.idField = f[1]; }
        else if (a.name === "unique") field.unique = true;
        else if (a.name === "updatedAt") field.updatedAt = true;
        else if (a.name === "default") { field.hasDefault = true; field.def = parseDefault(a.args); }
        else if (a.name === "relation") {
          const fl = /fields:\s*\[([^\]]*)\]/.exec(a.args), rf = /references:\s*\[([^\]]*)\]/.exec(a.args), nm = /^\s*"([^"]+)"/.exec(a.args) || /name:\s*"([^"]+)"/.exec(a.args), od = /onDelete:\s*(\w+)/.exec(a.args);
          field.rel = { name: nm?.[1], fields: fl ? fl[1].split(",").map((s) => s.trim()) : [], references: rf ? rf[1].split(",").map((s) => s.trim()) : [], onDelete: od?.[1] };
        }
      }
      model.fields[f[1]] = field;
    }
    models[m[1]] = model;
  }
  for (const mdl of Object.values(models)) for (const f of Object.values(mdl.fields)) f.isModel = !!models[f.type];
  return { models, enums };
}

const SCHEMA_PATH = process.env.PRISMA_SCHEMA || path.resolve(__dirname, "..", "prisma", "schema.prisma");
export const schema: Schema = parseSchema(fs.readFileSync(SCHEMA_PATH, "utf8"));
let tables: Record<string, any[]> = {}; let joins: Record<string, [string, string][]> = {};
for (const m of Object.keys(schema.models)) tables[m] = [];
let autoSeq: Record<string, number> = {};
export function resetDb() { for (const m of Object.keys(schema.models)) tables[m] = []; joins = {}; autoSeq = {}; }
export function dumpDb() { return structuredClone(tables); }

type Rel = { kind: "belongsTo" | "has" | "m2m"; target: string; fk?: string; ref?: string; list: boolean; join?: string; onDelete?: string };
function relOf(modelName: string, f: Field): Rel {
  const target = f.type;
  if (f.rel && f.rel.fields.length) return { kind: "belongsTo", target, fk: f.rel.fields[0], ref: f.rel.references[0], list: false, onDelete: f.rel.onDelete };
  const tm = schema.models[target];
  for (const tf of Object.values(tm.fields)) {
    if (tf.type !== modelName || !tf.isModel) continue;
    if (f.rel?.name && tf.rel?.name && f.rel.name !== tf.rel.name) continue;
    if (tf.rel && tf.rel.fields.length) return { kind: "has", target, fk: tf.rel.fields[0], ref: tf.rel.references[0], list: f.list, onDelete: tf.rel.onDelete };
  }
  for (const tf of Object.values(tm.fields)) if (tf.type === modelName && tf.list && f.list && f.rel?.name && f.rel.name === tf.rel?.name) return { kind: "m2m", target, list: true, join: f.rel.name };
  throw new Error(`relation ${modelName}.${f.name} could not be resolved`);
}
const joinOrder = (a: string, b: string) => (a < b ? [a, b] : [b, a]);
function m2mIds(modelName: string, rel: Rel, id: any): any[] {
  const [first] = joinOrder(modelName, rel.target); const rows = joins[rel.join!] || [];
  return rows.filter((r) => (first === modelName ? r[0] === id : r[1] === id)).map((r) => (first === modelName ? r[1] : r[0]));
}
function m2mSet(modelName: string, rel: Rel, id: any, others: any[]) {
  const [first] = joinOrder(modelName, rel.target); const rows = (joins[rel.join!] = joins[rel.join!] || []);
  joins[rel.join!] = rows.filter((r) => !(first === modelName ? r[0] === id : r[1] === id));
  for (const o of others) joins[rel.join!].push(first === modelName ? [id, o] : [o, id]);
}
const unknown = (what: string, name: string, model: string) => new ValidationError(`Unknown ${what} \`${name}\` on model \`${model}\``);
const isPlainObj = (v: any) => v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
const norm = (v: any) => (v instanceof Date ? v.getTime() : v);

function matchScalar(val: any, cond: any, f: Field): boolean {
  if (cond === null) return val == null;
  if (!isPlainObj(cond)) return norm(val) === norm(cond);
  for (const [op, c] of Object.entries<any>(cond)) {
    switch (op) {
      case "equals": if (norm(val) !== norm(c)) return false; break;
      case "not": if (isPlainObj(c) ? matchScalar(val, c, f) : (c === null ? val == null : norm(val) === norm(c))) return false; break;
      case "in": if (!c.some((x: any) => norm(x) === norm(val))) return false; break;
      case "notIn": if (c.some((x: any) => norm(x) === norm(val))) return false; break;
      case "gt": if (val == null || !(norm(val) > norm(c))) return false; break;
      case "gte": if (val == null || !(norm(val) >= norm(c))) return false; break;
      case "lt": if (val == null || !(norm(val) < norm(c))) return false; break;
      case "lte": if (val == null || !(norm(val) <= norm(c))) return false; break;
      case "contains": if (typeof val !== "string" || !(cond.mode === "insensitive" ? val.toLowerCase().includes(String(c).toLowerCase()) : val.includes(c))) return false; break;
      case "startsWith": if (typeof val !== "string" || !val.startsWith(c)) return false; break;
      case "endsWith": if (typeof val !== "string" || !val.endsWith(c)) return false; break;
      case "mode": break;
      case "path": { if (f.type !== "Json") throw new ValidationError("path filter on non-Json"); let cur = val; for (const p of c) cur = cur?.[p]; if (cond.equals !== undefined && cur !== cond.equals) return false; break; }
      default: throw new ValidationError(`Unknown filter operator \`${op}\``);
    }
  }
  return true;
}
function relatedRows(modelName: string, f: Field, row: any): any[] {
  const rel = relOf(modelName, f);
  if (rel.kind === "belongsTo") return row[rel.fk!] == null ? [] : tables[rel.target].filter((r) => r[rel.ref!] === row[rel.fk!]);
  if (rel.kind === "has") return tables[rel.target].filter((r) => r[rel.fk!] === row[rel.ref!]);
  const ids = m2mIds(modelName, rel, row[schema.models[modelName].idField]); return tables[rel.target].filter((r) => ids.includes(r[schema.models[rel.target].idField]));
}
function matchWhere(modelName: string, row: any, where: any): boolean {
  if (!where) return true; const model = schema.models[modelName];
  for (const [k, v] of Object.entries<any>(where)) {
    if (v === undefined) continue;
    if (k === "AND") { if (!(Array.isArray(v) ? v : [v]).every((w) => matchWhere(modelName, row, w))) return false; continue; }
    if (k === "OR") { if (!v.some((w: any) => matchWhere(modelName, row, w))) return false; continue; }
    if (k === "NOT") { if ((Array.isArray(v) ? v : [v]).some((w) => matchWhere(modelName, row, w))) return false; continue; }
    const compound = model.uniques.find((u) => u.join("_") === k);
    if (compound) { for (const c of compound) if (norm(row[c]) !== norm(v[c])) return false; continue; }
    const f = model.fields[k]; if (!f) throw unknown("argument", k, modelName);
    if (f.isModel) {
      const rel = relOf(modelName, f); const rs = relatedRows(modelName, f, row);
      if (rel.list) {
        if (v.some !== undefined) { if (!rs.some((r) => matchWhere(rel.target, r, v.some))) return false; }
        if (v.every !== undefined) { if (!rs.every((r) => matchWhere(rel.target, r, v.every))) return false; }
        if (v.none !== undefined) { if (rs.some((r) => matchWhere(rel.target, r, v.none))) return false; }
      } else {
        if (v === null) { if (rs.length) return false; continue; }
        if (v.isNot !== undefined) { if (rs.length && matchWhere(rel.target, rs[0], v.isNot)) return false; continue; }
        const w = v.is !== undefined ? v.is : v;
        if (w === null) { if (rs.length) return false; } else if (!rs.length || !matchWhere(rel.target, rs[0], w)) return false;
      }
      continue;
    }
    if (!matchScalar(row[k], v, f)) return false;
  }
  return true;
}

function cmp(a: any, b: any, dir: string): number {
  const an = a == null, bn = b == null; if (an && bn) return 0;
  if (an) return dir === "asc" ? 1 : -1; if (bn) return dir === "asc" ? -1 : 1;
  const x = norm(a), y = norm(b); const r = x < y ? -1 : x > y ? 1 : 0; return dir === "asc" ? r : -r;
}
function orderRows(modelName: string, rows: any[], orderBy: any): any[] {
  if (!orderBy) return rows; const list = Array.isArray(orderBy) ? orderBy : [orderBy]; const model = schema.models[modelName];
  const keyOf = (row: any, spec: any): { v: any; dir: string } => {
    const [k, d] = Object.entries<any>(spec)[0]; const f = model.fields[k]; if (!f) throw unknown("orderBy field", k, modelName);
    if (f.isModel) { const rs = relatedRows(modelName, f, row); if (isPlainObj(d) && d._count) return { v: rs.length, dir: d._count }; const [ik, id] = Object.entries<any>(d)[0]; return { v: rs[0]?.[ik], dir: id }; }
    return { v: row[k], dir: d };
  };
  return [...rows].sort((a, b) => { for (const spec of list) { const ka = keyOf(a, spec), kb = keyOf(b, spec); const c = cmp(ka.v, kb.v, ka.dir); if (c) return c; } return 0; });
}
function shape(modelName: string, row: any, args: any): any {
  if (!row) return row; const model = schema.models[modelName]; const out: any = {};
  const sel = args?.select, inc = args?.include;
  if (sel && inc) throw new ValidationError("Please either use `include` or `select`, but not both at the same time.");
  const loadRel = (f: Field, spec: any) => {
    const rel = relOf(modelName, f); let rs = relatedRows(modelName, f, row);
    const opts = spec === true ? {} : spec;
    if (opts.where) rs = rs.filter((r) => matchWhere(rel.target, r, opts.where));
    rs = orderRows(rel.target, rs, opts.orderBy);
    if (opts.skip) rs = rs.slice(opts.skip); if (opts.take != null) rs = rs.slice(0, opts.take);
    const shaped = rs.map((r) => shape(rel.target, r, opts));
    return rel.list ? shaped : shaped[0] ?? null;
  };
  const countOf = (spec: any) => { const c: any = {}; for (const k of Object.keys(spec.select || {})) { const f = model.fields[k]; if (!f?.isModel) throw unknown("relation in _count", k, modelName); c[k] = relatedRows(modelName, f, row).length; } return c; };
  if (sel) {
    for (const [k, v] of Object.entries<any>(sel)) {
      if (!v) continue; if (k === "_count") { out._count = countOf(v === true ? { select: {} } : v); continue; }
      const f = model.fields[k]; if (!f) throw unknown("field in select", k, modelName);
      out[k] = f.isModel ? loadRel(f, v) : structuredClone(row[k]);
    }
  } else {
    for (const f of Object.values(model.fields)) if (!f.isModel) out[f.name] = structuredClone(row[f.name]);
    if (inc) for (const [k, v] of Object.entries<any>(inc)) {
      if (!v) continue; if (k === "_count") { out._count = countOf(v === true ? { select: {} } : v); continue; }
      const f = model.fields[k]; if (!f || !f.isModel) throw unknown("relation in include", k, modelName);
      out[k] = loadRel(f, v);
    }
  }
  return out;
}

function coerceScalar(model: Model, f: Field, v: any): any {
  if (f.list) { if (!Array.isArray(v)) throw new ValidationError(`Invalid value for argument \`${f.name}\` on ${model.name}: expected a list`); return v.map((x) => coerceScalar(model, { ...f, list: false, optional: false }, x)); }
  if (v === null) { if (!f.optional) throw new ValidationError(`Argument \`${f.name}\` on ${model.name} must not be null`); return null; }
  const bad = (t: string) => new ValidationError(`Invalid value for argument \`${f.name}\` on ${model.name}: expected ${t}, got ${JSON.stringify(v)}`);
  switch (f.type) {
    case "String": if (typeof v !== "string") throw bad("String"); return v;
    case "Int": if (!Number.isInteger(v)) throw bad("Int"); return v;
    case "Boolean": if (typeof v !== "boolean") throw bad("Boolean"); return v;
    case "DateTime": { const d = v instanceof Date ? v : new Date(v); if (isNaN(+d)) throw bad("DateTime"); return d; }
    case "Json": return structuredClone(v);
    default: if (f.isEnum) { if (!schema.enums[f.type].includes(v)) throw bad(`one of ${schema.enums[f.type].join("|")}`); return v; } return v;
  }
}
function uniqueViolation(modelName: string, row: any, ignoreIdx = -1): any {
  const model = schema.models[modelName];
  const keys: string[][] = [...Object.values(model.fields).filter((f) => f.unique).map((f) => [f.name]), ...model.uniques];
  for (const k of keys) {
    if (k.some((c) => row[c] == null)) continue;
    if (tables[modelName].some((r, i) => i !== ignoreIdx && k.every((c) => norm(r[c]) === norm(row[c])))) return new PrismaError(`Unique constraint failed on the fields: (${k.join(",")})`, "P2002", { target: k });
  }
  return null;
}
function checkFks(modelName: string, row: any) {
  const model = schema.models[modelName];
  for (const f of Object.values(model.fields)) {
    if (!f.isModel || !f.rel?.fields.length) continue; const fk = f.rel.fields[0], ref = f.rel.references[0];
    if (row[fk] == null) continue;
    if (!tables[f.type].some((r) => r[ref] === row[fk])) throw new PrismaError(`Foreign key constraint failed on the field: \`${fk}\``, "P2003", { field_name: fk });
  }
}
function applyNested(modelName: string, row: any, k: string, v: any) {
  const model = schema.models[modelName]; const f = model.fields[k]; const rel = relOf(modelName, f);
  const ops = isPlainObj(v) ? v : {};
  const toArr = (x: any) => (x == null ? [] : Array.isArray(x) ? x : [x]);
  if (rel.kind === "belongsTo") {
    if (ops.connect) { const t = tables[rel.target].find((r) => matchWhere(rel.target, r, ops.connect)); if (!t) throw new PrismaError("An operation failed because it depends on one or more records that were required but not found.", "P2025"); row[rel.fk!] = t[rel.ref!]; }
    else if (ops.create) { const c = createRow(rel.target, ops.create); row[rel.fk!] = c[rel.ref!]; }
    else if (ops.disconnect) row[rel.fk!] = null;
    else throw new ValidationError(`Unsupported nested operation on ${modelName}.${k}`);
    return;
  }
  if (rel.kind === "has") {
    for (const c of toArr(ops.create)) createRow(rel.target, { ...c, [rel.fk!]: row[rel.ref!] });
    for (const c of toArr(ops.createMany?.data)) createRow(rel.target, { ...c, [rel.fk!]: row[rel.ref!] });
    for (const w of toArr(ops.connect)) { const t = tables[rel.target].find((r) => matchWhere(rel.target, r, w)); if (!t) throw new PrismaError("connect: record not found", "P2025"); t[rel.fk!] = row[rel.ref!]; }
    if (ops.deleteMany !== undefined) tables[rel.target] = tables[rel.target].filter((r) => !(r[rel.fk!] === row[rel.ref!] && matchWhere(rel.target, r, ops.deleteMany)));
    return;
  }
  const id = row[model.idField]; const cur = m2mIds(modelName, rel, id);
  const ids = (xs: any) => toArr(xs).map((w: any) => { const t = tables[rel.target].find((r) => matchWhere(rel.target, r, w)); if (!t) throw new PrismaError("connect: record not found", "P2025"); return t[schema.models[rel.target].idField]; });
  if (ops.set) m2mSet(modelName, rel, id, ids(ops.set));
  if (ops.connect) m2mSet(modelName, rel, id, [...new Set([...cur, ...ids(ops.connect)])]);
  if (ops.disconnect) { const rm = ids(ops.disconnect); m2mSet(modelName, rel, id, cur.filter((x) => !rm.includes(x))); }
}
function createRow(modelName: string, data: any): any {
  const model = schema.models[modelName]; const row: any = {}; const nested: [string, any][] = [];
  for (const [k, v] of Object.entries<any>(data)) {
    if (v === undefined) continue; const f = model.fields[k]; if (!f) throw unknown("argument", k, modelName);
    if (f.isModel) nested.push([k, v]); else row[k] = coerceScalar(model, f, v);
  }
  for (const [k, v] of nested) { const rel = relOf(modelName, model.fields[k]); if (rel.kind === "belongsTo") applyNested(modelName, row, k, v); }
  for (const f of Object.values(model.fields)) {
    if (f.isModel) continue;
    if (row[f.name] === undefined) {
      if (f.hasDefault) { const d = f.def; row[f.name] = d === "__auto__" ? (autoSeq[modelName] = (autoSeq[modelName] || 0) + 1) : typeof d === "function" ? d() : structuredClone(d); if (f.type === "Json" && typeof row[f.name] === "string") { try { row[f.name] = JSON.parse(row[f.name]); } catch { /* keep */ } } }
      else if (f.updatedAt) row[f.name] = new Date();
      else if (f.list) row[f.name] = [];
      else if (f.optional) row[f.name] = null;
      else throw new ValidationError(`Argument \`${f.name}\` is missing on ${modelName}.create`);
    }
  }
  checkFks(modelName, row);
  const u = uniqueViolation(modelName, row); if (u) throw u;
  tables[modelName].push(row);
  for (const [k, v] of nested) { const rel = relOf(modelName, model.fields[k]); if (rel.kind !== "belongsTo") applyNested(modelName, row, k, v); }
  return row;
}
function applyUpdate(modelName: string, row: any, data: any) {
  const model = schema.models[modelName]; const idx = tables[modelName].indexOf(row); const draft = { ...row }; const nested: [string, any][] = [];
  for (const [k, v] of Object.entries<any>(data)) {
    if (v === undefined) continue; const f = model.fields[k]; if (!f) throw unknown("argument", k, modelName);
    if (f.isModel) { nested.push([k, v]); continue; }
    if (isPlainObj(v) && f.type !== "Json" && ("increment" in v || "decrement" in v || "set" in v || "multiply" in v)) {
      if ("set" in v) draft[k] = coerceScalar(model, f, v.set);
      if ("increment" in v) draft[k] = (draft[k] ?? 0) + v.increment; if ("decrement" in v) draft[k] = (draft[k] ?? 0) - v.decrement; if ("multiply" in v) draft[k] = (draft[k] ?? 0) * v.multiply;
    } else draft[k] = coerceScalar(model, f, v);
  }
  for (const f of Object.values(model.fields)) if (f.updatedAt) draft[f.name] = new Date();
  for (const [k, v] of nested) applyNested(modelName, draft, k, v);
  checkFks(modelName, draft); const u = uniqueViolation(modelName, draft, idx); if (u) throw u;
  Object.assign(row, draft);
}
function removeRow(modelName: string, row: any) {
  const model = schema.models[modelName];
  for (const [other, om] of Object.entries(schema.models)) for (const f of Object.values(om.fields)) {
    if (!f.isModel || f.type !== modelName || !f.rel?.fields.length) continue; const fk = f.rel.fields[0], ref = f.rel.references[0];
    const kids = tables[other].filter((r) => r[fk] === row[ref]);
    if (!kids.length) continue;
    if (f.rel.onDelete === "Cascade") for (const k of kids) removeRow(other, k);
    else if (f.rel.onDelete === "SetNull") kids.forEach((k) => (k[fk] = null));
    else throw new PrismaError(`Foreign key constraint failed: ${other}.${fk}`, "P2003", { field_name: fk });
  }
  tables[modelName] = tables[modelName].filter((r) => r !== row);
  for (const f of Object.values(model.fields)) if (f.isModel && f.list) { try { const rel = relOf(modelName, f); if (rel.kind === "m2m") m2mSet(modelName, rel, row[model.idField], []); } catch { /* ignore */ } }
}
function assertUniqueWhere(modelName: string, where: any) {
  const model = schema.models[modelName]; if (!where || !Object.keys(where).length) throw new ValidationError(`Argument \`where\` is required on ${modelName}`);
  const ok = Object.keys(where).some((k) => model.fields[k]?.unique || model.uniques.some((u) => u.join("_") === k));
  if (!ok) throw new ValidationError(`Argument \`where\` of ${modelName} needs at least one unique field (${Object.values(model.fields).filter((f) => f.unique).map((f) => f.name).concat(model.uniques.map((u) => u.join("_"))).join(", ")})`);
}
function aggregateRows(modelName: string, rows: any[], args: any) {
  const out: any = {}; const nums = (field: string) => rows.map((r) => r[field]).filter((x) => x != null);
  for (const [fn, spec] of Object.entries<any>(args)) {
    if (!fn.startsWith("_")) continue; out[fn] = {};
    for (const field of Object.keys(spec)) {
      if (fn === "_count") { out._count[field] = field === "_all" ? rows.length : nums(field).length; continue; }
      if (!schema.models[modelName].fields[field]) throw unknown("field in aggregate", field, modelName);
      const v = nums(field); if (fn === "_sum") out._sum[field] = v.length ? v.reduce((a: number, b: number) => a + b, 0) : null;
      else if (fn === "_avg") out._avg[field] = v.length ? v.reduce((a: number, b: number) => a + b, 0) / v.length : null;
      else if (fn === "_min") out._min[field] = v.length ? v.reduce((a: any, b: any) => (norm(b) < norm(a) ? b : a)) : null;
      else if (fn === "_max") out._max[field] = v.length ? v.reduce((a: any, b: any) => (norm(b) > norm(a) ? b : a)) : null;
    }
  }
  return out;
}

function delegate(modelName: string) {
  const find = (where: any) => tables[modelName].filter((r) => matchWhere(modelName, r, where));
  return {
    async findMany(a: any = {}) { let rs = orderRows(modelName, find(a.where), a.orderBy); if (a.skip) rs = rs.slice(a.skip); if (a.take != null) rs = rs.slice(0, a.take); return rs.map((r) => shape(modelName, r, a)); },
    async findFirst(a: any = {}) { const rs = orderRows(modelName, find(a.where), a.orderBy); return rs[0] ? shape(modelName, rs[0], a) : null; },
    async findUnique(a: any) { assertUniqueWhere(modelName, a.where); const r = find(a.where)[0]; return r ? shape(modelName, r, a) : null; },
    async findUniqueOrThrow(a: any) { assertUniqueWhere(modelName, a.where); const r = find(a.where)[0]; if (!r) throw new PrismaError("No record found", "P2025"); return shape(modelName, r, a); },
    async create(a: any) { return shape(modelName, createRow(modelName, a.data), a); },
    async createMany(a: any) { for (const d of a.data) createRow(modelName, d); return { count: a.data.length }; },
    async update(a: any) { assertUniqueWhere(modelName, a.where); const r = find(a.where)[0]; if (!r) throw new PrismaError("Record to update not found.", "P2025"); applyUpdate(modelName, r, a.data); return shape(modelName, r, a); },
    async updateMany(a: any) { const rs = find(a.where); for (const r of rs) applyUpdate(modelName, r, a.data); return { count: rs.length }; },
    async upsert(a: any) { assertUniqueWhere(modelName, a.where); const r = find(a.where)[0]; if (r) { applyUpdate(modelName, r, a.update); return shape(modelName, r, a); } return shape(modelName, createRow(modelName, a.create), a); },
    async delete(a: any) { assertUniqueWhere(modelName, a.where); const r = find(a.where)[0]; if (!r) throw new PrismaError("Record to delete does not exist.", "P2025"); const out = shape(modelName, r, a); removeRow(modelName, r); return out; },
    async deleteMany(a: any = {}) { const rs = find(a.where); for (const r of rs) if (tables[modelName].includes(r)) removeRow(modelName, r); return { count: rs.length }; },
    async count(a: any = {}) { return find(a.where).length; },
    async aggregate(a: any = {}) { return aggregateRows(modelName, find(a.where), a); },
    async groupBy(a: any) {
      const rs = find(a.where); const by: string[] = Array.isArray(a.by) ? a.by : [a.by]; const groups = new Map<string, any[]>();
      for (const r of rs) { const k = JSON.stringify(by.map((b) => norm(r[b]))); (groups.get(k) || groups.set(k, []).get(k)!).push(r); }
      let out = [...groups.values()].map((g) => ({ ...Object.fromEntries(by.map((b) => [b, g[0][b]])), ...aggregateRows(modelName, g, a) }));
      if (a.orderBy) { const specs = Array.isArray(a.orderBy) ? a.orderBy : [a.orderBy]; out.sort((x: any, y: any) => { for (const sp of specs) { const [k, d] = Object.entries<any>(sp)[0]; const get = (o: any) => (isPlainObj(d) ? o[k]?.[Object.keys(d)[0]] : o[k]); const dir = isPlainObj(d) ? Object.values<any>(d)[0] : d; const c = cmp(get(x), get(y), dir); if (c) return c; } return 0; }); }
      if (a.take != null) out = out.slice(0, a.take); return out;
    },
  };
}
export class PrismaClient {
  [k: string]: any;
  constructor(_opts?: any) { for (const m of Object.values(schema.models)) this[m.delegate] = delegate(m.name); }
  async $connect() { /* noop */ }
  async $disconnect() { /* noop */ }
  async $queryRaw(strings: TemplateStringsArray | string, ..._vals: any[]) {
    const sql = (Array.isArray(strings) ? strings.join("?") : String(strings)).replace(/\s+/g, " ");
    if (/^\s*SELECT 1\b/i.test(sql)) return [{ "?column?": 1 }];
    if (/FOR UPDATE/i.test(sql)) return [];      // row locks: transactions are serialised by the mutex below
    throw new Error("fake-prisma: unsupported raw query: " + sql.slice(0, 80));
  }
  async $transaction(arg: any, _opts?: any) {
    if (Array.isArray(arg)) return Promise.all(arg);
    const release = await acquire(); const snapshot = structuredClone({ tables, joins, autoSeq });
    try { return await arg(this); } catch (e) { tables = snapshot.tables; joins = snapshot.joins; autoSeq = snapshot.autoSeq; throw e; } finally { release(); }
  }
}
let chain: Promise<void> = Promise.resolve();
function acquire(): Promise<() => void> { let release!: () => void; const next = new Promise<void>((r) => (release = r)); const prev = chain; chain = chain.then(() => next); return prev.then(() => release); }
export const Prisma = { PrismaClientKnownRequestError: PrismaError, PrismaClientValidationError: ValidationError };
