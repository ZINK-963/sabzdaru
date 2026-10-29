import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { handle, json, requireUser } from "@/lib/http";

export const POST = handle(async () => {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return json(await snapshot(user.id));
});
