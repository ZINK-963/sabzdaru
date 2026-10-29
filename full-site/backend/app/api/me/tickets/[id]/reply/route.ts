import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { HttpError, handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({ message: z.string().trim().min(1).max(2000) });

export const POST = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const t = await prisma.ticket.findFirst({ where: { id: params.id, userId: user.id } });
  if (!t) throw new HttpError(404, "تیکت پیدا نشد");
  if (t.status === "closed") throw new HttpError(409, "این تیکت بسته شده است");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: user.id, body: b.message, internal: false } }),
    prisma.ticket.update({ where: { id: t.id }, data: { status: "open" } }),
  ]);
  return json(await snapshot(user.id));
});
