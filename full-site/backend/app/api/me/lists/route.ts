import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({ name: z.string().trim().min(1).max(60), items: z.array(z.string()).max(200).optional() });

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const valid = b.items?.length ? (await prisma.product.findMany({ where: { id: { in: b.items } }, select: { id: true } })).map((p: any) => p.id) : [];
  await prisma.shoppingList.create({ data: { userId: user.id, name: b.name, items: valid } });
  return json(await snapshot(user.id));
});
