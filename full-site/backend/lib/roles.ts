/** نقش‌ها و مجوزهایشان — seed و نمایش لاگ ممیزی از همین‌جا می‌خوانند */
export const ROLE_NAMES: Record<string, string> = {
  super: "مدیر ارشد", store: "مدیر فروشگاه", inv: "مدیر انبار", support: "پشتیبانی", content: "مدیر محتوا", finance: "مدیر مالی",
};
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super: ["*"],
  store: ["products.write", "shipping.write", "orders.write", "customers.read", "promos.write", "content.write", "reviews.moderate", "analytics.read"],
  inv: ["inventory.write", "products.write"],
  support: ["orders.write", "customers.read", "tickets.write", "reviews.moderate"],
  content: ["content.write"],
  finance: ["orders.write", "analytics.read", "promos.write"],
};
