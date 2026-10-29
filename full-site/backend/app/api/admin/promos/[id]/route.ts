import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { actorOf, handle, HttpError, json, parse, readJson, requirePermission } from "@/lib/http";
import { couponUi } from "@/lib/shape";

const schema = z.object({ active: z.boolean().optional(), value: z.number().int().positive().optional(), minSubtotal: z.number().int().min(0).optional(), usageLimit: z.number().int().positive().optional() });

export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const u = await requirePermission("promos.write");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const before = await prisma.coupon.findFirst({ where: { OR: [{ id: params.id }, { code: params.id.toUpperCase() }] } });
  if (!before) throw new HttpError(404, "کد تخفیف پیدا نشد");
  const after = await prisma.coupon.update({ where: { id: before.id }, data: b });
  await logAudit({ ...actorOf(u), action: "coupon.update", entity: "Coupon", entityId: before.id, before: { active: before.active, value: before.value }, after: { active: after.active, value: after.value } });
  return json(couponUi(after));
});
