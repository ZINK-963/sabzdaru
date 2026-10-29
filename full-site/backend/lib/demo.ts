/** داده‌های نمایشی (isDemo) در production نباید دیده یا فروخته شوند، حتی اگر اشتباهاً seed شده باشند. */
export const hideDemo = () => process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_DATA !== "1";
export const notDemo = () => (hideDemo() ? { isDemo: false } : {});
