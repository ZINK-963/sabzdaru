import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getPaymentGateway } from "@/lib/gateway";
import { restockOrder } from "@/lib/inventory";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * درگاه، مرورگر مشتری را با GET و چند query param به اینجا برمی‌گرداند. نتیجه هرگز از روی query
 * پذیرفته نمی‌شود؛ همیشه با فراخوان مستقیم سرور-به-سرور به درگاه تأیید می‌شود (gateway.verify).
 * مشتری در پایان به صفحهٔ SPA («#/order/:id») هدایت می‌شود، چون فرانت‌اند یک اپ تک‌صفحه‌ای است.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const appUrl = (process.env.APP_URL ?? url.origin).replace(/\/+$/, "");
  const to = (hash: string) => NextResponse.redirect(`${appUrl}/#/order/${hash}`);

  const gatewayRef = url.searchParams.get("gatewayRef") ?? url.searchParams.get("Authority");
  if (!gatewayRef) return to("none?reason=missing_ref");

  const payment = await prisma.payment.findFirst({ where: { gatewayRef }, orderBy: { createdAt: "desc" }, include: { order: true } });
  if (!payment) return to("none?reason=unknown_ref");
  if (["verified", "verified_late", "failed"].includes(payment.status)) return to(payment.orderId);   // رفرش/برگشت مرورگر: دوباره پردازش نمی‌شود

  // «ادعای» اتمیک: اگر دو callback هم‌زمان برسند فقط یکی برنده می‌شود (وگرنه موجودی دوبار برمی‌گشت)
  const claim = await prisma.payment.updateMany({ where: { id: payment.id, status: "initiated" }, data: { status: "processing" } });
  if (claim.count === 0) return to(payment.orderId);

  let result: { success: boolean; refId?: string };
  try {
    result = await getPaymentGateway().verify({ gatewayRef, amount: payment.amount, query: Object.fromEntries(url.searchParams.entries()) });
  } catch (err) {
    console.error("payment verify failed", err);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "initiated" } });   // ادعا را پس بده تا دوباره قابل تلاش باشد
    return to("none?reason=verify_error");
  }

  const proposedStatus = result.success ? "PAID" : "PAYMENT_FAILED";
  let finalStatus = payment.order.status;
  let latePayment = false;
  try {
    await prisma.$transaction(async (tx) => {
    // Compare-and-set: if the expiry cron or another callback already changed the order,
    // never overwrite that state or restock inventory a second time.
    const transition = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING_PAYMENT" },
      data: { status: proposedStatus },
    });

    if (transition.count === 1) {
      finalStatus = proposedStatus;
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: result.success ? "verified" : "failed", rawResponse: { refId: result.refId ?? null } },
      });
      await tx.orderEvent.create({ data: { orderId: payment.orderId, from: "PENDING_PAYMENT", to: proposedStatus, actorType: "gateway" } });
      if (result.success) {
        await notifyUser(tx, payment.order.userId, `پرداخت سفارش ${payment.order.number} تأیید شد`, "سفارش شما ثبت و در صف پردازش قرار گرفت.");
      } else {
        // Only restock if this callback won the pending -> failed transition.
        await restockOrder(tx, payment.orderId, "payment_failed");
        await notifyUser(tx, payment.order.userId, `پرداخت سفارش ${payment.order.number} ناموفق بود`, "مبلغی از حساب شما کسر نشده است.");
      }
      return;
    }

    const current = await tx.order.findUnique({ where: { id: payment.orderId }, select: { status: true } });
    finalStatus = current?.status ?? payment.order.status;
    if (result.success) {
      // A real payment arrived after the order had been cancelled/failed/paid. Do not
      // reopen it or sell already-restocked stock; record a refund task for manual review.
      latePayment = true;
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "verified_late", rawResponse: { refId: result.refId ?? null, orderStatusAtCallback: finalStatus } },
      });
      await tx.refund.create({ data: {
        paymentId: payment.id, orderId: payment.orderId, amount: payment.amount,
        reason: finalStatus === "PAID" ? "duplicate_payment" : "late_payment",
        status: "pending", note: "پرداخت پس از تغییر وضعیت سفارش تأیید شد؛ بازپرداخت دستی در پنل درگاه لازم است.",
      } });
      await notifyUser(tx, payment.order.userId, `بررسی پرداخت سفارش ${payment.order.number}`, "پرداخت دریافت شده اما وضعیت سفارش قبلاً تغییر کرده است. پشتیبانی باید بازپرداخت را بررسی کند.");
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed", rawResponse: { refId: result.refId ?? null } } });
      // Expiry/cancellation already returned stock, so do not restock again.
    }
    });
  } catch (err) {
    console.error("payment callback transaction failed", err);
    await prisma.payment.updateMany({ where: { id: payment.id, status: "processing" }, data: { status: "initiated" } }).catch(() => undefined);
    return to("none?reason=process_error");
  }

  await logAudit({ actorId: null, actorRole: "gateway", action: latePayment ? "payment.late_success" : "payment.callback", entity: "Order", entityId: payment.orderId, before: { status: payment.order.status }, after: { status: finalStatus, paymentSuccess: result.success, refundReviewRequired: latePayment } });
  return to(payment.orderId);
}
