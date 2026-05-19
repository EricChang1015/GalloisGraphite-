import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { sendSms, isSmsConfigured } from "@/lib/sms/client";
import { getSmsNotificationsEnabled } from "@/lib/platform/settings";

export async function notifyUser(params: {
  email?: string | null;
  phone?: string | null;
  subject: string;
  html: string;
  smsText: string;
}) {
  try {
    if (params.email) {
      await sendEmail({
        to: params.email,
        subject: params.subject,
        html: params.html,
      });
    }
  } catch (_) {}

  try {
    const phone = params.phone?.trim();
    if (
      phone &&
      isSmsConfigured() &&
      (await getSmsNotificationsEnabled())
    ) {
      await sendSms({ to: phone, content: params.smsText });
    }
  } catch (_) {}
}

export async function notifyAdminEmail(params: {
  subject: string;
  html: string;
}) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    await sendEmail({
      to: adminEmail,
      subject: params.subject,
      html: params.html,
    });
  } catch (_) {}
}
