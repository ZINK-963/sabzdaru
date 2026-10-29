import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({
  subject: z.string().trim().min(3).max(120), category: z.string().trim().max(40).default("سایر"),
  priority: z.enum(["normal", "high"]).default("normal"), message: z.string().trim().min(10).max(2000),
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  await prisma.ticket.create({
    data: { userId: user.id, subject: b.subject, category: b.category, priority: b.priority, status: "open", messages: { create: { authorId: user.id, body: b.message, internal: false } } },
  });
  return json(await snapshot(user.id));
});
