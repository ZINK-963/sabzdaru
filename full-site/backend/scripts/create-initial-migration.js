#!/usr/bin/env node
'use strict';

// One-time helper for a BRAND-NEW/EMPTY production database. Generate an initial
// migration from schema.prisma and then commit the resulting folder to source control.
// Do not use to baseline an existing database without a verified backup and migration plan.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const migrations = path.join(root, 'prisma', 'migrations');
const first = path.join(migrations, '0001_init');
if (fs.existsSync(migrations) && fs.readdirSync(migrations).some((name) => fs.statSync(path.join(migrations, name)).isDirectory())) {
  console.error('پوشهٔ migration از قبل وجود دارد؛ برای جلوگیری از بازنویسی متوقف شد.');
  process.exit(1);
}
if (process.env.CONFIRM_EMPTY_DATABASE !== 'YES') {
  console.error('این فقط برای دیتابیس کاملاً خالی است. پس از بررسی، CONFIRM_EMPTY_DATABASE=YES را تعیین کنید.');
  process.exit(1);
}
fs.mkdirSync(first, { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32',
});
if (result.status !== 0 || !result.stdout || !result.stdout.includes('CREATE TABLE')) {
  fs.rmSync(first, { recursive: true, force: true });
  console.error('ساخت migration ناموفق بود. مطمئن شو npm install و prisma generate انجام شده‌اند.');
  process.exit(result.status || 1);
}
fs.writeFileSync(path.join(first, 'migration.sql'), result.stdout, { mode: 0o600 });
fs.mkdirSync(migrations, { recursive: true });
fs.writeFileSync(path.join(migrations, 'migration_lock.toml'), 'provider = "postgresql"\n');
console.log('✓ Migration اولیه در prisma/migrations/0001_init ساخته شد. آن را بازبینی و در Git/نسخهٔ پروژه ذخیره کن.');
console.log('پس از آن روی دیتابیس خالی اجرا کن: npm run prisma:migrate:deploy');
