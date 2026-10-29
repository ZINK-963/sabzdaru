import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/, "فقط حروف کوچک انگلیسی، عدد و خط تیره"),
  title: z.string().min(3).max(200),
  excerpt: z.string().max(300).optional(),
  body: z.string().min(20),
  category: z.string().min(2).max(60),
  tags: z.array(z.string()).default([]),
  coverUrl: z.string().url().optional(),
  readTime: z.number().int().positive().max(60),
  seoTitle: z.string().max(70).optional(),
  seoDesc: z.string().max(160).optional(),
  reviewedBy: z.string().max(120).optional(), // §31 — چه کارشناسی محتوای سلامت را بازبینی کرده
  publish: z.boolean().default(false),
});

export async function GET() {
  const articles = await prisma.article.findMany({ orderBy: { publishedAt: "desc" } });
  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  // §31: محتوای سلامت بدون نام بازبینی‌کننده منتشر نمی‌شود — فقط پیش‌نویس می‌ماند
  if (body.publish && !body.reviewedBy) {
    return NextResponse.json({ error: "برای انتشار، نام بازبینی‌کنندهٔ محتوا لازم است" }, { status: 400 });
  }

  const exists = await prisma.article.findUnique({ where: { slug: body.slug } });
  if (exists) return NextResponse.json({ error: "این نامک (slug) قبلاً استفاده شده" }, { status: 409 });

  const article = await prisma.article.create({
    data: {
      slug: body.slug, title: body.title, excerpt: body.excerpt, body: body.body,
      category: body.category, tags: body.tags, coverUrl: body.coverUrl, readTime: body.readTime,
      seoTitle: body.seoTitle, seoDesc: body.seoDesc, reviewedBy: body.reviewedBy,
      authorId: user?.id, publishedAt: body.publish ? new Date() : null,
    },
  });

  await logAudit({
    actorId: user?.id ?? null, actorRole: user?.role?.key ?? null,
    action: "article.create", entity: "Article", entityId: article.id,
    before: null, after: { slug: body.slug, published: body.publish },
  });

  return NextResponse.json(article, { status: 201 });
}
