import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TICKET_LABEL, uiTicket } from "@/lib/shape";
import { notifyUser } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { actorOf, handle, HttpError, json, parse, readJson, requirePermission } from "@/lib/http";

const schema = z.object({
  status: z.enum(Object.keys(TICKET_LABEL) as [string, ...string[]]).optional(),
  reply: z.string().min(1).max(2000).optional(), internal: z.boolean().default(false),
});

export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const u = await requirePermission("tickets.write");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) throw new HttpError(404, "تیکت پیدا نشد");

  await prisma.$transaction(async (tx) => {
    if (b.reply) {
      await tx.ticketMessage.create({ data: { ticketId: ticket.id, authorId: u.id, body: b.reply, internal: b.internal } });
      // یادداشت داخلی نه وضعیت را عوض می‌کند، نه مشتری آن را می‌بیند و نه اعلانی می‌گیرد
      if (!b.internal) {
        if (!b.status) await tx.ticket.update({ where: { id: ticket.id }, data: { status: "waiting_customer" } });
        await notifyUser(tx, ticket.userId, "پاسخ پشتیبانی", `تیکت «${ticket.subject}» پاسخ داده شد.`, "ticket");
      }
    }
    if (b.status) await tx.ticket.update({ where: { id: ticket.id }, data: { status: b.status } });
  });
  await logAudit({ ...actorOf(u), action: b.reply ? (b.internal ? "ticket.internal_note" : "ticket.reply") : "ticket.status_change", entity: "Ticket", entityId: ticket.id, before: { status: ticket.status }, after: { status: b.status ?? ticket.status } });

  const t = await prisma.ticket.findUnique({ where: { id: ticket.id }, include: { messages: true, user: { select: { name: true } } } });
  return json({ ...uiTicket(t, t!.user.name, true), customer: t!.user.name });
});
