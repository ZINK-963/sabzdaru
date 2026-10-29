import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { couponUi } from "@/lib/shape";
import { actorOf, handle, HttpError, json, parse, readJson, requirePermission } from "@/lib/http";

const schema = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "فقط حروف انگلیسی، عدد، خط تیره یا زیرخط"),
  type: z.enum(["percent", "fixed"]), value: z.number().int().positive(),
  maxDiscount: z.number().int().positive().optional(), minSubtotal: z.number().int().min(0).default(0),
  categoryIds: z.array(z.string()).default([]), productIds: z.array(z.string()).default([]),
  startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(), perUserLimit: z.number().int().positive().optional(),
}).refine((d) => d.type !== "percent" || d.value <= 100, { message: "درصد تخفیف نمی‌تواند بیش از ۱۰۰ باشد", path: ["value"] });

export const GET = handle(async () => {
  await requirePermission("promos.write");
  return json((await prisma.coupon.findMany({ orderBy: { code: "asc" } })).map(couponUi));
});

export const POST = handle(async (req: NextRequest) => {
  const u = await requirePermission("promos.write");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const code = b.code.toUpperCase();
  if (await prisma.coupon.findUnique({ where: { code } })) throw new HttpError(409, "این کد قبلاً وجود دارد");
  const c = await prisma.coupon.create({
    data: { code, type: b.type, value: b.value, maxDiscount: b.maxDiscount, minSubtotal: b.minSubtotal, categoryIds: b.categoryIds, productIds: b.productIds, startsAt: b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt ? new Date(b.endsAt) : null, usageLimit: b.usageLimit, perUserLimit: b.perUserLimit, active: true },
  });
  await logAudit({ ...actorOf(u), action: "coupon.create", entity: "Coupon", entityId: c.id, before: null, after: { code, type: b.type, value: b.value } });
  return json(couponUi(c));
});
