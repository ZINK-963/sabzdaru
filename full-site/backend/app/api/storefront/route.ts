import { prisma } from "@/lib/prisma";
import { catalog } from "@/lib/shape";
import { notDemo } from "@/lib/demo";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * همهٔ آنچه ویترین لازم دارد در یک درخواست: دسته‌ها (با فیلترهای اختصاصی)، برندها، کالاها (با موجودی و
 * تاریخ انقضای واقعی)، مقالات، روش‌های ارسال. برای چند هزار کالا مناسب است؛ برای کاتالوگ خیلی بزرگ‌تر،
 * فیلتر/صفحه‌بندی سمت سرور از طریق GET /api/products را جایگزین کنید.
 */
export const GET = handle(async () => {
  const [cats, brands, products, articles, methods] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, include: { attributes: { orderBy: { key: "asc" } } } }),
    prisma.brand.findMany({ where: notDemo(), orderBy: { name: "asc" } }),
    catalog({ published: true, ...notDemo() }),
    prisma.article.findMany({ where: { publishedAt: { not: null }, ...notDemo() }, orderBy: { publishedAt: "desc" } }),
    prisma.shippingMethod.findMany({ where: { active: true } }),
  ]);
  const shipping = methods
    .map((m: any) => ({ id: m.id, name: m.name, days: m.etaDays, fee: m.fee, freeAbove: m.freeAbove }))
    .sort((a: any, b: any) => Number(a.fee === 0) - Number(b.fee === 0) || a.fee - b.fee);   // پیک/پست اول، «تحویل حضوری» آخر
  const res = json({
    categories: cats.map((c: any) => ({ slug: c.slug, name: c.name, attributes: c.attributes.map((a: any) => ({ key: a.key, label: a.label, options: a.options })) })),
    brands: brands.map((b: any) => ({ id: b.slug, name: b.name, desc: b.desc ?? "" })),
    products,
    articles: articles.map((a: any) => ({ id: a.slug, slug: a.slug, title: a.title, cat: a.category, read: a.readTime, tag: a.tags?.[0] ?? "", body: a.body })),
    shipping,
    freeShippingAbove: Math.max(0, ...shipping.map((s: any) => s.freeAbove ?? 0)) || 800000,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
});
