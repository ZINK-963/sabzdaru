import { prisma } from "@/lib/prisma";
import { uiTicket } from "@/lib/shape";
import { handle, json, requirePermission } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePermission("tickets.write");
  const ts = await prisma.ticket.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { messages: true, user: { select: { name: true } } } });
  return json(ts.map((t: any) => ({ ...uiTicket(t, t.user.name, true), customer: t.user.name })));
});
