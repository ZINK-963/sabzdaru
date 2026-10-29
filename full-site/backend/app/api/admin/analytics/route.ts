import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { stockMap } from "@/lib/pricing";
import { PAID_STATUSES } from "@/lib/shape";
import { handle, json, requirePermission } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: NextRequest) => {
  await requirePermission("analytics.read");
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 86400000);
  const paid = { status: { in: [...PAID_STATUSES] as any }, createdAt: { gte: since } };

  const [revenueAgg, orderCount, newCustomers, returningCustomers, bestSellers, variants, expiringSoon] = await Promise.all([
    prisma.order.aggregate({ where: paid, _sum: { total: true } }),
    prisma.order.count({ where: paid }),
    prisma.user.count({ where: { createdAt: { gte: since }, roleId: null, deletedAt: null } }),
    prisma.user.count({ where: { orders: { some: {} }, createdAt: { lt: since }, roleId: null, deletedAt: null } }),
    // فقط سفارش‌های واقعاً پرداخت‌شده؛ قبلاً آیتم‌های سفارش‌های ناموفق/لغوشده هم در «پرفروش‌ترین‌ها» شمرده می‌شدند
    prisma.orderItem.groupBy({ by: ["sku", "productName"], where: { order: { status: { in: [...PAID_STATUSES] as any } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 }),
    prisma.productVariant.findMany({ where: { product: { published: true } }, include: { product: { select: { name: true } } } }),
    prisma.batch.findMany({
      where: { recalledAt: null, quantity: { gt: 0 }, expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } },
      include: { variant: { include: { product: true } } }, orderBy: { expiresAt: "asc" }, take: 10,
    }),
  ]);
  // موجودی کم: با API کوئری (نه SQL خام — جمع SQL در Postgres «BigInt» برمی‌گرداند و JSON آن را نمی‌تواند سریال کند)
  const stocks = await stockMap(prisma, variants.map((v: any) => v.id));
  const lowStock = variants.map((v: any) => ({ id: v.id, sku: v.sku, name: v.product.name, stock: Math.max(0, stocks[v.id] ?? 0) })).filter((v: any) => v.stock < 5).sort((a: any, b: any) => a.stock - b.stock).slice(0, 10);

  const revenue = revenueAgg._sum.total ?? 0;
  return json({
    rangeDays: days, revenue, orders: orderCount, avgOrderValue: orderCount ? Math.round(revenue / orderCount) : 0, newCustomers, returningCustomers,
    bestSellers: bestSellers.map((b: any) => ({ sku: b.sku, name: b.productName, sold: b._sum.quantity ?? 0 })),
    lowStock,
    expiringSoon: expiringSoon.map((b: any) => ({ batchId: b.id, code: b.code, quantity: b.quantity, expiresAt: b.expiresAt, product: b.variant.product.name, sku: b.variant.sku })),
  });
});
