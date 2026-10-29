/** از کدام وضعیت به کدام وضعیت مجاز است — جلوگیری از پرش‌های بی‌معنی (مثلاً مستقیم از «در انتظار پرداخت» به «تحویل‌شده») */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["PACKING", "CANCELLED"],
  PACKING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "DELIVERY_FAILED"],
  DELIVERED: ["RETURN_REQUESTED"],
  DELIVERY_FAILED: ["PROCESSING", "CANCELLED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  RETURNED: ["REFUNDED"],
  PAYMENT_FAILED: ["CANCELLED"],
  CANCELLED: [],
  REFUNDED: [],
};
/** این وضعیت‌ها یعنی کالا واقعاً به فروشگاه برمی‌گردد → موجودی باید افزایش پیدا کند */
export const RESTOCK_ON = new Set(["CANCELLED", "RETURNED"]);
