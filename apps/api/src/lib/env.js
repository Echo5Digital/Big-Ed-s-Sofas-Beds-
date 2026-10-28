require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  publicUrl: process.env.PUBLIC_URL || "http://localhost:4000",
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001,http://localhost:3002")
    .split(",")
    .map((s) => s.trim()),
  // Defaults assume production deploys the API and the Next.js apps on
  // different domains (e.g. Render + Vercel), which requires SameSite=None
  // and Secure for the auth cookie to be sent on cross-site requests at all.
  // Local dev (http://localhost) keeps the Lax/non-secure default so cookies
  // still work without HTTPS. Override explicitly once a shared parent
  // domain (subdomains) is in place, where Lax is preferable.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  cookieSameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === "production" ? "none" : "lax"),
  stripeSecretKey: required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  cloudinaryCloudName: required("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: required("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: required("CLOUDINARY_API_SECRET"),
  // Transactional email (customer sign-up verification codes). All optional so
  // the API still boots without it: with SMTP_HOST unset, development prints
  // the code to the API console instead of sending, while production refuses
  // to start a sign-up it has no way to deliver (see lib/mailer.js).
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  // true = implicit TLS (port 465); false = STARTTLS upgrade (port 587).
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || "Big Ed's Sofas & Beds <no-reply@localhost>",
};

module.exports = { env };
