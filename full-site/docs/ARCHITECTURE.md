# سبزدارو — معماری Backend

این سند، لایهٔ سروری پلتفرم را تعریف می‌کند. اپلیکیشن منتشرشده همین منطق را سمت کلاینت اجرا می‌کند (با `localStorage` به‌جای دیتابیس)؛ این سند مسیر انتقال آن به یک سرور واقعی است.

**پشتهٔ پیشنهادی:** Next.js (App Router) + TypeScript · PostgreSQL + Prisma · Redis (session + rate limit) · S3-compatible object storage · Zod برای اعتبارسنجی.

---

## ۱. مدل داده (Prisma)

```prisma
// ── هویت و دسترسی ─────────────────────────────
model User {
  id            String    @id @default(cuid())
  phone         String    @unique
  email         String?   @unique
  name          String
  passwordHash  String?
  roleId        String?
  role          Role?     @relation(fields: [roleId], references: [id])
  addresses     Address[]
  orders        Order[]
  reviews       Review[]
  lists         ShoppingList[]
  routines      Routine[]
  tickets       Ticket[]
  notifications Notification[]
  prefs         Json      @default("{}")
  deletedAt     DateTime?           // حذف نرم برای §39
  createdAt     DateTime  @default(now())
  @@index([createdAt])
}

model Role {
  id          String       @id @default(cuid())
  key         String       @unique   // super | store | inv | support | content | finance
  name        String
  permissions Permission[]
  users       User[]
}

model Permission {
  id     String @id @default(cuid())
  key    String @unique              // products.write, orders.refund, audit.read …
  roles  Role[]
}

// ── کاتالوگ ───────────────────────────────────
model Category {
  id         String     @id @default(cuid())
  slug       String     @unique
  name       String
  parentId   String?
  parent     Category?  @relation("Tree", fields: [parentId], references: [id])
  children   Category[] @relation("Tree")
  position   Int        @default(0)
  attributes CategoryAttribute[]     // §9: فیلترها per-category
  products   Product[]
  seoTitle   String?
  seoDesc    String?
}

model CategoryAttribute {
  id         String   @id @default(cuid())
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  key        String                   // skinType | hairType | deviceType …
  label      String
  options    String[]
  filterable Boolean  @default(true)
  @@unique([categoryId, key])
}

model Brand {
  id       String    @id @default(cuid())
  slug     String    @unique
  name     String
  logoUrl  String?
  desc     String?
  products Product[]
}

model Manufacturer {
  id       String    @id @default(cuid())
  name     String
  country  String?
  products Product[]
}

model Product {
  id             String    @id @default(cuid())
  slug           String    @unique
  name           String
  categoryId     String
  category       Category  @relation(fields: [categoryId], references: [id])
  brandId        String
  brand          Brand     @relation(fields: [brandId], references: [id])
  manufacturerId String?
  manufacturer   Manufacturer? @relation(fields: [manufacturerId], references: [id])
  description    String?
  usage          String?                 // از اطلاعات رسمی تولیدکننده
  storage        String?
  warnings       String?
  ingredients    String?
  attributes     Json      @default("{}") // مقادیر CategoryAttribute
  published      Boolean   @default(false)
  variants       ProductVariant[]
  images         ProductImage[]
  reviews        Review[]
  createdAt      DateTime  @default(now())
  @@index([categoryId, published])
  @@index([brandId])
}

model ProductVariant {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku        String   @unique
  label      String                    // «۵۰ میلی‌لیتر»
  price      Int                       // ریال، عدد صحیح — هرگز float
  salePrice  Int?
  saleFrom   DateTime?
  saleUntil  DateTime?
  batches    Batch[]
  movements  InventoryMovement[]
  reservations StockReservation[]
  @@index([productId])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  alt       String                      // §42 الزامی
  position  Int     @default(0)
}

// ── انبار ─────────────────────────────────────
model Batch {
  id         String   @id @default(cuid())
  variantId  String
  variant    ProductVariant @relation(fields: [variantId], references: [id])
  code       String
  quantity   Int
  expiresAt  DateTime?
  recalledAt DateTime?                 // §24 فراخوان
  receivedAt DateTime @default(now())
  @@index([variantId, expiresAt])
}

model InventoryMovement {
  id        String   @id @default(cuid())
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  delta     Int                         // + ورود، − خروج
  reason    String                      // sale | return | manual | expiry | recall
  refId     String?                     // شناسهٔ سفارش
  actorId   String?
  createdAt DateTime @default(now())
  @@index([variantId, createdAt])
}

model StockReservation {
  id         String   @id @default(cuid())
  variantId  String
  variant    ProductVariant @relation(fields: [variantId], references: [id])
  quantity   Int
  cartId     String
  expiresAt  DateTime                   // رزرو ۱۵ دقیقه‌ای هنگام checkout
  @@index([expiresAt])
}

// ── سفارش و پرداخت ────────────────────────────
model Order {
  id            String    @id @default(cuid())
  number        String    @unique       // SD-100042
  userId        String?
  user          User?     @relation(fields: [userId], references: [id])
  status        OrderStatus @default(PENDING_PAYMENT)
  items         OrderItem[]
  events        OrderEvent[]
  payments      Payment[]
  subtotal      Int
  discount      Int       @default(0)
  shippingFee   Int       @default(0)
  total         Int
  couponCode    String?
  shippingMethodId String?
  addressSnapshot  Json                 // §35 عکس لحظه‌ای، نه رابطه
  customerSnapshot Json
  trackingCode  String?
  createdAt     DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([status])
}

enum OrderStatus {
  PENDING_PAYMENT PAID PROCESSING PACKING SHIPPED DELIVERED
  PAYMENT_FAILED CANCELLED RETURN_REQUESTED RETURNED DELIVERY_FAILED REFUNDED
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  order     Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId String?                     // ممکن است بعداً حذف شود
  // عکس لحظه‌ای — سفارش تاریخی حتی با تغییر کالا درست می‌ماند (§35)
  productName String
  variantLabel String
  brandName   String
  sku         String
  quantity    Int
  unitPrice   Int
  discount    Int @default(0)
}

model OrderEvent {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  from      String?
  to        String
  actorId   String?
  actorType String                      // customer | admin | gateway | system
  createdAt DateTime @default(now())
}

model Payment {
  id             String   @id @default(cuid())
  orderId        String
  order          Order    @relation(fields: [orderId], references: [id])
  gateway        String
  amount         Int
  status         String                 // initiated | verified | failed | refunded
  gatewayRef     String?
  idempotencyKey String   @unique       // §23 محافظت از callback تکراری
  rawResponse    Json?                  // بدون هیچ دادهٔ کارت
  createdAt      DateTime @default(now())
}

model Refund {
  id        String   @id @default(cuid())
  paymentId String
  amount    Int
  reason    String
  actorId   String
  createdAt DateTime @default(now())
}

// ── ارسال و تخفیف ─────────────────────────────
model ShippingZone   { id String @id @default(cuid()) name String provinces String[] methods ShippingMethod[] }
model ShippingMethod {
  id String @id @default(cuid())
  zoneId String
  zone ShippingZone @relation(fields: [zoneId], references: [id])
  name String
  fee Int
  etaDays String
  freeAbove Int?
  active Boolean @default(true)
}

model Coupon {
  id         String   @id @default(cuid())
  code       String   @unique
  type       String                     // percent | fixed
  value      Int
  maxDiscount Int?
  minSubtotal Int     @default(0)
  categoryIds String[]                  // محدودسازی به دسته
  productIds  String[]
  startsAt   DateTime?
  endsAt     DateTime?
  usageLimit Int?
  perUserLimit Int?
  usedCount  Int      @default(0)
  active     Boolean  @default(true)
  redemptions CouponRedemption[]
}

model CouponRedemption {
  id       String @id @default(cuid())
  couponId String
  coupon   Coupon @relation(fields: [couponId], references: [id])
  userId   String
  orderId  String
  @@unique([couponId, orderId])
}

// ── محتوا و تعامل ─────────────────────────────
model Review {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  rating     Int
  body       String
  verified   Boolean  @default(false)   // خرید تأییدشده
  status     String   @default("pending") // pending | approved | rejected
  helpful    Int      @default(0)
  adminReply String?
  createdAt  DateTime @default(now())
  @@unique([productId, userId])         // §28 جلوگیری از نظر تکراری
}

model ShoppingList { id String @id @default(cuid()) userId String user User @relation(fields:[userId],references:[id]) name String items Json @default("[]") }
model Routine      { id String @id @default(cuid()) userId String user User @relation(fields:[userId],references:[id]) name String steps Json @default("[]") }
model Address      { id String @id @default(cuid()) userId String user User @relation(fields:[userId],references:[id]) province String city String line String postalCode String isDefault Boolean @default(false) }

model Ticket {
  id        String @id @default(cuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id])
  subject   String
  category  String
  priority  String @default("normal")
  status    String @default("open")
  messages  TicketMessage[]
  createdAt DateTime @default(now())
}
model TicketMessage {
  id        String @id @default(cuid())
  ticketId  String
  ticket    Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  authorId  String?
  body      String
  internal  Boolean @default(false)     // یادداشت داخلی ادمین
  createdAt DateTime @default(now())
}

model Article {
  id        String   @id @default(cuid())
  slug      String   @unique
  title     String
  excerpt   String?
  body      String
  category  String
  tags      String[]
  authorId  String?
  coverUrl  String?
  readTime  Int
  seoTitle  String?
  seoDesc   String?
  publishedAt DateTime?
  reviewedBy String?                    // §31 بازبینی کارشناس
}

model Notification {
  id      String @id @default(cuid())
  userId  String
  user    User   @relation(fields: [userId], references: [id])
  type    String
  title   String
  body    String
  readAt  DateTime?
  createdAt DateTime @default(now())
}

model RestockAlert { id String @id @default(cuid()) variantId String email String createdAt DateTime @default(now()) @@unique([variantId, email]) }

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  actorRole String?
  action    String                      // price.change, order.status, coupon.toggle …
  entity    String
  entityId  String
  before    Json?
  after     Json?
  ip        String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@index([createdAt])
}
```

**قواعد ثابت:** همهٔ مبالغ `Int` (ریال) هستند — هیچ‌جا float. `OrderItem` عکس لحظه‌ای نگه می‌دارد تا سفارش تاریخی با تغییر یا حذف کالا خراب نشود. کاربر و کالا «حذف نرم» می‌شوند.

---

## ۲. قرارداد API

| متد | مسیر | توضیح |
|---|---|---|
| `POST` | `/api/auth/otp` · `/api/auth/verify` | ورود با کد یک‌بارمصرف؛ نشست در Redis، کوکی `HttpOnly; Secure; SameSite=Lax` |
| `GET` | `/api/products` | فیلتر، مرتب‌سازی، صفحه‌بندی؛ پارامترها با Zod اعتبارسنجی می‌شوند |
| `GET` | `/api/products/:slug` | شامل واریانت، تصاویر، نظرهای approved |
| `GET` | `/api/search?q=` | محصول + برند + دسته + مقاله |
| `POST` | `/api/cart/items` | **موجودی سمت سرور بررسی می‌شود** |
| `POST` | `/api/cart/coupon` | اعتبار کوپن فقط سمت سرور |
| `POST` | `/api/checkout/quote` | محاسبهٔ مجدد کامل مبالغ — قیمت ارسالی کلاینت هرگز پذیرفته نمی‌شود |
| `POST` | `/api/checkout/place` | تراکنش اتمیک: رزرو → سفارش → آغاز پرداخت |
| `POST` | `/api/payments/callback` | **idempotent** با `idempotencyKey`؛ callback تکراری وضعیت را تغییر نمی‌دهد |
| `GET/PATCH` | `/api/admin/*` | پشت middleware مجوز، هر نوشتن یک `AuditLog` می‌سازد |

### تراکنش ثبت سفارش

```ts
await prisma.$transaction(async (tx) => {
  for (const line of cart.items) {
    // قفل ردیف — جلوگیری از فروش هم‌زمان (§48 edge case)
    const [v] = await tx.$queryRaw`
      SELECT id, stock FROM "ProductVariant" WHERE id = ${line.variantId} FOR UPDATE`;
    const available = await availableStock(tx, v.id);   // موجودی − رزروهای فعال
    if (available < line.qty) throw new OutOfStock(line);
    await assertBatchSellable(tx, v.id);                // نه منقضی، نه فراخوان‌شده
  }
  const totals = await computeTotals(tx, cart);          // سرور محاسبه می‌کند
  const order  = await tx.order.create({ data: { ...totals, items: { create: snapshots } } });
  await tx.inventoryMovement.createMany({ data: movements });
  await tx.orderEvent.create({ data: { to: "PENDING_PAYMENT", actorType: "customer" } });
  return order;
}, { isolationLevel: "Serializable" });
```

### Idempotency پرداخت

```ts
const key = `${gatewayRef}:${orderId}`;
try {
  await prisma.payment.create({ data: { idempotencyKey: key, ... } });
} catch (e) {
  if (e.code === "P2002") return ok();   // callback تکراری — بی‌اثر
  throw e;
}
```

---

## ۳. امنیت (§۳۸)

- رمز عبور با **Argon2id**؛ OTP هش‌شده با انقضای ۲ دقیقه‌ای.
- نشست سمت سرور در Redis؛ کوکی `HttpOnly`، چرخش شناسه پس از ورود.
- CSRF: توکن double-submit روی همهٔ `POST/PATCH/DELETE`.
- XSS: خروجی React به‌صورت پیش‌فرض escape می‌شود؛ `dangerouslySetInnerHTML` ممنوع؛ CSP سخت‌گیرانه بدون `unsafe-inline`.
- SQL injection: فقط Prisma؛ هر `$queryRaw` با پارامتر.
- Rate limit در Redis: ورود ۵/دقیقه، جست‌وجو ۳۰/دقیقه، پرداخت ۱۰/ساعت.
- آپلود: فقط تصویر، اسکن نوع MIME واقعی، تغییر نام، ذخیره در object storage خارج از دامنهٔ اصلی.
- **هیچ اطلاعات کارتی دریافت یا ذخیره نمی‌شود.** تمام کلیدها در متغیر محیطی.
- هدرها: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## ۴. حریم خصوصی (§۳۹)

فقط نام، موبایل، نشانی و تاریخچهٔ سفارش نگهداری می‌شود. ترجیحات پوست/مو که کاربر در ابزار کشف وارد می‌کند **ذخیره نمی‌شوند** و فقط در همان درخواست برای فیلتر کاتالوگ به کار می‌روند — هیچ پروفایل سلامتی ساخته نمی‌شود و این داده‌ها به تبلیغات نمی‌روند. لاگ‌ها بدون PII. حذف حساب: حذف نرم + ناشناس‌سازی پس از ۳۰ روز، با حفظ سفارش‌ها برای الزامات مالی.

## ۵. SEO (§۳۴)

مسیرهای `/c/[slug]`، `/p/[slug]`، `/b/[slug]`، `/blog/[slug]`. `generateMetadata` برای title/description/OG. JSON-LD برای `Product`، `BreadcrumbList`، `Article` — بدون هیچ ادعای درمانی. صفحات فیلترشده `noindex` می‌گیرند و `canonical` به صفحهٔ دستهٔ اصلی اشاره می‌کند. `sitemap.xml` و `robots.txt` پویا.

## ۶. استقرار

- محیط‌ها: `development` → `staging` → `production`، هر کدام با دیتابیس جدا.
- `prisma migrate deploy` در مرحلهٔ release، نه در build.
- پشتیبان‌گیری: snapshot روزانه + WAL پیوسته؛ **بازیابی هر ماه آزمایش شود.**
- سلامت: `/api/health` (دیتابیس، Redis، درگاه). لاگ ساخت‌یافتهٔ JSON. Sentry برای خطا.
- بازگشت: نسخهٔ قبلی برگردانده شود؛ مهاجرت‌ها باید رو به عقب سازگار باشند (ستون را اول اضافه کن، بعد پر کن، بعد قدیمی را حذف کن).

---

## ۷. وضعیت پیاده‌سازی — صادقانه

| بخش | وضعیت |
|---|---|
| سیستم طراحی، صفحهٔ اصلی، دسته، محصول، سبد، پرداخت، حساب، پنل مدیریت | **پیاده‌سازی و تست‌شده** در اپلیکیشن منتشرشده |
| موجودی، کوپن، وضعیت سفارش، RBAC، لاگ تغییرات | **پیاده‌سازی‌شده** با منطق واقعی — اما سمت کلاینت |
| دیتابیس، API، احراز هویت سروری | **طراحی‌شده در همین سند؛ هنوز اجرا نشده** |
| درگاه پرداخت، پیامک، ایمیل | **نیازمند اعتبارنامهٔ خارجی** — شبیه‌سازی‌شده |
| همهٔ برندها، قیمت‌ها، نظرها، اطلاعات محصول | **دادهٔ نمونه و ساختگی** |

این پلتفرم **آمادهٔ production نیست** و تا وقتی موارد ردیف سوم و چهارم اجرا و آزموده نشده‌اند، نباید چنین ادعایی شود.
