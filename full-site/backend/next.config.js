/** @type {import('next').NextConfig} */

/**
 * CSP: فرانت‌اند فقط اسکریپت‌های هم‌مبدأ دارد (بدون inline script)، استایل‌های inline زیاد دارد، و فونت
 * Vazirmatn را از Google Fonts می‌گیرد. اگر فونت را self-host کردید، دو دامنهٔ گوگل را بردارید.
 * هر تغییری در CSP را با تست e2e فرانت‌اند (روی dev-server که همین هدر را می‌فرستد) بیازمایید.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  // فرانت‌اند یک اپ تک‌صفحه‌ای است که در public/ کپی می‌شود؛ «/» باید index.html را بدهد
  async rewrites() {
    return [{ source: "/", destination: "/index.html" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};
module.exports = nextConfig;
module.exports.CSP = CSP;
