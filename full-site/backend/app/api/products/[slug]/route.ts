import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { availableStock } from "@/lib/pricing";
import { hideDemo } from "@/lib/demo";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      brand: true,
      category: true,
      manufacturer: true,
      variants: { orderBy: { price: "asc" } },
      images: { orderBy: { position: "asc" } },
      reviews: {
        where: { status: "approved" }, // نظرهای در انتظار بازبینی هرگز عمومی نمی‌شوند
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!product || !product.published || (hideDemo() && product.isDemo)) {
    return NextResponse.json({ error: "کالا پیدا نشد" }, { status: 404 });
  }

  const variants = await Promise.all(
    product.variants.map(async (v) => {
      // نزدیک‌ترین تاریخ انقضای batchهای فروختنی — چیزی که مشتری واقعاً باید ببیند
      const soonestBatch = await prisma.batch.findFirst({
        where: { variantId: v.id, recalledAt: null, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: { expiresAt: "asc" },
      });
      return {
        id: v.id,
        sku: v.sku,
        label: v.label,
        price: v.price,
        salePrice: v.salePrice,
        stock: await availableStock(prisma, v.id),
        expiresAt: soonestBatch?.expiresAt ?? null,
        batchCode: soonestBatch?.code ?? null,
      };
    })
  );

  const rating = product.reviews.length
    ? Math.round((product.reviews.reduce((a, r) => a + r.rating, 0) / product.reviews.length) * 10) / 10
    : null;

  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, published: true },
    take: 4,
    include: { brand: true, images: { take: 1, orderBy: { position: "asc" } }, variants: { take: 1, orderBy: { price: "asc" } } },
  });

  return NextResponse.json({
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: { name: product.brand.name, slug: product.brand.slug },
    category: { name: product.category.name, slug: product.category.slug },
    manufacturer: product.manufacturer?.name ?? null,
    description: product.description,
    usage: product.usage,
    storage: product.storage,
    warnings: product.warnings,
    ingredients: product.ingredients,
    attributes: product.attributes,
    images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants,
    rating,
    reviewCount: product.reviews.length,
    reviews: product.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      verified: r.verified,
      author: r.user?.name ?? "کاربر",
      adminReply: r.adminReply,
      helpful: r.helpful,
      createdAt: r.createdAt,
    })),
    related: related.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand.name,
      image: p.images[0]?.url ?? null,
      price: p.variants[0]?.price ?? null,
    })),
  });
}
