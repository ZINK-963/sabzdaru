import { prisma } from "@/lib/prisma";
import { PAID_STATUSES, fmt } from "@/lib/shape";
import { handle, json, requirePermission } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePermission("customers.read");
  const users = await prisma.user.findMany({
    where: { deletedAt: null, roleId: null }, orderBy: { createdAt: "desc" }, take: 500,
    include: { orders: { select: { total: true, status: true } } },
  });
  return json(users.map((c: any) => ({
    id: c.id, name: c.name, phone: c.phone, mail: c.email ?? "", orders: c.orders.length,
    spent: c.orders.filter((o: any) => (PAID_STATUSES as readonly string[]).includes(o.status)).reduce((a: number, o: any) => a + o.total, 0),
    createdAt: fmt(c.createdAt),
  })));
});
