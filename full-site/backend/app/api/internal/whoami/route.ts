import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * فقط برای middleware.ts فراخوانی می‌شود، نه برای کلاینت.
 * چون middleware روی Edge Runtime اجرا می‌شود و نمی‌تواند مستقیم Prisma/Redis
 * صدا بزند، این مسیر (روی Node runtime عادی) نشست را از Redis می‌خواند،
 * نقش کاربر را از دیتابیس می‌گیرد و فقط لیست کلیدهای مجوز را برمی‌گرداند —
 * هیچ‌چیز دیگری از کاربر افشا نمی‌شود.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId, deletedAt: null },
    include: { role: { include: { permissions: true } } },
  });
  if (!user || !user.role) return NextResponse.json({ error: "no role assigned" }, { status: 403 });

  return NextResponse.json({
    userId: user.id,
    roleKey: user.role.key,
    permissions: user.role.permissions.map((p) => p.key),
  });
}
