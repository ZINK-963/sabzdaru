import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { restockOrder } from "@/lib/inventory";
import { ALLOWED_TRANSITIONS, RESTOCK_ON } from "@/lib/order-transitions";
import { notifyUser } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { ST_LABEL, productIdsByVariant, uiOrder } from "@/lib/shape";
import { actorOf, bad, handle, HttpError, json, parse, readJson, requirePermission } from "@/lib/http";

const schema = z.object({ status: z.enum(Object.keys(ST_LABEL) as [string, ...string[]]) });
const lookup = (ref: string) => ({ OR: [{ id: ref }, { number: ref }] });

export const GET = handle(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requirePermission("orders.write");
  const o = await prisma.order.findFirst({ where: lookup(params.id), include: { items: true, events: true, payments: true } });
  if (!o) throw new HttpError(404, "سفارش پیدا نشد");
  return json(uiOrder(o, await productIdsByVariant(o.items.map((i: any) => i.variantId)), true));
});

export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const u = await requirePermission("orders.write");
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw bad("وضعیت نامعتبر است");
  const next = parsed.data.status;

  const order = await prisma.order.findFirst({ where: lookup(params.id) });
  if (!order) throw new HttpError(404, "سفارش پیدا نشد");
  if (!(ALLOWED_TRANSITIONS[order.status] ?? []).includes(next)) throw new HttpError(409, `انتقال از «${order.status}» به «${next}» مجاز نیست`);

  await prisma.$transaction(async (tx) => {
    // شرط status در where: اگر هم‌زمان کس دیگری وضعیت را عوض کرده باشد، این تغییر اعمال نمی‌شود (نه دوبار restock)
    const claimed = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: next as any } });
    if (claimed.count === 0) throw new HttpError(409, "وضعیت سفارش هم‌زمان تغییر کرد؛ صفحه را تازه کنید");
    await tx.orderEvent.create({ data: { orderId: order.id, from: order.status, to: next, actorType: "admin", actorId: u.id } });
    if (RESTOCK_ON.has(next)) await restockOrder(tx, order.id, "return", u.id);
    await notifyUser(tx, order.userId, `وضعیت سفارش ${order.number}`, `وضعیت به «${ST_LABEL[next]}» تغییر کرد.`);
  });
  await logAudit({ ...actorOf(u), action: "order.status_change", entity: "Order", entityId: order.id, before: { status: order.status }, after: { status: next } });
  return json({ ok: true, status: next });
});
