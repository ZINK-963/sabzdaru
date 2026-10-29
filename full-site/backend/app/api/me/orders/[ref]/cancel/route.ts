import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { restockOrder } from "@/lib/inventory";
import { notifyUser } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { snapshot } from "@/lib/shape";
import { HttpError, handle, json, requireUser } from "@/lib/http";

/** مشتری تا قبل از ارسال می‌تواند سفارش خودش را لغو کند (ref = شمارهٔ SD-… یا شناسه). موجودی برمی‌گردد. */
export const POST = handle(async (_req: NextRequest, { params }: { params: { ref: string } }) => {
  const user = await requireUser();
  const order = await prisma.order.findFirst({ where: { userId: user.id, OR: [{ id: params.ref }, { number: params.ref }] } });
  if (!order) throw new HttpError(404, "سفارش پیدا نشد");
  const from = order.status;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({ where: { id: order.id, status: { in: ["PAID", "PROCESSING", "PACKING"] } }, data: { status: "CANCELLED" } });
    if (claimed.count === 0) throw new HttpError(409, "این سفارش دیگر قابل لغو نیست");
    await tx.orderEvent.create({ data: { orderId: order.id, from, to: "CANCELLED", actorType: "customer", actorId: user.id } });
    await restockOrder(tx, order.id, "return", user.id);
    await notifyUser(tx, user.id, `سفارش ${order.number} لغو شد`, "بازپرداخت مبلغ توسط پشتیبانی انجام و اطلاع‌رسانی می‌شود.");
  });
  await logAudit({ actorId: user.id, actorRole: null, action: "order.cancel", entity: "Order", entityId: order.id, before: { status: from }, after: { status: "CANCELLED" } });
  return json(await snapshot(user.id));
});
