# سبزدارو — Backend

این پروژه دو روش اجرا دارد؛ این دو را با هم اشتباه نگیرید:

- **دمو و تست قرارداد API**: `node backend/dev-server/server.js` از ریشهٔ پروژه؛ فقط Node.js لازم دارد، OTP را در کنسول چاپ می‌کند و از فایل JSON استفاده می‌کند. برای گرفتن پول یا فروش واقعی استفاده نشود.
- **نسخهٔ واقعی**: Next.js + Prisma + PostgreSQL + Redis؛ فرانت‌اند از همین دامنه سرو می‌شود و نشست با کوکی امن نگه‌داری می‌شود.

## اجرای نسخهٔ واقعی در توسعه

```bash
cd backend
npm install
cp .env.example .env
# DATABASE_URL و REDIS_URL را با سرویس‌های محلی خود هماهنگ کنید.
npx prisma generate
```

برای دیتابیس خالی، migration اولیه باید یک بار تولید شود؛ روش امن آن در [`../DEPLOY-PRODUCTION.md`](../DEPLOY-PRODUCTION.md) آمده است. پس از آن:

```bash
npm run prisma:migrate:deploy
npm run seed
npm run dev
```

## انتشار واقعی

راهنمای کامل پیش‌نیازها، محیط، migration، درگاه، پیامک، cron، پشتیبان‌گیری و تست پذیرش در فایل [`../DEPLOY-PRODUCTION.md`](../DEPLOY-PRODUCTION.md) است.

قبل از انتشار، روی سرور واقعی اجرا کنید:

```bash
npm run preflight:production
npm run typecheck
npm test
npm run build
```

`preflight:production` مقادیر `.env` را بدون چاپ کلیدهای محرمانه بررسی می‌کند. این ابزار جای تست اتصال DB/Redis یا تراکنش واقعی بانک و پیامک را نمی‌گیرد.

## آزمایش‌هایی که داخل بسته وجود دارند

از ریشهٔ پروژه:

```bash
node tests-e2e/api_test.js
```

این تست‌ها روی dev-server حافظه‌ای/فایلی هستند و اجرای مسیرهای Next.js/Prisma روی PostgreSQL واقعی را اثبات نمی‌کنند. مسیرهای واقعی، درگاه زرین‌پال و کاوه‌نگار باید بعد از راه‌اندازی محیط واقعی آزمایش شوند.
