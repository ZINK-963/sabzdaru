import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomInt, createHash } from "crypto";
import { redis, rateLimit } from "@/lib/session";
import { getSmsProvider } from "@/lib/sms";

const bodySchema = z.object({ phone: z.string().regex(/^0?9\d{9}$/, "شمارهٔ موبایل معتبر نیست") });
const OTP_TTL_SECONDS = 120;

function normalizePhone(phone: string) {
  return phone.startsWith("0") ? phone : "0" + phone;
}
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "بدنهٔ درخواست JSON معتبر نیست" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "شمارهٔ موبایل معتبر نیست" }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);

  // هم روی IP هم روی شماره محدود می‌کنیم — جلوگیری از اسپم پیامک و حدس OTP
  const okIp = await rateLimit(`otp:ip:${ip}`, 10, 3600);
  const okPhone = await rateLimit(`otp:phone:${phone}`, 5, 3600);
  if (!okIp || !okPhone) {
    return NextResponse.json({ error: "تعداد درخواست‌ها بیش از حد مجاز است، کمی بعد تلاش کنید" }, { status: 429 });
  }

  // DEV_FIXED_OTP فقط برای تست خودکار؛ در production نادیده گرفته می‌شود
  const fixed = process.env.NODE_ENV !== "production" ? process.env.DEV_FIXED_OTP : undefined;
  const code = fixed && /^\d{6}$/.test(fixed) ? fixed : String(randomInt(100000, 999999));
  await redis.set(`otp:${phone}`, hashCode(code), "EX", OTP_TTL_SECONDS);
  await redis.set(`otp:attempts:${phone}`, "0", "EX", OTP_TTL_SECONDS);

  try {
    await getSmsProvider().sendOtp(phone, code);
  } catch (err) {
    console.error("sms send failed", err);
    return NextResponse.json({ error: "ارسال پیامک با خطا مواجه شد" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, expiresInSeconds: OTP_TTL_SECONDS });
}
