import type { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "./http";
import { hideDemo } from "./demo";

export type TxClient = Prisma.TransactionClient | PrismaClient;

export class OutOfStockError extends HttpError {
  constructor(public variantId: string, available: number, requested: number) {
    super(409, `موجودی کافی نیست: ${available} عدد موجود، ${requested} عدد درخواست شده`, { variantId });
  }
}
export class UnsellableBatchError extends HttpError {
  constructor(variantId: string, reason: "expired" | "recalled") {
    super(409, `این کالا فعلاً قابل فروش نیست (${reason === "expired" ? "منقضی" : "فراخوان‌شده"})`, { variantId });
  }
}
export class InvalidCouponError extends HttpError {
  constructor(message: string) { super(400, message); }
}

export { effectiveSale } from "./sale";
import { effectiveSale } from "./sale";

const sellableBatch = (now: Date) => ({ recalledAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

/** موجودی قابل فروش چند واریانت با ۲ کوئری (نه N کوئری): batchهای سالم − رزروهای فعال */
export async function stockMap(tx: TxClient, variantIds: string[]): Promise<Record<string, number>> {
  const now = new Date();
  const out: Record<string, number> = {};
  variantIds.forEach((id) => (out[id] = 0));
  if (!variantIds.length) return out;
  const [onHand, reserved] = await Promise.all([
    tx.batch.groupBy({ by: ["variantId"], where: { variantId: { in: variantIds }, ...sellableBatch(now) }, _sum: { quantity: true } }),
    tx.stockReservation.groupBy({ by: ["variantId"], where: { variantId: { in: variantIds }, expiresAt: { gt: now } }, _sum: { quantity: true } }),
  ]);
  onHand.forEach((r: any) => (out[r.variantId] = r._sum.quantity ?? 0));
  reserved.forEach((r: any) => (out[r.variantId] = (out[r.variantId] ?? 0) - (r._sum.quantity ?? 0)));
  return out;
}
export async function availableStock(tx: TxClient, variantId: string): Promise<number> {
  return (await stockMap(tx, [variantId]))[variantId] ?? 0;
}

/** رد می‌کند اگر همهٔ batchهای این واریانت منقضی یا فراخوان‌شده باشند */
export async function assertBatchSellable(tx: TxClient, variantId: string) {
  const sellable = await tx.batch.findFirst({ where: { variantId, ...sellableBatch(new Date()) } });
  if (!sellable) {
    const any = await tx.batch.findFirst({ where: { variantId } });
    throw new UnsellableBatchError(variantId, any?.recalledAt ? "recalled" : "expired");
  }
}

/** اعتبارسنجی کوپن بدون پرتاب خطا: {discount, error, coupon} — پیام‌ها همان‌هایی‌اند که فرانت نشان می‌دهد */
export async function checkCoupon(tx: TxClient, code: string | undefined | null, subtotal: number, userId?: string | null) {
  if (!code) return { discount: 0, error: null as string | null, coupon: null as any };
  const coupon = await tx.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  let error: string | null = null;
  if (!coupon || (hideDemo() && coupon.isDemo)) error = "کد تخفیف نامعتبر است";
  else if (!coupon.active) error = coupon.endsAt && coupon.endsAt < now ? "این کد منقضی شده" : "این کد فعال نیست";
  else if (coupon.startsAt && coupon.startsAt > now) error = "این کد هنوز فعال نشده";
  else if (coupon.endsAt && coupon.endsAt < now) error = "این کد منقضی شده";
  else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) error = "ظرفیت استفاده از این کد تمام شده";
  else if (subtotal < coupon.minSubtotal) error = `حداقل خرید برای این کد ${coupon.minSubtotal.toLocaleString("fa-IR")} تومان است`;
  else if (userId && coupon.perUserLimit) {
    const used = await tx.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (used >= coupon.perUserLimit) error = "شما قبلاً از این کد استفاده کرده‌اید";
  }
  if (error || !coupon) return { discount: 0, error, coupon: null as any };
  const raw = coupon.type === "percent" ? Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount ?? Infinity) : coupon.value;
  return { discount: Math.round(raw), error: null as string | null, coupon };
}

type Line = { variantId: string; quantity: number };

async function shippingFor(tx: TxClient, methodId: string | undefined, payable: number) {
  if (!methodId) return 0;
  const m = await tx.shippingMethod.findUnique({ where: { id: methodId } });
  if (!m || !m.active) return 0;
  return m.freeAbove != null && payable >= m.freeAbove ? 0 : m.fee;
}

/**
 * مبالغ را کاملاً سمت سرور از نو حساب می‌کند (قیمت/تخفیفی که کلاینت فرستاده هرگز پذیرفته نمی‌شود).
 * برای ثبت سفارش: هر مشکلی پرتاب می‌شود.
 */
export async function computeTotals(tx: TxClient, lines: Line[], opts: { couponCode?: string; userId?: string | null; shippingMethodId?: string }) {
  const variants = await tx.productVariant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: { product: { include: { brand: true } } },
  });
  let subtotal = 0;
  const snapshots = lines.map((line) => {
    const v = variants.find((x: any) => x.id === line.variantId);
    if (!v || (hideDemo() && v.product.isDemo)) throw new OutOfStockError(line.variantId, 0, line.quantity);
    const unitPrice = effectiveSale(v) ?? v.price;
    subtotal += unitPrice * line.quantity;
    return { variantId: v.id, productName: v.product.name, variantLabel: v.label, brandName: v.product.brand.name, sku: v.sku, quantity: line.quantity, unitPrice, discount: 0 };
  });
  const c = await checkCoupon(tx, opts.couponCode, subtotal, opts.userId);
  if (c.error) throw new InvalidCouponError(c.error);
  const shippingFee = await shippingFor(tx, opts.shippingMethodId, subtotal - c.discount);
  return { snapshots, subtotal, discount: c.discount, shippingFee, total: Math.max(0, subtotal - c.discount) + shippingFee, couponId: c.coupon?.id as string | undefined };
}

/** همان محاسبه برای سبد خرید: مشکلات (ناموجود، کوپن) گزارش می‌شوند، پرتاب نمی‌شوند */
export async function computeQuote(tx: TxClient, lines: Line[], opts: { couponCode?: string; userId?: string | null; shippingMethodId?: string }) {
  const variants = await tx.productVariant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: { product: true },
  });
  const stock = await stockMap(tx, lines.map((l) => l.variantId));
  const items: any[] = [], issues: { variantId: string; message: string }[] = [];
  let subtotal = 0, savings = 0;
  for (const l of lines) {
    const v = variants.find((x: any) => x.id === l.variantId);
    if (!v || !v.product.published || (hideDemo() && v.product.isDemo)) { issues.push({ variantId: l.variantId, message: "این کالا دیگر در دسترس نیست" }); continue; }
    const sale = effectiveSale(v), unit = sale ?? v.price, avail = stock[v.id] ?? 0;
    items.push({ variantId: v.id, productId: v.productId, name: v.product.name, variant: v.label, quantity: l.quantity, unitPrice: unit, was: v.price, available: avail });
    if (l.quantity > avail) issues.push({ variantId: v.id, message: avail <= 0 ? "ناموجود" : `فقط ${avail} عدد موجود است` });
    subtotal += unit * l.quantity;
    if (sale != null) savings += (v.price - sale) * l.quantity;
  }
  const c = await checkCoupon(tx, opts.couponCode, subtotal, opts.userId);
  const shippingFee = await shippingFor(tx, opts.shippingMethodId, subtotal - c.discount);
  return { items, issues, subtotal, savings, discount: c.discount, shippingFee, total: Math.max(0, subtotal - c.discount) + shippingFee, couponError: c.error };
}
