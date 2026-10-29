import { Redis } from "ioredis";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const redis = new Redis(process.env.REDIS_URL!);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // ۳۰ روز
const COOKIE_NAME = "sd_session";

export type SessionData = { userId: string; roleKey: string | null };

/** نشست تازه می‌سازد، شناسه را چرخش می‌دهد (جلوگیری از session fixation) و کوکی امن می‌نویسد. */
export async function createSession(userId: string, roleKey: string | null) {
  const sid = randomBytes(32).toString("hex");
  await redis.set(`session:${sid}`, JSON.stringify({ userId, roleKey } satisfies SessionData), "EX", SESSION_TTL_SECONDS);
  cookies().set(COOKIE_NAME, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",   // در توسعه روی http هم باید کار کند
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return sid;
}

export async function destroySession() {
  const sid = cookies().get(COOKIE_NAME)?.value;
  if (sid) await redis.del(`session:${sid}`);
  cookies().delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionData | null> {
  const sid = cookies().get(COOKIE_NAME)?.value;
  if (!sid) return null;
  const raw = await redis.get(`session:${sid}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

/** کاربر جاری را با نقش و مجوزهایش برمی‌گرداند؛ برای صفحات و route handlerها. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId, deletedAt: null },
    include: { role: { include: { permissions: true } } },
  });
}

/** بررسی می‌کند نقش کاربر یک مجوز خاص را دارد؛ "*" یعنی مدیر ارشد. */
export function hasPermission(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  permissionKey: string
): boolean {
  if (!user?.role) return false;
  const keys = user.role.permissions.map((p) => p.key);
  return keys.includes("*") || keys.includes(permissionKey);
}

/** ساده — Redis-based fixed-window rate limiter. */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count <= max;
}

export { redis };
