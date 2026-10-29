import { prisma } from "@/lib/prisma";
import { gatewayKind } from "@/lib/gateway";
import { redis } from "@/lib/session";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** فرانت‌اند با این endpoint می‌فهمد بک‌اند واقعی در دسترس است (حالت «زنده») — service باید دقیقاً "sabzdaru" باشد */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("redis health check failed");
  } catch {
    return json({ ok: false, error: "database unreachable" }, 503);
  }
  return json({ ok: true, service: "sabzdaru", gateway: gatewayKind(), sms: process.env.SMS_PROVIDER ?? "console", time: new Date().toISOString() });
}
