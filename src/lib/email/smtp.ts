import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

/**
 * Build (and cache) the SMTP transporter. Throws when SMTP_HOST is not
 * configured so the caller can surface a clear error in the dev log
 * rather than silently dropping the email.
 */
export function getTransporter(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error("SMTP_HOST is not set (configure SMTP in .env.local).");
  }
  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASS are not set.");
  }

  // For AWS SES: port 587 with STARTTLS (secure=false + requireTLS=true).
  // Port 465 = SMTPS (secure=true).
  const secureEnv = process.env.SMTP_SECURE?.toLowerCase();
  const secure = secureEnv === "true" || port === 465;

  cached = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure, // STARTTLS upgrade for port 587
    auth: { user, pass },
  });

  return cached;
}

function buildFrom(): string {
  const name = process.env.EMAIL_FROM_NAME ?? "Mada Graphite";
  const address =
    process.env.EMAIL_FROM_ADDRESS ?? `noreply@${process.env.EMAIL_FROM_DOMAIN ?? "example.com"}`;
  return `${name} <${address}>`;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send a transactional email. Returns the nodemailer info object on
 * success. Caller is responsible for handling errors — `dispatch.ts`
 * wraps this in try/catch + console.warn so failures don't block
 * business flows but are still observable in dev logs.
 */
export async function sendEmail(params: SendEmailParams) {
  const transporter = getTransporter();
  return transporter.sendMail({
    from: buildFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
  });
}

/** Verify the SMTP connection is reachable. Used by the admin "Send test email" flow. */
export async function verifySmtp(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
