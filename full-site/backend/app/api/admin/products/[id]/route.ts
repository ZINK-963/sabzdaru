import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { catalog } from "@/lib/shape";
import { availableStock } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";
import { actorOf, bad, handle, HttpError, json, parse, readJson, requirePermission } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(200).optional(), variant: z.string().trim().max(60).optional(), description: z.string().max(5000).optional(),
  published: z.boolean().optional(), price: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),          // موجودی هدف (مطلق) — همان چیزی که فرم ویرایش می‌فرستد
  stockDelta: z.number().int().optional(),            // یا تغییر نسبی
  cat: z.string().optional(), brand: z.string().optional(),
});

export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const u = await requirePermission("products.write");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const product = await prisma.product.findUnique({ where: { id: params.id }, include: { variants: { orderBy: { price: "asc" }, take: 1 } } });
  if (!product || !product.variants[0]) throw new HttpError(404, "کالا پیدا نشد");
  const variant = product.variants[0];
  const stockBefore = await availableStock(prisma, variant.id);

  const category = b.cat ? await prisma.category.findUnique({ where: { slug: b.cat } }) : null;
  const brand = b.brand ? await prisma.brand.findUnique({ where: { slug: b.brand } }) : null;
  if ((b.cat && !category) || (b.brand && !brand)) throw bad("دسته یا برند نامعتبر است");
  const delta = b.stock !== undefined ? b.stock - stockBefore : (b.stockDelta ?? 0);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { ...(b.name && { name: b.name }), ...(b.description !== undefined && { description: b.description }), ...(b.published !== undefined && { published: b.published }), ...(category && { categoryId: category.id }), ...(brand && { brandId: brand.id }) },
    });
    if (b.price !== undefined || b.variant !== undefined) {
      await tx.productVariant.update({ where: { id: variant.id }, data: { ...(b.price !== undefined && { price: b.price }), ...(b.variant !== undefined && { label: b.variant }) } });
    }
    if (delta > 0) {
      await tx.batch.create({ data: { variantId: variant.id, code: `ADJ-${Date.now()}`, quantity: delta } });
    } else if (delta < 0) {
      if (stockBefore + delta < 0) throw new HttpError(409, "موجودی نمی‌تواند منفی شود");
      let remaining = -delta;
      const batches = await tx.batch.findMany({ where: { variantId: variant.id, quantity: { gt: 0 } }, orderBy: { receivedAt: "desc" } });
      for (const bt of batches) {
        if (remaining <= 0) break;
        const take = Math.min(bt.quantity, remaining);
        await tx.batch.update({ where: { id: bt.id }, data: { quantity: { decrement: take } } });
        remaining -= take;
      }
      if (remaining > 0) throw new HttpError(409, "موجودی کافی برای این کاهش نیست");
    }
    if (delta !== 0) await tx.inventoryMovement.create({ data: { variantId: variant.id, delta, reason: "اصلاح دستی انبار", actorId: u.id } });
  });

  await logAudit({ ...actorOf(u), action: "product.update", entity: "Product", entityId: product.id, before: { name: product.name, published: product.published, price: variant.price, stock: stockBefore }, after: { ...b } });
  return json((await catalog({ id: product.id }))[0]);
});

/** «حذف» همیشه نرم است: کالا از ویترین برداشته می‌شود ولی سفارش‌های قبلی به آن ارجاع دارند */
export const DELETE = handle(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const u = await requirePermission("products.write");
  const p = await prisma.product.findUnique({ where: { id: params.id } });
  if (!p) throw new HttpError(404, "کالا پیدا نشد");
  await prisma.product.update({ where: { id: p.id }, data: { published: false } });
  await logAudit({ ...actorOf(u), action: "product.unpublish", entity: "Product", entityId: p.id, before: { published: p.published }, after: { published: false } });
  return json({ ok: true });
});
