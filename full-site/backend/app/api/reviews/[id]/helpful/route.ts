import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/session";
import { HttpError, handle, json } from "@/lib/http";

export const POST = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const review = await prisma.review.findFirst({ where: { id: params.id, status: "approved" } });
  if (!review) throw new HttpError(404, "نظر پیدا نشد");
  if (!(await rateLimit(`helpful:${ip}:${params.id}`, 1, 86400))) throw new HttpError(429, "قبلاً ثبت کرده‌اید");
  const r = await prisma.review.update({ where: { id: params.id }, data: { helpful: { increment: 1 } } });
  return json({ ok: true, helpful: r.helpful });
});
