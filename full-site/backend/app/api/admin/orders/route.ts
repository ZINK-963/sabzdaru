import { prisma } from "@/lib/prisma";
import { productIdsByVariant, uiOrder } from "@/lib/shape";
import { handle, json, requirePermission } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePermission("orders.write");
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { items: true, events: true, payments: true } });
  const pidBy = await productIdsByVariant(orders.flatMap((o: any) => o.items.map((i: any) => i.variantId)));
  return json(orders.map((o: any) => uiOrder(o, pidBy, true)));
});
