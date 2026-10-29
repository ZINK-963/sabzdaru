import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { handle, json, requireUser } from "@/lib/http";

export const DELETE = handle(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await prisma.address.deleteMany({ where: { id: params.id, userId: user.id } });   // userId در where: کاربر فقط نشانی‌های خودش را حذف می‌کند
  return json(await snapshot(user.id));
});
