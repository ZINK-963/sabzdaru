import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/shape";
import { handle, json, parse, readJson, requireUser } from "@/lib/http";

const schema = z.object({ prov: z.string().min(2), city: z.string().min(2), line: z.string().min(10), zip: z.string().regex(/^\d{10}$/) });

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const b = parse<z.infer<typeof schema>>(schema, await readJson(req));
  const dup = await prisma.address.findFirst({ where: { userId: user.id, line: b.line } });
  if (!dup) await prisma.address.create({ data: { userId: user.id, province: b.prov, city: b.city, line: b.line, postalCode: b.zip } });
  return json(await snapshot(user.id));
});
