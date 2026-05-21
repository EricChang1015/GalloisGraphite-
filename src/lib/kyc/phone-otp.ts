import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSmsConfigured, sendSms } from "@/lib/sms/client";

const OTP_TTL_MS = 10 * 60 * 1000;

function otpSecret(): string {
  return (
    process.env.PHONE_OTP_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "dev-phone-otp"
  );
}

function hashCode(userId: string, phone: string, code: string): string {
  return createHash("sha256")
    .update(`${userId}:${phone}:${code}:${otpSecret()}`)
    .digest("hex");
}

function generateCode(): string {
  const dev = process.env.PHONE_OTP_DEV_CODE?.trim();
  if (dev && /^\d{6}$/.test(dev)) return dev;
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function issuePhoneOtp(userId: string, phone: string) {
  const admin = createAdminClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await admin.from("phone_otp_challenges").delete().eq("user_id", userId);

  const { error } = await admin.from("phone_otp_challenges").insert({
    user_id: userId,
    phone,
    code_hash: hashCode(userId, phone, code),
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);

  if (isSmsConfigured()) {
    await sendSms({
      to: phone,
      content: `Your verification code: ${code}. Valid for 10 minutes.`,
    });
    return { sentViaSms: true as const, devCode: null };
  }

  return { sentViaSms: false as const, devCode: code };
}

export async function verifyPhoneOtp(
  userId: string,
  phone: string,
  code: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("phone_otp_challenges")
    .select("code_hash, expires_at, phone")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ code_hash: string; expires_at: string; phone: string }>();

  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "No active code. Request a new one." };
  if (row.phone !== phone) {
    return { ok: false, message: "Phone number changed. Request a new code." };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "Code expired. Request a new one." };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(userId, phone, code), "hex");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return { ok: false, message: "Invalid code." };
  }

  await admin.from("phone_otp_challenges").delete().eq("user_id", userId);
  return { ok: true };
}
