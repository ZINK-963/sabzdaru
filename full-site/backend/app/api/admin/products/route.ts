import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { catalog } from "@/lib/shape";
import { logAudit } from "@/lib/audit";
import { actorOf, bad, handle, json, parse, readJson, requirePermission } from "@/lib/http";

/** همهٔ کالاها (شامل پیش‌نویس‌ها) برای پنل مدیریت */
export const GET = handle(async () => {
  await requirePermission("products.write");
  return json(await catalog({}));
});

const schema = z.object({
  name: z.string().trim().min(2).max(200), variant: z.string().trim().max(60).default(""),
  price: z.number().int().positive(), stock: z.number().int().min(0),
  cat: z.string(), brand: z.string(),
});

export const POST = handle(async (req: NextRequest) => {
  const u = await requirePermission("products.write");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const [category, brand] = await Promise.all([prisma.category.findUnique({ where: { slug: b.cat } }), prisma.brand.findUnique({ where: { slug: b.brand } })]);
  if (!category || !brand) throw bad("دسته یا برند نامعتبر است");

  const slug = `${b.cat}-${Date.now().toString(36)}`;
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: { slug, name: b.name, categoryId: category.id, brandId: brand.id, published: true, variants: { create: { sku: `SKU-${slug.toUpperCase()}`, label: b.variant, price: b.price } } },
      include: { variants: true },
    });
    if (b.stock > 0) {
      const v = p.variants[0];
      await tx.batch.create({ data: { variantId: v.id, code: `INIT-${Date.now()}`, quantity: b.stock } });
      await tx.inventoryMovement.create({ data: { variantId: v.id, delta: b.stock, reason: "ثبت کالای تازه", actorId: u.id } });
    }
    return p;
  });
  await logAudit({ ...actorOf(u), action: "product.create", entity: "Product", entityId: product.id, before: null, after: { name: b.name, price: b.price } });
  return json((await catalog({ id: product.id }))[0]);
});
