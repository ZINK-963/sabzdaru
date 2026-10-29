import type { TxClient } from "./pricing";

/** اعلان درون‌برنامه‌ای برای یک کاربر (برای سفارش مهمان userId نیست و چیزی ساخته نمی‌شود) */
export async function notifyUser(tx: TxClient, userId: string | null | undefined, title: string, body: string, type = "order") {
  if (!userId) return;
  await tx.notification.create({ data: { userId, type, title, body } });
}
