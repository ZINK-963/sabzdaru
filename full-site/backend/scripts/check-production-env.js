#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const fileEnv = readEnvFile(path.resolve(__dirname, '..', '.env'));
const env = { ...fileEnv, ...process.env };
const errors = [];
const isSet = (key) => typeof env[key] === 'string' && env[key].trim().length > 0;

if (Number(process.versions.node.split('.')[0]) < 20) errors.push('نسخه Node.js باید 20 یا بالاتر باشد.');
if (env.NODE_ENV !== 'production') errors.push('NODE_ENV باید دقیقاً production باشد.');
if (!isSet('DATABASE_URL') || !/^postgres(ql)?:\/\//i.test(env.DATABASE_URL || '') || /replace.?with|example|user:password/i.test(env.DATABASE_URL || '')) errors.push('DATABASE_URL باید به PostgreSQL واقعی و با رمز واقعی اشاره کند.');
if (!isSet('REDIS_URL') || !/^rediss?:\/\//i.test(env.REDIS_URL || '')) errors.push('REDIS_URL باید به Redis واقعی اشاره کند.');
if (env.DEPLOYMENT_MODE === 'compose') {
  if (!isSet('POSTGRES_PASSWORD') || env.POSTGRES_PASSWORD.length < 24 || /replace|example|password/i.test(env.POSTGRES_PASSWORD)) errors.push('POSTGRES_PASSWORD را با یک رمز تصادفی قوی عوض کن (برای Compose الزامی است).');
  if (!isSet('REDIS_PASSWORD') || env.REDIS_PASSWORD.length < 24 || /replace|example|password/i.test(env.REDIS_PASSWORD)) errors.push('REDIS_PASSWORD را با یک رمز تصادفی جداگانه عوض کن (برای Compose الزامی است).');
}
try {
  const u = new URL(env.APP_URL || '');
  if (u.protocol !== 'https:' || !u.hostname || u.hostname.includes('example') || u.pathname !== '/' || u.username || u.password) errors.push('APP_URL باید فقط دامنهٔ واقعی با HTTPS باشد، بدون مسیر اضافه.');
} catch { errors.push('APP_URL معتبر نیست؛ نمونهٔ https://shop.example.com را با دامنهٔ واقعی عوض کنید.'); }
if (!/^09\d{9}$/.test(env.ADMIN_PHONE || '') || env.ADMIN_PHONE === '09120000000') errors.push('ADMIN_PHONE باید شمارهٔ واقعی مدیر باشد، نه شمارهٔ نمونهٔ پروژه.');
if (!isSet('CRON_SECRET') || env.CRON_SECRET.length < 32 || /change.?me|replace.?me|example/i.test(env.CRON_SECRET)) errors.push('CRON_SECRET باید یک راز تصادفی و حداقل ۳۲ کاراکتری باشد.');
if (env.PAYMENT_GATEWAY !== 'zarinpal') errors.push('PAYMENT_GATEWAY باید zarinpal باشد؛ درگاه sample برای فروش واقعی ممنوع است.');
if (!isSet('ZARINPAL_MERCHANT_ID') || /replace|example|your-/i.test(env.ZARINPAL_MERCHANT_ID)) errors.push('ZARINPAL_MERCHANT_ID باید از حساب واقعی درگاه وارد شود.');
if (env.SMS_PROVIDER !== 'kavenegar') errors.push('SMS_PROVIDER باید kavenegar باشد؛ ارسال کد از کنسول در production ممنوع است.');
if (!isSet('KAVENEGAR_API_KEY') || /replace|example|your-/i.test(env.KAVENEGAR_API_KEY)) errors.push('KAVENEGAR_API_KEY باید در فایل محلی .env قرار بگیرد.');
if (!isSet('KAVENEGAR_OTP_TEMPLATE')) errors.push('KAVENEGAR_OTP_TEMPLATE باید دقیقاً نام قالب تأییدشدهٔ OTP باشد.');
if (env.ALLOW_DEMO_DATA === '1' || env.ALLOW_DEMO_SEED === '1') errors.push('نمایش/Seed آزمایشی در production غیرفعال بماند؛ ALLOW_DEMO_DATA و ALLOW_DEMO_SEED را حذف کنید.');
if (env.ALLOW_SAMPLE_GATEWAY === '1') errors.push('ALLOW_SAMPLE_GATEWAY را حذف کنید؛ درگاه آزمایشی برای production مجاز نیست.');

if (errors.length) {
  console.error('\nپیش‌بررسی production ناموفق بود؛ این موارد را اصلاح کن:\n');
  for (const error of errors) console.error(`- ${error}`);
  console.error('\nبرای امنیت، مقادیر محرمانه در خروجی چاپ نمی‌شوند.\n');
  process.exit(1);
}
console.log('✓ تنظیمات اولیهٔ production کامل‌اند. این بررسی جای تست اتصال DB/Redis، پرداخت واقعی و پیامک واقعی را نمی‌گیرد.');
