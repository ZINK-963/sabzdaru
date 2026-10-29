import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { HttpError, handle, json, requireUser } from "@/lib/http";

export const PUT = handle(async (_req: NextRequest, { params }: { params: { pid: string } }) => {
  const user = await requireUser();
  const p = await prisma.product.findUnique({ where: { id: params.pid }, select: { id: true } });
  if (!p) throw new HttpError(404, "کالا پیدا نشد");
  await prisma.favorite.upsert({ where: { userId_productId: { userId: user.id, productId: p.id } }, create: { userId: user.id, productId: p.id }, update: {} });
  return json(await snapshot(user.id));
});

export const DELETE = handle(async (_req: NextRequest, { params }: { params: { pid: string } }) => {
  const user = await requireUser();
  await prisma.favorite.deleteMany({ where: { userId: user.id, productId: params.pid } });
  return json(await snapshot(user.id));
});
