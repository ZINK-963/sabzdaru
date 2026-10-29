import type { TxClient } from "./pricing";

/**
 * موجودی همهٔ اقلام یک سفارش را برمی‌گرداند (لغو، مرجوعی، پرداخت ناموفق، انقضای سفارش پرداخت‌نشده).
 * نکته: ثبت سفارش (checkout/place) موجودی را همان لحظه از batchها کم می‌کند؛ پس هر مسیری
 * که سفارش را «بسته» می‌کند باید همین تابع را صدا بزند وگرنه موجودی برای همیشه گم می‌شود.
 */
export async function restockOrder(tx: TxClient, orderId: string, reason: string, actorId?: string | null) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.variantId) continue;
    const latest = await tx.batch.findFirst({ where: { variantId: item.variantId }, orderBy: { receivedAt: "desc" } });
    if (latest) await tx.batch.update({ where: { id: latest.id }, data: { quantity: { increment: item.quantity } } });
    else await tx.batch.create({ data: { variantId: item.variantId, code: `RTN-${Date.now()}`, quantity: item.quantity } });
    await tx.inventoryMovement.create({ data: { variantId: item.variantId, delta: item.quantity, reason, refId: orderId, actorId: actorId ?? null } });
  }
}
