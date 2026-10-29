import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gatewayKind, getPaymentGateway } from "@/lib/gateway";
import { rateLimit } from "@/lib/session";
import { handle, HttpError, json, parse, readJson } from "@/lib/http";

const schema = z.object({ orderId: z.string(), simulate: z.enum(["success", "fail"]).optional() });

export const POST = handle(async (req: NextRequest) => {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await rateLimit(`payinit:${ip}`, 60, 3600))) throw new HttpError(429, "تعداد درخواست‌ها بیش از حد مجاز است");
  const body = parse<z.infer<typeof schema>>(schema, await readJson(req));

  const order = await prisma.order.findUnique({ where: { id: body.orderId } });
  if (!order) throw new HttpError(404, "سفارش پیدا نشد");
  if (order.status !== "PENDING_PAYMENT") throw new HttpError(409, "این سفارش دیگر در انتظار پرداخت نیست");

  const appUrl = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
  const kind = gatewayKind();
  let result;
  try {
    result = await getPaymentGateway().initiate({
      orderId: order.id, amount: order.total, callbackUrl: `${appUrl}/api/payments/callback`,
      description: `پرداخت سفارش ${order.number}`, simulate: body.simulate,
    });
  } catch (err) {
    console.error("payment initiate failed", err);
    throw new HttpError(502, "شروع پرداخت با خطا مواجه شد");
  }

  // callback همین رکورد را به‌روز می‌کند (نه رکورد تازه) — همین‌جا idempotency شروع می‌شود
  await prisma.payment.create({
    data: { orderId: order.id, gateway: kind, amount: order.total, status: "initiated", gatewayRef: result.gatewayRef, idempotencyKey: `${kind}:${result.gatewayRef}` },
  });
  return json({ redirectUrl: result.redirectUrl });
});
