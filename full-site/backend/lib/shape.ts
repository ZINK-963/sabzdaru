import { prisma } from "./prisma";
import { stockMap, effectiveSale } from "./pricing";

/**
 * تبدیل ردیف‌های دیتابیس به «شکل UI» که فرانت‌اند انتظار دارد (docs/API-CONTRACT.md).
 * فرانت‌اند عمداً هیچ نگاشتی انجام نمی‌دهد: سرور همان شکلی را می‌دهد که صفحات می‌خوانند.
 */
export const PAID_STATUSES = ["PAID", "PROCESSING", "PACKING", "SHIPPED", "DELIVERED"] as const;

export const ST_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال پردازش", PACKING: "آماده‌سازی", SHIPPED: "ارسال شده",
  DELIVERED: "تحویل شده", PAYMENT_FAILED: "پرداخت ناموفق", CANCELLED: "لغو شده", RETURN_REQUESTED: "درخواست مرجوعی",
  RETURNED: "مرجوع شده", DELIVERY_FAILED: "ارسال ناموفق", REFUNDED: "بازپرداخت شده",
};
export const TICKET_LABEL: Record<string, string> = { open: "باز", in_progress: "در حال بررسی", waiting_customer: "در انتظار مشتری", resolved: "حل شده", closed: "بسته شده" };
export const PRIO_LABEL: Record<string, string> = { normal: "عادی", high: "بالا" };
const ACTOR_LABEL: Record<string, string> = { customer: "مشتری", gateway: "درگاه پرداخت", system: "سیستم", admin: "مدیریت" };
export const DEFAULT_PREFS = { order: true, restock: true, promo: true };

export const fmt = (d: Date) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(d);

/** کاتالوگ به شکل UI. where={published:true} برای ویترین، {} برای پنل مدیریت (شامل پیش‌نویس‌ها) */
export async function catalog(where: any = { published: true }) {
  const products = await prisma.product.findMany({
    where,
    include: { category: true, brand: true, variants: { orderBy: { price: "asc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  const sellable = products.filter((p: any) => p.variants[0]);
  const vids = sellable.map((p: any) => p.variants[0].id as string);
  const pids = sellable.map((p: any) => p.id as string);
  const now = new Date();
  const [stocks, batches, sold, ratings] = await Promise.all([
    stockMap(prisma, vids),
    prisma.batch.findMany({
      where: { variantId: { in: vids }, recalledAt: null, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { expiresAt: "asc" }, select: { variantId: true, code: true, expiresAt: true },
    }),
    prisma.orderItem.groupBy({ by: ["variantId"], where: { variantId: { in: vids }, order: { status: { in: [...PAID_STATUSES] } } }, _sum: { quantity: true } }),
    prisma.review.groupBy({ by: ["productId"], where: { productId: { in: pids }, status: "approved" }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const firstBatch: Record<string, { code: string; expiresAt: Date | null }> = {};
  for (const b of batches as any[]) if (!firstBatch[b.variantId]) firstBatch[b.variantId] = { code: b.code, expiresAt: b.expiresAt };
  const soldBy: Record<string, number> = {};
  (sold as any[]).forEach((s) => { if (s.variantId) soldBy[s.variantId] = s._sum.quantity ?? 0; });
  const ratingBy: Record<string, { avg: number; n: number }> = {};
  (ratings as any[]).forEach((r) => (ratingBy[r.productId] = { avg: r._avg.rating ?? 0, n: r._count._all }));

  return sellable.map((p: any) => {
    const v = p.variants[0], rt = ratingBy[p.id], fb = firstBatch[v.id];
    return {
      id: p.id, slug: p.slug, cat: p.category.slug, brand: p.brand.slug, name: p.name,
      variant: v.label, variantId: v.id, price: v.price, sale: effectiveSale(v), stock: Math.max(0, stocks[v.id] ?? 0),
      attrs: p.attributes ?? {}, desc: p.description ?? "", usage: p.usage ?? "", storage: p.storage ?? "", warn: p.warnings ?? "", ingredients: p.ingredients ?? "",
      rating: rt ? Math.round(rt.avg * 10) / 10 : 0, reviews: rt ? rt.n : 0, sold: soldBy[v.id] ?? 0, views: 0,
      expiresAt: fb?.expiresAt ? fb.expiresAt.toISOString() : null, batch: fb?.code ?? "", published: p.published, demo: !!p.isDemo,
    };
  });
}

type OrderRow = any;
/** variantId → productId (OrderItem به ProductVariant relation ندارد، پس جداگانه نگاشت می‌شود) */
export async function productIdsByVariant(variantIds: (string | null)[]): Promise<Record<string, string>> {
  const ids = [...new Set(variantIds.filter(Boolean) as string[])];
  if (!ids.length) return {};
  const rows = await prisma.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, productId: true } });
  const m: Record<string, string> = {};
  rows.forEach((r: any) => (m[r.id] = r.productId));
  return m;
}

export function uiOrder(o: OrderRow, pidBy: Record<string, string>, full: boolean) {
  const pay = (o.payments ?? []).find((p: any) => p.status === "verified");
  const x: any = {
    id: o.number, oid: o.id, status: ST_LABEL[o.status], statusKey: o.status, at: fmt(o.createdAt),
    total: o.total, sub: o.subtotal, disc: o.discount, shipFee: o.shippingFee, ship: o.shippingMethodId,
    items: o.items.map((i: any) => ({ pid: i.variantId ? pidBy[i.variantId] ?? null : null, name: i.productName, variant: i.variantLabel, brand: i.brandName, qty: i.quantity, price: i.unitPrice, was: i.unitPrice + (i.discount ?? 0) })),
    history: [...(o.events ?? [])].sort((a: any, b: any) => +a.createdAt - +b.createdAt).map((e: any) => ({ from: e.from ? ST_LABEL[e.from] : "—", to: ST_LABEL[e.to], by: ACTOR_LABEL[e.actorType] ?? e.actorType, at: fmt(e.createdAt) })),
    txn: pay ? { ref: pay.gatewayRef, at: fmt(pay.createdAt) } : null, trackingCode: o.trackingCode ?? null,
  };
  if (full) { x.customer = o.customerSnapshot; x.address = o.addressSnapshot; }
  return x;
}

export function uiTicket(t: any, ownerName: string, internal: boolean) {
  return {
    id: t.id, subject: t.subject, cat: t.category, priority: PRIO_LABEL[t.priority] ?? t.priority, status: TICKET_LABEL[t.status] ?? t.status, at: fmt(t.createdAt),
    msgs: [...(t.messages ?? [])].sort((a: any, b: any) => +a.createdAt - +b.createdAt)
      .filter((m: any) => internal || !m.internal)
      .map((m: any) => ({ by: m.internal ? "یادداشت داخلی" : m.authorId === t.userId ? ownerName : "پشتیبانی", text: m.body, at: fmt(m.createdAt) })),
  };
}

/** عکس کامل حساب کاربر؛ هر mutation زیر /api/me* همین را برمی‌گرداند و فرانت‌اند slice هایش را جایگزین می‌کند */
export async function snapshot(userId: string) {
  const [u, favs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: true } }, addresses: true, lists: true, routines: true,
        notifications: { orderBy: { createdAt: "desc" }, take: 100 },
        orders: { orderBy: { createdAt: "desc" }, take: 100, include: { items: true, events: true, payments: true } },
        tickets: { orderBy: { createdAt: "desc" }, include: { messages: true } },
      },
    }),
    prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!u) return null;
  const pidBy = await productIdsByVariant(u.orders.flatMap((o: any) => o.items.map((i: any) => i.variantId)));
  return {
    user: {
      id: u.id, name: u.name, phone: u.phone, email: u.email ?? "",
      role: u.role ? { key: u.role.key, name: u.role.name, permissions: u.role.permissions.map((p: any) => p.key) } : null,
    },
    prefs: { ...DEFAULT_PREFS, ...((u.prefs as object) ?? {}) },
    addresses: u.addresses.map((a: any) => ({ id: a.id, prov: a.province, city: a.city, line: a.line, zip: a.postalCode })),
    lists: u.lists.map((l: any) => ({ id: l.id, name: l.name, items: l.items as string[] })),
    routines: u.routines.map((r: any) => ({ id: r.id, name: r.name, steps: r.steps as string[] })),
    favs: favs.map((f: any) => f.productId),
    notifs: u.notifications.map((n: any) => ({ id: n.id, title: n.title, body: n.body, at: fmt(n.createdAt), read: !!n.readAt })),
    orders: u.orders.map((o: any) => uiOrder(o, pidBy, true)),
    tickets: u.tickets.map((t: any) => uiTicket(t, u.name, false)),
  };
}

export const couponUi = (c: any) => ({ id: c.id, code: c.code, type: c.type, value: c.value, min: c.minSubtotal, max: c.maxDiscount, uses: c.usedCount, limit: c.usageLimit, active: c.active });
