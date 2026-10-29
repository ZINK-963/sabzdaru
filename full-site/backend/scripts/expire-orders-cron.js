#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

function envFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 1) continue;
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

(async () => {
  const env = { ...envFile(path.join(__dirname, '..', '.env')), ...process.env };
  if (!env.APP_URL || !env.CRON_SECRET || env.CRON_SECRET.length < 32) {
    throw new Error('APP_URL یا CRON_SECRET در .env درست تنظیم نشده است.');
  }
  const app = new URL(env.APP_URL);
  if (app.protocol !== 'https:') throw new Error('برای اجرای cron، APP_URL باید HTTPS باشد.');
  const res = await fetch(`${env.APP_URL.replace(/\/$/, '')}/api/internal/cron/expire-orders`, {
    method: 'POST', headers: { 'x-cron-secret': env.CRON_SECRET, 'content-type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Cron endpoint returned HTTP ${res.status}: ${body.slice(0, 300)}`);
  console.log(`${new Date().toISOString()} ${body}`);
})().catch((err) => { console.error(`Sabzdaru order-expiry cron failed: ${err.message}`); process.exit(1); });
