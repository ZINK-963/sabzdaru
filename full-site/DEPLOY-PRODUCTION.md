# سبزدارو — راهنمای انتشار واقعی

این راهنما برای اجرای نسخهٔ **Next.js + Prisma** است. `backend/dev-server/server.js` فقط دمو است و نباید برای دریافت سفارش و پول واقعی استفاده شود.

## پیش‌نیازها

- سرور لینوکس با Node.js 20 یا بالاتر، PostgreSQL و Redis؛ یا معادل managed آن‌ها.
- دامنه متصل به سرور و HTTPS فعال.
- حساب درگاه واقعی و شناسهٔ پذیرندهٔ زرین‌پال.
- سرویس/قالب تأییدشدهٔ OTP در کاوه‌نگار.
- اطلاعات محصول، موجودی واقعی و مجوزهای لازم متناسب با کالاهای قابل فروش.

## ۱) تنظیم محیط

داخل `backend` از `.env.example` یک فایل محلی با نام `.env` بساز و این مقادیر را با دادهٔ واقعی جایگزین کن:

- `DATABASE_URL`: آدرس PostgreSQL
- `REDIS_URL`: آدرس Redis
- `APP_URL`: دامنهٔ نهایی با `https://`
- `ADMIN_PHONE`: شماره‌ای که باید مدیر ارشد باشد
- `CRON_SECRET`: راز تصادفی حداقل ۳۲ کاراکتری
- `PAYMENT_GATEWAY=zarinpal` و `ZARINPAL_MERCHANT_ID`
- `SMS_PROVIDER=kavenegar`، `KAVENEGAR_API_KEY` و `KAVENEGAR_OTP_TEMPLATE`
- `NODE_ENV=production`

`POSTGRES_PASSWORD` فقط برای Compose آمده است. اگر PostgreSQL را جداگانه مدیریت می‌کنی، رمز آن باید با `DATABASE_URL` یکسان باشد. هیچ فایل `.env` یا کلید واقعی را داخل ZIP عمومی، Git یا پیام عمومی قرار نده.

برای ساخت رازها می‌توانی روی سرور اجرا کنی:

```bash
openssl rand -hex 32
```

## ۲) نصب، ساخت migration اولیه و دیتابیس

```bash
cd /path/to/full-site/backend
npm install
npx prisma generate
```

در این بسته هنوز migration اولیه تولید نشده است. فقط برای دیتابیس **کاملاً خالی و تازه‌ساخته‌شده**، پس از پشتیبان‌گیری/تأیید خالی بودن دیتابیس، migration را تولید کن:

```bash
CONFIRM_EMPTY_DATABASE=YES npm run migration:initial
```

در Windows PowerShell:

```powershell
$env:CONFIRM_EMPTY_DATABASE="YES"
npm run migration:initial
```

این دستور SQL را از `schema.prisma` با Prisma CLI تولید می‌کند و از بازنویسی migrationهای موجود خودداری می‌کند. پوشهٔ `backend/prisma/migrations/` را در نسخهٔ پروژه نگه دار. برای انتشارهای بعدی، migration جدید را در محیط توسعه بساز، بازبینی و commit کن؛ این دستور «از صفر» را روی دیتابیس حاوی اطلاعات اجرا نکن.

بعد از تولید migration:

```bash
npm run prisma:migrate:deploy
npm run seed
npm run preflight:production
npm run typecheck
npm test
npm run build
npm start
```

`npm run seed` فقط ساختار پایه، نقش‌ها، روش‌های ارسال و مدیر ارشد را آماده می‌کند؛ **محصولات نمونه را عمداً وارد production نمی‌کند**. کالاها، قیمت‌ها، موجودی و تصاویر واقعی باید از پنل مدیریت یا فرآیند ورود داده اضافه شوند. هزینه و عنوان روش‌های ارسال seed هم نمونه است و قبل از فروش باید اصلاح شود.

## ۳) روش جایگزین: Docker Compose

برای سرور لینوکسی که Docker و Docker Compose دارد، فایل `docker-compose.yml` سرویس‌های PostgreSQL، Redis و اپ را تعریف می‌کند. سرویس‌ها فقط پورت 3000 را روی `127.0.0.1` منتشر می‌کنند؛ Nginx باید درخواست‌های دامنه را به آن بفرستد.

پیش از ساخت image، مرحلهٔ `npm install`، `npx prisma generate` و تولید migration اولیه در بخش قبل را روی همین نسخهٔ سورس اجرا کن و پوشهٔ `backend/prisma/migrations/` را نگه دار. سپس از ریشهٔ پروژه اجرا کن:

```bash
docker compose --env-file backend/.env build
docker compose --env-file backend/.env up -d postgres redis
docker compose --env-file backend/.env run --rm app npm run prisma:migrate:deploy
docker compose --env-file backend/.env run --rm app npm run seed
docker compose --env-file backend/.env up -d app
docker compose --env-file backend/.env exec app npm run preflight:production
```

در `backend/.env`، `POSTGRES_PASSWORD` و `REDIS_PASSWORD` را با دو رمز تصادفی جداگانه پر کن. Compose این دو رمز را می‌گیرد و آدرس اتصال داخلی سرویس‌ها را برای اپ override می‌کند. اگر migration اولیه داخل سورس وجود نداشته باشد، مرحلهٔ `migrate deploy` عمداً کار نمی‌کند؛ migration را روی دیتابیس تولیدیِ دارای اطلاعات از صفر نساز.

## ۴) دامنه، HTTPS و اجرای دائمی


از یک مدیر فرایند یا سرویس سیستم‌عامل استفاده کن تا برنامه بعد از خروج SSH یا ری‌استارت سرور خاموش نشود. جلوی برنامه یک reverse proxy مانند Nginx قرار بده، دامنه را به پورت داخلی برنامه وصل کن و HTTPS را فعال کن. پورت PostgreSQL و Redis را عمومی نکن؛ فقط روی localhost یا شبکهٔ خصوصی قابل‌دسترسی باشند.

## ۵) cron مهم سفارش‌ها

هر ۵ دقیقه باید سفارش‌های پرداخت‌نشدهٔ منقضی‌شده آزاد شوند. در crontab کاربر اجرای برنامه این خط را اضافه کن (مسیر `cd` را با مسیر واقعی جایگزین کن):

```cron
*/5 * * * * cd /path/to/full-site/backend && /usr/bin/node scripts/expire-orders-cron.js >> /var/log/sabzdaru-order-cron.log 2>&1
```

این اسکریپت `APP_URL` و `CRON_SECRET` را از `backend/.env` می‌خواند؛ کلید را در خط cron ننویس.

## ۶) تست پذیرش قبل از باز کردن فروشگاه

1. `npm run preflight:production` بدون خطا تمام شود.
2. `npm run typecheck` و `npm test` موفق باشند و `npm run build` کامل شود.
3. `GET /api/health` پاسخ سالم بدهد (دیتابیس و Redis در دسترس‌اند).
4. ورود با پیامک واقعی به شمارهٔ خودت بررسی شود.
5. پرداخت واقعی با مبلغ کم یا حالت آزمایشی رسمی درگاه، callback و کد رهگیری از ابتدا تا انتها بررسی شود؛ هیچ‌گاه درگاه `sample` را در production فعال نکن.
6. سفارش ناموفق، سفارش منقضی، موجودی، کوپن و نمایش سفارش در پنل مدیر آزمایش شوند.
7. پشتیبان‌گیری PostgreSQL انجام شود و یک بازیابی آزمایشی هم انجام شود.
8. محصولات، قیمت‌ها، هزینه‌های ارسال، اطلاعات تماس، قوانین مرجوعی/حریم خصوصی و مجوزهای لازم بازبینی شوند.

## محدودیت‌های شناخته‌شده قبل از فروش

- درگاه واقعی و پیامک واقعی از این محیط قابل تأیید نیستند؛ باید با حساب‌های خود فروشگاه آزمایش شوند.
- اگر پرداخت واقعی بعد از منقضی/لغوشدن سفارش تأیید شود، سیستم رویداد را ثبت می‌کند و یک رکورد `Refund` با وضعیت `pending` می‌سازد؛ **بازپرداخت خودکار انجام نمی‌شود** و مدیر باید آن را در پنل درگاه بررسی و ثبت کند.
- اعلان‌های فعلی حساب کاربری، اعلان درون‌برنامه‌ای هستند؛ ارسال پیامک OTP متصل است ولی ارسال خودکار پیامک برای هر تغییر وضعیت سفارش، worker مستقلی لازم دارد.
- نظرات، محصولات، برندها و قیمت‌های موجود در دمو واقعی نیستند. از `SEED_DEMO=1`، `ALLOW_DEMO_DATA=1` یا `ALLOW_DEMO_SEED=1` در production استفاده نکن.
