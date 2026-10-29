import { NextRequest, NextResponse } from "next/server";

// نگاشت مسیر → مجوز لازم. هر مسیر تازهٔ /api/admin باید اینجا اضافه شود،
// وگرنه پیش‌فرض ایمن اعمال می‌شود: بدون ورودی در این نگاشت = دسترسی رد می‌شود.
const ROUTE_PERMISSIONS: { test: RegExp; permission: string }[] = [
  { test: /^\/api\/admin\/products/, permission: "products.write" },
  { test: /^\/api\/admin\/inventory/, permission: "inventory.write" },
  { test: /^\/api\/admin\/orders/, permission: "orders.write" },
  { test: /^\/api\/admin\/customers/, permission: "customers.read" },
  { test: /^\/api\/admin\/promos/, permission: "promos.write" },
  { test: /^\/api\/admin\/reviews/, permission: "reviews.moderate" },
  { test: /^\/api\/admin\/tickets/, permission: "tickets.write" },
  { test: /^\/api\/admin\/content/, permission: "content.write" },
  { test: /^\/api\/admin\/analytics/, permission: "analytics.read" },
  { test: /^\/api\/admin\/audit/, permission: "audit.read" },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/admin")) return NextResponse.next();

  const sid = req.cookies.get("sd_session")?.value;
  if (!sid) return NextResponse.json({ error: "ورود لازم است" }, { status: 401 });

  // میان‌افزار Edge Runtime است و نمی‌تواند مستقیم Prisma/Redis صدا بزند؛
  // یک endpoint داخلی سبک نشست را از Redis می‌خواند و نقش را برمی‌گرداند.
  const check = await fetch(new URL("/api/internal/whoami", req.url), {
    headers: { cookie: `sd_session=${sid}` },
  });
  if (check.status === 401) return NextResponse.json({ error: "نشست نامعتبر است" }, { status: 401 });
  if (check.status === 403) return NextResponse.json({ error: "دسترسی کافی ندارید" }, { status: 403 });   // وارد شده ولی بدون نقش مدیریتی
  if (!check.ok) return NextResponse.json({ error: "بررسی دسترسی ممکن نشد" }, { status: 502 });
  const { permissions } = (await check.json()) as { permissions: string[] };

  const rule = ROUTE_PERMISSIONS.find((r) => r.test.test(pathname));
  const required = rule?.permission ?? "__no_route_matched__"; // پیش‌فرض ایمن
  const allowed = permissions.includes("*") || permissions.includes(required);
  if (!allowed) return NextResponse.json({ error: "دسترسی کافی ندارید" }, { status: 403 });

  return NextResponse.next();
}

export const config = { matcher: ["/api/admin/:path*"] };
