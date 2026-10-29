import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(20).optional(),
  reviewedBy: z.string().max(120).optional(),
  publish: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });
  const body = parsed.data;

  const before = await prisma.article.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "مقاله پیدا نشد" }, { status: 404 });

  const willPublish = body.publish ?? !!before.publishedAt;
  const reviewer = body.reviewedBy ?? before.reviewedBy;
  if (willPublish && !reviewer) {
    return NextResponse.json({ error: "برای انتشار، نام بازبینی‌کنندهٔ محتوا لازم است" }, { status: 400 });
  }

  const after = await prisma.article.update({
    where: { id: params.id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.body && { body: body.body }),
      ...(body.reviewedBy && { reviewedBy: body.reviewedBy }),
      ...(body.publish !== undefined && { publishedAt: body.publish ? new Date() : null }),
    },
  });

  await logAudit({
    actorId: user?.id ?? null, actorRole: user?.role?.key ?? null,
    action: "article.update", entity: "Article", entityId: before.id,
    before: { published: !!before.publishedAt }, after: { published: !!after.publishedAt },
  });

  return NextResponse.json(after);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const before = await prisma.article.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "مقاله پیدا نشد" }, { status: 404 });

  await prisma.article.delete({ where: { id: params.id } });

  await logAudit({
    actorId: user?.id ?? null, actorRole: user?.role?.key ?? null,
    action: "article.delete", entity: "Article", entityId: before.id,
    before: { title: before.title }, after: null,
  });

  return NextResponse.json({ ok: true });
}
