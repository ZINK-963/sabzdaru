import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PAID_STATUSES } from "@/lib/shape";
import { HttpError, handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({ productId: z.string(), rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(2000) });

/** نظر جدید: فقط کاربر واردشده؛ همیشه «در انتظار بازبینی» می‌ماند تا مدیر تأیید کند (§32) */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const body = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const product = await prisma.product.findFirst({ where: { id: body.productId, published: true }, include: { variants: { select: { id: true } } } });
  if (!product) throw new HttpError(404, "کالا پیدا نشد");
  if (await prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId: user.id } } })) throw new HttpError(409, "قبلاً برای این کالا نظر ثبت کرده‌اید");

  // «خریدار تأییدشده»: همین کاربر این کالا را در یک سفارش پرداخت‌شده (و لغو‌نشده) داشته باشد
  const bought = await prisma.orderItem.findFirst({ where: { variantId: { in: product.variants.map((v: any) => v.id) }, order: { userId: user.id, status: { in: [...PAID_STATUSES] } } } });
  await prisma.review.create({ data: { productId: product.id, userId: user.id, rating: body.rating, body: body.body, verified: !!bought, status: "pending" } });
  return json({ ok: true, pending: true });
});
