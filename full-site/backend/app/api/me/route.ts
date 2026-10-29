import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { destroySession } from "@/lib/session";
import { snapshot, DEFAULT_PREFS } from "@/lib/shape";
import { HttpError, handle, json, parse, readJson, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

/** عکس کامل حساب: کاربر، نقش و مجوزها، نشانی‌ها، فهرست‌ها، روتین‌ها، علاقه‌مندی‌ها، اعلان‌ها، سفارش‌ها، تیکت‌ها */
export const GET = handle(async () => {
  const user = await requireUser();
  return json(await snapshot(user.id));
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  prefs: z.object({ order: z.boolean().optional(), restock: z.boolean().optional(), promo: z.boolean().optional() }).optional(),
});

export const PATCH = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const b = parse<z.infer<typeof patchSchema>>(patchSchema, await readJson(req));
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.email !== undefined && { email: b.email === "" ? null : b.email }),
        ...(b.prefs && { prefs: { ...DEFAULT_PREFS, ...((user.prefs as object) ?? {}), ...b.prefs } }),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") throw new HttpError(409, "این ایمیل قبلاً برای حساب دیگری ثبت شده");
    throw e;
  }
  return json(await snapshot(user.id));
});

/** حذف حساب (§39): اطلاعات شخصی پاک/ناشناس می‌شود؛ سفارش‌ها برای الزامات مالی بدون نام نگه داشته می‌شوند */
export const DELETE = handle(async () => {
  const user = await requireUser();
  await prisma.$transaction([
    prisma.address.deleteMany({ where: { userId: user.id } }),
    prisma.shoppingList.deleteMany({ where: { userId: user.id } }),
    prisma.routine.deleteMany({ where: { userId: user.id } }),
    prisma.favorite.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), name: "کاربر حذف‌شده", email: null, phone: `deleted-${user.id}`, prefs: {} } }),
  ]);
  await destroySession();
  return json({ ok: true });
});
