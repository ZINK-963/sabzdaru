import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { restockOrder } from "@/lib/inventory";
import { logAudit } from "@/lib/audit";
import { handle, HttpError, json, readJson } from "@/lib/http";

/**
 * سفارش‌های پرداخت‌نشده موجودی را نگه می‌دارند (ثبت سفارش موجودی را همان لحظه کم می‌کند). بدون این job،
 * مشتری‌ای که صفحهٔ بانک را می‌بندد کالا را برای همیشه «قفل» می‌کند. هر ۵ دقیقه صدایش بزنید:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/internal/cron/expire-orders
 */
export const POST = handle(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET ?? "";
  const given = Buffer.from(req.headers.get("x-cron-secret") ?? "");
  const want = Buffer.from(secret);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) throw new HttpError(401, "unauthorized");

  const body = await readJson(req).catch(() => ({}));
  const mins = body && body.olderThanMinutes !== undefined ? Math.max(0, Number(body.olderThanMinutes) || 0) : 30;
  const stale = await prisma.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lte: new Date(Date.now() - mins * 60000) } }, select: { id: true } });

  let expired = 0;
  for (const { id } of stale) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
      if (claimed.count === 0) return;     // هم‌زمان پرداخت شد
      await tx.orderEvent.create({ data: { orderId: id, from: "PENDING_PAYMENT", to: "CANCELLED", actorType: "system" } });
      await restockOrder(tx, id, "expired");
      expired++;
    });
  }
  if (expired) await logAudit({ actorId: null, actorRole: "system", action: "order.expire", entity: "Order", entityId: "*", before: null, after: { count: expired } });
  return json({ expired });
});
