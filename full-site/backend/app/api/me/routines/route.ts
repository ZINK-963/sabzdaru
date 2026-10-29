import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({ name: z.string().trim().min(1).max(60), steps: z.array(z.string()).min(1).max(30) });

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const valid = (await prisma.product.findMany({ where: { id: { in: b.steps } }, select: { id: true } })).map((p: any) => p.id);
  // ترتیب مراحل مهم است؛ findMany ترتیب ورودی را حفظ نمی‌کند، پس از روی ورودی فیلتر می‌کنیم
  await prisma.routine.create({ data: { userId: user.id, name: b.name, steps: b.steps.filter((id) => valid.includes(id)) } });
  return json(await snapshot(user.id));
});
