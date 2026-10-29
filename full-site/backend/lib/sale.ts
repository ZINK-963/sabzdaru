/* بدون وابستگی عمداً: منطق خالص قیمت، قابل تست بدون Next/Prisma */
/** قیمت حراج فقط داخل بازهٔ saleFrom..saleUntil معتبر است */
export function effectiveSale(v: { salePrice: number | null; saleFrom?: Date | null; saleUntil?: Date | null }, now = new Date()): number | null {
  if (v.salePrice == null) return null;
  if (v.saleFrom && v.saleFrom > now) return null;
  if (v.saleUntil && v.saleUntil < now) return null;
  return v.salePrice;
}

