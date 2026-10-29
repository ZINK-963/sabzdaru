import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bad, handle, json, readJson } from "@/lib/http";

const schema = z.object({ email: z.string().email() });

export const POST = handle(async (req: NextRequest) => {
  const r = schema.safeParse(await readJson(req));
  if (!r.success) throw bad("نشانی ایمیل معتبر نیست");
  await prisma.subscriber.upsert({ where: { email: r.data.email }, create: { email: r.data.email }, update: {} });
  return json({ ok: true });
});
