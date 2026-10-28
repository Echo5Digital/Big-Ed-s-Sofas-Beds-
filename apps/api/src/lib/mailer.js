const nodemailer = require("nodemailer");
const { env } = require("./env");

let transporter;

function getTransporter() {
  if (!env.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// Sends the 6-digit sign-up verification code. Throws if it cannot be
// delivered — the caller must surface that instead of telling the customer a
// code is on its way when it isn't.
//
// With no SMTP configured, non-production environments print the code to the
// API console so the flow is testable locally. Production never does: a
// misconfigured deploy must fail loudly, and the code must never be logged
// where a customer-facing environment's logs could expose it.
async function sendVerificationCode({ to, firstName, code, expiresInMinutes }) {
  const transport = getTransporter();

  if (!transport) {
    if (env.nodeEnv === "production") {
      throw new Error("SMTP is not configured (SMTP_HOST is unset); cannot send verification emails");
    }
    console.log(`[mailer] SMTP not configured — verification code for ${to}: ${code}`);
    return { delivered: false };
  }

  const text = [
    `Hi ${firstName},`,
    "",
    `Your Big Ed's verification code is: ${code}`,
    "",
    `It expires in ${expiresInMinutes} minutes. If you didn't try to create an account, you can ignore this email.`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Your Big Ed's verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${escapeHtml(code)}</p>
    <p>It expires in ${expiresInMinutes} minutes. If you didn't try to create an account, you can ignore this email.</p>
  `;

  await transport.sendMail({
    from: env.mailFrom,
    to,
    subject: `${code} is your Big Ed's verification code`,
    text,
    html,
  });
  return { delivered: true };
}

module.exports = { sendVerificationCode };
