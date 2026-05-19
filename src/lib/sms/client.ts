import "server-only";

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.SMS_BASE_URL?.trim() && process.env.SMS_APP_ID?.trim()
  );
}

export async function sendSms(params: { to: string; content: string }) {
  const baseUrl = process.env.SMS_BASE_URL?.trim();
  const appId = process.env.SMS_APP_ID?.trim();
  const to = params.to.trim();
  if (!baseUrl || !appId || !to) return;

  const body: Record<string, string> = {
    appId,
    content: params.content,
    to,
  };
  const smsType = process.env.SMS_TYPE?.trim();
  if (smsType) body.type = smsType;

  const url = `${baseUrl.replace(/\/$/, "")}/sendSMS.do`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`SMS gateway responded with ${res.status}`);
  }
}
