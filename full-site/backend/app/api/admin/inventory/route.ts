import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/shape";
import { handle, json, requirePermission } from "@/lib/http";

export const dynamic = "force-dynamic";

/** آخرین ۵۰ تغییر انبار (ورود، فروش، بازگشت، اصلاح دستی) */
export const GET = handle(async () => {
  await requirePermission("inventory.write");
  const moves = await prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { variant: { include: { product: { select: { id: true, name: true } } } } } });
  return json({ moves: moves.map((m: any) => ({ id: m.id, pid: m.variant.productId, name: m.variant.product.name, qty: m.delta, reason: m.reason, at: fmt(m.createdAt) })) });
});
