import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]).optional(),
  adminReply: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });

  const before = await prisma.review.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "نظر پیدا نشد" }, { status: 404 });

  const after = await prisma.review.update({ where: { id: params.id }, data: parsed.data });

  await logAudit({
    actorId: user?.id ?? null, actorRole: user?.role?.key ?? null,
    action: "review.moderate", entity: "Review", entityId: before.id,
    before: { status: before.status }, after: { status: after.status },
  });

  return NextResponse.json(after);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const before = await prisma.review.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "نظر پیدا نشد" }, { status: 404 });

  await prisma.review.delete({ where: { id: params.id } });

  await logAudit({
    actorId: user?.id ?? null, actorRole: user?.role?.key ?? null,
    action: "review.delete", entity: "Review", entityId: before.id,
    before: { text: before.body }, after: null,
  });

  return NextResponse.json({ ok: true });
}
