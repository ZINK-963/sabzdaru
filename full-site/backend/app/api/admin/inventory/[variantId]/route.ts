import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { availableStock } from "@/lib/pricing";

const bodySchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "مقدار تغییر نمی‌تواند صفر باشد"),
  reason: z.string().min(3).max(200).default("اصلاح دستی انبار"),
  batchCode: z.string().max(60).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { variantId: string } }) {
  const user = await getCurrentUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const variant = await prisma.productVariant.findUnique({ where: { id: params.variantId } });
  if (!variant) return NextResponse.json({ error: "واریانت پیدا نشد" }, { status: 404 });

  const before = await availableStock(prisma, variant.id);

  try {
    await prisma.$transaction(async (tx) => {
      if (body.delta > 0) {
        // ورود جدید = batch تازه با تاریخ انقضای مشخص (اگر داده شده)
        await tx.batch.create({
          data: {
            variantId: variant.id,
            code: body.batchCode ?? `ADJ-${Date.now()}`,
            quantity: body.delta,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          },
        });
      } else {
        // کاهش دستی از جدیدترین batchهای دارای موجودی کم می‌شود
        let remaining = -body.delta;
        const batches = await tx.batch.findMany({
          where: { variantId: variant.id, quantity: { gt: 0 } },
          orderBy: { receivedAt: "desc" },
        });
        for (const b of batches) {
          if (remaining <= 0) break;
          const take = Math.min(b.quantity, remaining);
          await tx.batch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } });
          remaining -= take;
        }
        if (remaining > 0) {
          throw new Error(`فقط ${-body.delta - remaining} عدد برای کاهش موجود بود، نه ${-body.delta} عدد`);
        }
      }
      await tx.inventoryMovement.create({
        data: { variantId: variant.id, delta: body.delta, reason: body.reason, actorId: user?.id },
      });
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "تنظیم موجودی با خطا مواجه شد" }, { status: 409 });
  }

  const after = await availableStock(prisma, variant.id);

  await logAudit({
    actorId: user?.id ?? null,
    actorRole: user?.role?.key ?? null,
    action: "inventory.adjust",
    entity: "ProductVariant",
    entityId: variant.id,
    before: { stock: before },
    after: { stock: after, reason: body.reason },
  });

  return NextResponse.json({ ok: true, stock: after });
}
