# قرارداد API سبزدارو

این سند مرجع واحدِ ارتباط فرانت‌اند و بک‌اند است. دو پیاده‌سازی از آن پیروی می‌کنند:

| پیاده‌سازی | مسیر | وضعیت |
|---|---|---|
| **Next.js + Prisma + PostgreSQL + Redis** (production) | `backend/app/api/**` | نوشته و با TypeScript بررسی شده؛ **روی دیتابیس واقعی اجرا نشده** |
| **dev-server** (حافظه، بدون وابستگی) | `backend/dev-server/server.js` | **اجرا و تست‌شده**: ۸۶ assertion روی HTTP + ۵۴ سناریوی مرورگر |

اگر رفتار route واقعی با dev-server فرق کرد، dev-server مرجع است و route باگ دارد.

## قراردادهای کلی
- JSON؛ مبالغ **تومان** (عدد صحیح). خطا: `{ "error": "پیام فارسی", ...اطلاعات اضافه }`
- نشست: کوکی `sd_session` (HttpOnly، SameSite=Lax؛ `Secure` فقط در production). **فرانت‌اند و API باید هم‌مبدأ باشند** (بک‌اند فرانت‌اند را از `public/` سرو می‌کند).
- وضعیت‌ها: `400` ورودی نامعتبر · `401` ورود لازم · `403` مجوز کافی نیست · `404` · `409` تعارض (موجودی، انتقال وضعیت غیرمجاز) · `429` rate limit · `502` درگاه
- سمت **سرور** تصمیم می‌گیرد: قیمت و مجموع، تخفیف، موجودی، انتقال وضعیت، مجوزها. کلاینت فقط سبد خرید (و علاقه‌مندی‌های مهمان) را نگه می‌دارد.
- هر mutation زیر `/api/me*` **عکس کامل حساب** را برمی‌گرداند (`snapshot`)؛ فرانت‌اند slice هایش را جایگزین می‌کند.

## عمومی
| متد و مسیر | بدنه → پاسخ |
|---|---|
| `GET /api/health` | `{ok:true, service:"sabzdaru", gateway, sms}` — فرانت با این «حالت زنده» را تشخیص می‌دهد |
| `GET /api/storefront` | `{categories[{slug,name,attributes[{key,label,options}]}], brands[{id,name,desc}], products[UIProduct], articles, shipping[{id,name,days,fee,freeAbove}], freeShippingAbove}` |
| `GET /api/products/:slug` | جزئیات + نظرهای تأییدشده + موجودی/انقضای واریانت |
| `POST /api/checkout/quote` | `{lines[{variantId,quantity≤20}], couponCode?, shippingMethodId?}` → `{items, issues[{variantId,message}], subtotal, savings, discount, shippingFee, total, couponError}` (مشکلات گزارش می‌شوند، پرتاب نمی‌شوند) |
| `POST /api/checkout/place` | `{cartId, lines, couponCode?, shippingMethodId, address{province,city,line≥10,postalCode(10 رقم)}, customer{name≥3,phone,email?}}` → `{orderId, orderNumber, total}` · `409` ناموجود (با `variantId`) · `400` کوپن/ورودی. موجودی همین‌جا کم می‌شود. |
| `POST /api/payments/initiate` | `{orderId, simulate?:"fail"}` (simulate فقط درگاه آزمایشی) → `{redirectUrl}` · `409` اگر سفارش در انتظار پرداخت نیست |
| `GET /api/payments/callback` | بازگشت مرورگر از درگاه؛ نتیجه را **سرور با درگاه تأیید می‌کند** → `302 /#/order/:id`. idempotent؛ پرداخت ناموفق موجودی را برمی‌گرداند |
| `GET /api/orders/:id` | وضعیت سفارش با شناسهٔ غیرقابل‌حدس، بدون اطلاعات مشتری |
| `POST /api/reviews` | ورود لازم · `{productId, rating 1–5, body≥10}` → `{ok, pending:true}` (تا تأیید مدیر نمایش داده نمی‌شود) |
| `POST /api/reviews/:id/helpful` · `POST /api/restock-alerts` · `POST /api/newsletter` | |
| `POST /api/auth/otp` · `/verify` · `/logout` | کاربر تازه باید `name` هم بفرستد؛ **کد تا ثبت‌نام کامل نشود مصرف نمی‌شود** |

## حساب (ورود لازم) — پاسخ همهٔ آن‌ها `snapshot` است
`GET/PATCH/DELETE /api/me` · `POST /api/me/addresses` · `DELETE /api/me/addresses/:id` · `POST /api/me/lists` · `PATCH|DELETE /api/me/lists/:id` · `POST /api/me/routines` · `DELETE /api/me/routines/:id` · `PUT|DELETE /api/me/favorites/:productId` · `POST /api/me/notifications/read` · `POST /api/me/orders/:ref/cancel` (PAID/PROCESSING/PACKING) · `POST /api/me/orders/:ref/return` (DELIVERED) · `POST /api/me/tickets` · `POST /api/me/tickets/:id/reply`

`snapshot = {user{id,name,phone,email,role{key,name,permissions[]}|null}, prefs, addresses, lists, routines, favs[productId], notifs, orders[UIOrder], tickets}`

## مدیریت (نقش + مجوز؛ هم middleware هم خود route چک می‌کنند)
| مجوز | مسیرها |
|---|---|
| `products.write` | `GET/POST /api/admin/products` · `PATCH/DELETE /api/admin/products/:id` (DELETE = برداشتن نرم از ویترین) |
| `inventory.write` | `GET /api/admin/inventory` · `PATCH /api/admin/inventory/:variantId {delta, reason}` |
| `orders.write` | `GET /api/admin/orders` · `GET/PATCH /api/admin/orders/:idOrNumber {status}` (جدول انتقال: `lib/order-transitions.ts`) |
| `customers.read` | `GET /api/admin/customers` |
| `promos.write` | `GET/POST /api/admin/promos` · `PATCH /api/admin/promos/:idOrCode` |
| `reviews.moderate` | `GET /api/admin/reviews` · `PATCH|DELETE /api/admin/reviews/:id` |
| `tickets.write` | `GET /api/admin/tickets` · `PATCH /api/admin/tickets/:id {status?, reply?, internal?}` |
| `content.write` / `analytics.read` / `audit.read` | مقالات · آمار · لاگ ممیزی (فقط خواندنی) |

نقش‌ها: `super` (`*`)، `store`، `inv`، `support`، `content`، `finance` — `lib/roles.ts`.

## داخلی
`POST /api/internal/cron/expire-orders` با هدر `x-cron-secret` — سفارش‌های پرداخت‌نشده‌ی قدیمی‌تر از ۳۰ دقیقه را لغو و موجودی را برمی‌گرداند (**هر ۵ دقیقه صدایش بزنید**).
