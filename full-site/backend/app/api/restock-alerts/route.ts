import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { bad, HttpError, handle, json, parse, readJson } from "@/lib/http";

const schema = z.object({ variantId: z.string(), email: z.string().email().optional() });

/** «وقتی موجود شد خبرم کن». ستون email شیوهٔ تماس است: ایمیل، یا ایمیل/موبایل حساب کاربر واردشده. */
export const POST = handle(async (req: NextRequest) => {
  const body = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const variant = await prisma.productVariant.findUnique({ where: { id: body.variantId }, select: { id: true } });
  if (!variant) throw new HttpError(404, "کالا پیدا نشد");
  const user = await getCurrentUser();
  const contact = body.email ?? (user ? user.email ?? user.phone : null);
  if (!contact) throw bad("برای اعلان موجودی، ایمیل یا ورود لازم است");
  await prisma.restockAlert.upsert({ where: { variantId_email: { variantId: body.variantId, email: contact } }, create: { variantId: body.variantId, email: contact }, update: {} });
  return json({ ok: true });
});
