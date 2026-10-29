import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { productIdsByVariant, uiOrder } from "@/lib/shape";
import { handle, HttpError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * وضعیت سفارش با شناسهٔ غیرقابل‌حدس (cuid) — برای صفحهٔ بازگشت از درگاه، حتی برای مشتری مهمان.
 * عمداً اسم/نشانی/تلفن مشتری را برنمی‌گرداند. (شمارهٔ SD-… قابل حدس است و اینجا قبول نمی‌شود.)
 */
export const GET = handle(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const o = await prisma.order.findUnique({ where: { id: params.id }, include: { items: true, events: true, payments: true } });
  if (!o) throw new HttpError(404, "سفارش پیدا نشد");
  return json(uiOrder(o, await productIdsByVariant(o.items.map((i: any) => i.variantId)), false));
});
