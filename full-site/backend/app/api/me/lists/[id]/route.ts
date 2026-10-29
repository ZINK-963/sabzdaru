import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { HttpError, handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({ name: z.string().trim().min(1).max(60).optional(), items: z.array(z.string()).max(200).optional() });

export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const list = await prisma.shoppingList.findFirst({ where: { id: params.id, userId: user.id } });
  if (!list) throw new HttpError(404, "فهرست پیدا نشد");
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const items = b.items ? (await prisma.product.findMany({ where: { id: { in: b.items } }, select: { id: true } })).map((p: any) => p.id) : undefined;
  await prisma.shoppingList.update({ where: { id: list.id }, data: { ...(b.name && { name: b.name }), ...(items && { items }) } });
  return json(await snapshot(user.id));
});

export const DELETE = handle(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await prisma.shoppingList.deleteMany({ where: { id: params.id, userId: user.id } });
  return json(await snapshot(user.id));
});
