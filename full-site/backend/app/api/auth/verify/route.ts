import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { redis, rateLimit, createSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  phone: z.string().regex(/^0?9\d{9}$/),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(2).max(80).optional(), // فقط برای اولین بار (ساخت حساب)
});

function normalizePhone(phone: string) {
  return phone.startsWith("0") ? phone : "0" + phone;
}
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "بدنهٔ درخواست JSON معتبر نیست" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });
  const { code, name } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);

  const okIp = await rateLimit(`otpverify:ip:${ip}`, 20, 3600);
  if (!okIp) return NextResponse.json({ error: "تعداد تلاش‌ها بیش از حد مجاز است" }, { status: 429 });

  const stored = await redis.get(`otp:${phone}`);
  if (!stored) return NextResponse.json({ error: "کد منقضی شده یا ارسال نشده؛ دوباره درخواست دهید" }, { status: 400 });

  const attempts = Number((await redis.get(`otp:attempts:${phone}`)) ?? "0");
  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(`otp:${phone}`);
    return NextResponse.json({ error: "تعداد تلاش‌های نادرست بیش از حد مجاز است؛ کد جدید بگیرید" }, { status: 429 });
  }

  if (hashCode(code) !== stored) {
    await redis.incr(`otp:attempts:${phone}`);
    return NextResponse.json({ error: "کد وارد شده نادرست است" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { phone } });
  // کاربر تازه باید نام هم بفرستد. این را قبل از «سوزاندن» کد می‌پرسیم؛ وگرنه تا کلاینت
  // با نام برگردد کد مصرف شده و ثبت‌نام هرگز کامل نمی‌شود.
  if (!user && !name) return NextResponse.json({ error: "برای ساخت حساب، نام لازم است", newUser: true }, { status: 400 });

  // کد فقط یک‌بار قابل استفاده است
  await redis.del(`otp:${phone}`);
  await redis.del(`otp:attempts:${phone}`);

  if (!user) {
    user = await prisma.user.create({
      data: { phone, name: name!, prefs: { order: true, restock: true, promo: true } },
    });
    await prisma.notification.create({ data: { userId: user.id, type: "account", title: "خوش آمدید", body: "حساب شما ساخته شد." } });
  }

  await createSession(user.id, null);
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, phone: user.phone } });
}
