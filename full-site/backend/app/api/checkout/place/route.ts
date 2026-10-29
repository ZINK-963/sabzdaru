import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, rateLimit } from "@/lib/session";
import { availableStock, assertBatchSellable, computeTotals, OutOfStockError } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { bad, handle, HttpError, json, parse, readJson } from "@/lib/http";

const bodySchema = z.object({
  cartId: z.string().min(1),
  lines: z.array(z.object({ variantId: z.string(), quantity: z.number().int().positive().max(20) })).min(1).max(50),
  couponCode: z.string().trim().max(30).optional(),
  shippingMethodId: z.string().min(1),
  address: z.object({
    province: z.string().min(2),
    city: z.string().min(2),
    line: z.string().min(10),
    postalCode: z.string().regex(/^\d{10}$/),
  }),
  customer: z.object({
    name: z.string().min(3),
    phone: z.string().regex(/^0?9\d{9}$/),
    email: z.string().email().optional().or(z.literal("")),
  }),
});

async function uniqueOrderNumber(tx: any) {
  for (let i = 0; i < 6; i++) {
    const n = "SD-" + randomInt(100000, 999999);
    if (!(await tx.order.findUnique({ where: { number: n }, select: { id: true } }))) return n;
  }
  return "SD-" + Date.now().toString().slice(-9);
}

export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  // ۳۰ در ساعت برای هر IP (شبکه‌های مشترک مثل دانشگاه/شرکت پشت یک IP هستند؛ ۱۰ خیلی کم بود)
  if (!(await rateLimit(`checkout:${ip}`, 30, 3600))) throw new HttpError(429, "تعداد تلاش‌ها بیش از حد مجاز است");

  const body = parse<z.infer<typeof bodySchema>>(bodySchema, await readJson(req));
  const customer = { ...body.customer, phone: body.customer.phone.startsWith("0") ? body.customer.phone : "0" + body.customer.phone };
  const couponCode = body.couponCode ? body.couponCode.toUpperCase() : undefined;

  const run = () =>
    prisma.$transaction(
      async (tx) => {
        const method = await tx.shippingMethod.findUnique({ where: { id: body.shippingMethodId } });
        if (!method || !method.active) throw bad("روش ارسال نامعتبر است");

        // ۱) قفل ردیفی روی هر واریانت — جلوگیری از فروش هم‌زمان بیش از موجودی (§48)
        for (const line of body.lines) {
          await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${line.variantId} FOR UPDATE`;
          await assertBatchSellable(tx, line.variantId);
          const avail = await availableStock(tx, line.variantId);
          if (avail < line.quantity) throw new OutOfStockError(line.variantId, avail, line.quantity);
        }

        // ۲) مبالغ فقط سمت سرور محاسبه می‌شود — چیزی از کلاینت پذیرفته نمی‌شود
        const totals = await computeTotals(tx, body.lines, { couponCode, userId: user?.id, shippingMethodId: body.shippingMethodId });

        // ۳) سفارش با عکس لحظه‌ای هر آیتم
        const created = await tx.order.create({
          data: {
            number: await uniqueOrderNumber(tx), userId: user?.id ?? null, status: "PENDING_PAYMENT",
            subtotal: totals.subtotal, discount: totals.discount, shippingFee: totals.shippingFee, total: totals.total,
            couponCode: couponCode ?? null, shippingMethodId: body.shippingMethodId,
            addressSnapshot: body.address, customerSnapshot: customer,
            items: { create: totals.snapshots },
            events: { create: { to: "PENDING_PAYMENT", actorType: "customer", actorId: user?.id } },
          },
        });

        // ۴) موجودی همین حالا کم می‌شود: FEFO — نزدیک‌ترین انقضا اول، و فقط batchهای قابل فروش
        //    (قبلاً batchهای منقضی هم مصرف می‌شدند؛ چک موجودی آن‌ها را نمی‌شمرد ولی مصرف می‌کرد)
        const now = new Date();
        for (const line of body.lines) {
          let remaining = line.quantity;
          const batches = await tx.batch.findMany({
            where: { variantId: line.variantId, recalledAt: null, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            orderBy: [{ expiresAt: "asc" }],
          });
          for (const b of batches) {
            if (remaining <= 0) break;
            const take = Math.min(b.quantity, remaining);
            await tx.batch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } });
            remaining -= take;
          }
          if (remaining > 0) throw new OutOfStockError(line.variantId, line.quantity - remaining, line.quantity);
          await tx.inventoryMovement.create({ data: { variantId: line.variantId, delta: -line.quantity, reason: "sale", refId: created.id } });
        }

        // ۵) کوپن مصرف می‌شود
        if (totals.couponId) {
          await tx.coupon.update({ where: { id: totals.couponId }, data: { usedCount: { increment: 1 } } });
          if (user) await tx.couponRedemption.create({ data: { couponId: totals.couponId, userId: user.id, orderId: created.id } });
        }
        await notifyUser(tx, user?.id, `سفارش ${created.number} ثبت شد`, "سفارش شما در انتظار پرداخت است.");
        return created;
      },
      { isolationLevel: "Serializable" }
    );

  // تداخل serialization (P2034) زیر بار عادی است و باید دوباره امتحان شود، نه اینکه ۵۰۰ بدهد
  let order: Awaited<ReturnType<typeof run>> | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await run();
    } catch (e: any) {
      const retryable = e?.code === "P2034" || (e?.code === "P2002" && String(e?.meta?.target).includes("number"));
      if (!retryable || attempt === 2) throw e;
    }
  }

  await logAudit({ actorId: user?.id ?? null, actorRole: null, action: "order.create", entity: "Order", entityId: order!.id, before: null, after: { status: order!.status, total: order!.total }, ip });

  // سفارش ساخته شد اما هنوز پرداخت نشده؛ شروع پرداخت یک فراخوان جدا (POST /api/payments/initiate) است.
  return json({ orderId: order!.id, orderNumber: order!.number, total: order!.total });
});
