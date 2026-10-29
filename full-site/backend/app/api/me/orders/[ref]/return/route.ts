import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { HttpError, handle, json, requireUser } from "@/lib/http";

export const POST = handle(async (_req: NextRequest, { params }: { params: { ref: string } }) => {
  const user = await requireUser();
  const order = await prisma.order.findFirst({ where: { userId: user.id, OR: [{ id: params.ref }, { number: params.ref }] } });
  if (!order) throw new HttpError(404, "سفارش پیدا نشد");
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({ where: { id: order.id, status: "DELIVERED" }, data: { status: "RETURN_REQUESTED" } });
    if (claimed.count === 0) throw new HttpError(409, "فقط سفارش تحویل‌شده قابل مرجوع‌کردن است");
    await tx.orderEvent.create({ data: { orderId: order.id, from: "DELIVERED", to: "RETURN_REQUESTED", actorType: "customer", actorId: user.id } });
  });
  return json(await snapshot(user.id));
});
