import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notDemo } from "@/lib/demo";

const querySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  sort: z.enum(["pop", "new", "cheap", "exp", "rate"]).default("pop"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(24),
});

const DB_SORT: Record<string, any> = {
  pop: { reviews: { _count: "desc" } },
  new: { createdAt: "desc" },
  rate: { reviews: { _count: "desc" } },
};

function shapeProduct(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand.name,
    image: p.images[0]?.url ?? null,
    price: p.variants[0]?.price ?? null,
    salePrice: p.variants[0]?.salePrice ?? null,
    reviewCount: p._count.reviews,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
  const q = parsed.data;

  const attrFilters: Record<string, string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("attr.")) {
      const attrKey = key.slice(5);
      attrFilters[attrKey] = (attrFilters[attrKey] ?? []).concat(value);
    }
  }

  const where: any = { published: true, ...notDemo() };
  if (q.category) where.category = { slug: q.category };
  if (q.brand) where.brand = { slug: q.brand };
  if (Object.keys(attrFilters).length) {
    where.AND = Object.entries(attrFilters).map(([k, vals]) => ({
      OR: vals.map((v) => ({ attributes: { path: [k], equals: v } })),
    }));
  }

  const includeShape = {
    brand: true,
    variants: { orderBy: { price: "asc" as const }, take: 1 },
    images: { orderBy: { position: "asc" as const }, take: 1 },
    _count: { select: { reviews: true } },
  };

  if (q.sort === "cheap" || q.sort === "exp") {
    // بدون ستون denormalized برای min(price)، مرتب‌سازی قیمتی را دومرحله‌ای انجام می‌دهیم:
    // ۱) همهٔ شناسه‌های منطبق با فیلتر را می‌گیریم (بدون صفحه‌بندی)
    // ۲) کمترین قیمت هر کدام را با یک groupBy می‌گیریم و در جاوااسکریپت مرتب می‌کنیم
    // برای یک کاتالوگ متوسط (چند هزار کالا) این کاملاً کافی است؛ برای کاتالوگ خیلی بزرگ،
    // اضافه‌کردن Product.minPrice denormalized و به‌روزرسانی‌اش در هر تغییر واریانت بهتر است.
    const matched = await prisma.product.findMany({ where, select: { id: true } });
    const ids = matched.map((m) => m.id);
    if (!ids.length) {
      return NextResponse.json({ products: [], page: q.page, perPage: q.perPage, total: 0, totalPages: 1 });
    }

    const priceGroups = await prisma.productVariant.groupBy({
      by: ["productId"],
      where: { productId: { in: ids } },
      _min: { price: true },
    });
    const priceMap = new Map<string, number>(priceGroups.map((g): [string, number] => [g.productId, g._min.price ?? Infinity]));
    ids.sort((a, b) => {
      const pa = priceMap.get(a) ?? Infinity;
      const pb = priceMap.get(b) ?? Infinity;
      return q.sort === "cheap" ? pa - pb : pb - pa;
    });

    const total = ids.length;
    const pageIds = ids.slice((q.page - 1) * q.perPage, q.page * q.perPage);
    const products = await prisma.product.findMany({ where: { id: { in: pageIds } }, include: includeShape });
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json({
      products: ordered.map(shapeProduct),
      page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)),
    });
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, include: includeShape,
      skip: (q.page - 1) * q.perPage, take: q.perPage,
      orderBy: DB_SORT[q.sort],
    }),
  ]);

  return NextResponse.json({
    products: products.map(shapeProduct),
    page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)),
  });
}
