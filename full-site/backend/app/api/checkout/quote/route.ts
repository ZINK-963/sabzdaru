import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { computeQuote } from "@/lib/pricing";
import { handle, json, parse, readJson } from "@/lib/http";

const schema = z.object({
  lines: z.array(z.object({ variantId: z.string(), quantity: z.number().int().positive().max(20) })).min(1).max(50),
  couponCode: z.string().trim().max(30).optional(),
  shippingMethodId: z.string().optional(),
});

/** قیمت‌گذاری سبد توسط سرور. مشکلات (ناموجود، کوپن نامعتبر) گزارش می‌شوند و پرتاب نمی‌شوند تا UI بتواند نشانشان بدهد. */
export const POST = handle(async (req: NextRequest) => {
  const body = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const user = await getCurrentUser();
  const q = await computeQuote(prisma, body.lines, { couponCode: body.couponCode, userId: user?.id, shippingMethodId: body.shippingMethodId });
  return json(q);
});
