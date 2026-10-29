import { prisma } from "@/lib/prisma";
import { handle, json, requirePermission } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePermission("reviews.moderate");
  const rs = await prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { product: { select: { name: true } }, user: { select: { name: true } } } });
  return json(rs.map((r: any) => ({ id: r.id, pid: r.productId, pname: r.product.name, by: r.user.name, stars: r.rating, text: r.body, status: r.status, adminReply: r.adminReply })));
});
