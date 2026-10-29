import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "./session";

/** یک خطای قابل‌نمایش به کلاینت: status + پیام فارسی (+ فیلدهای اضافه مثل variantId) */
export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}
export const bad = (msg = "ورودی نامعتبر", details?: unknown) => new HttpError(400, msg, details ? { details } : {});

/** هر route handler را می‌پیچد: HttpError → JSON با status درست، هر خطای دیگر → ۵۰۰ بدون افشای جزئیات */
export function handle<A extends any[]>(fn: (...a: A) => Promise<Response> | Response) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { throw bad("بدنهٔ درخواست JSON معتبر نیست"); }
}

/** با zod اعتبارسنجی می‌کند؛ خطا → ۴۰۰ با جزئیات فیلدها */
export function parse<T = any>(schema: any, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw bad("ورودی نامعتبر", r.error.flatten());
  return r.data as T;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "ورود لازم است");
  return u;
}
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** علاوه بر middleware، خود route هم مجوز را چک می‌کند (اگر middleware اشتباه تنظیم شد، API باز نمی‌ماند) */
export async function requirePermission(key: string) {
  const u = await requireUser();
  if (!hasPermission(u, key)) throw new HttpError(403, "دسترسی کافی ندارید");
  return u;
}
export const actorOf = (u: { id: string; role?: { key: string } | null }) => ({ actorId: u.id, actorRole: u.role?.key ?? null });
