/**
 * Build env objects for UAT self-host deploy from `.env.local`.
 */
const SERVER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_NAME",
  "POE_API_KEY",
  "POE_MODEL",
  "POE_BASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_SECURE",
  "EMAIL_FROM_DOMAIN",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_FROM_NAME",
  "SMS_BASE_URL",
  "SMS_APP_ID",
  "SMS_TYPE",
  "PHONE_OTP_SECRET",
  "PHONE_OTP_DEV_CODE",
  "ADMIN_EMAIL",
  "CRON_SECRET",
  "PLATFORM_USDT_TRC20_ADDRESS",
  "PLATFORM_USDT_ERC20_ADDRESS",
  "PLATFORM_USDI_ADDRESS",
  "PLATFORM_MUP_ADDRESS",
  "PLATFORM_BANK_INFO",
  "NEXT_PUBLIC_ENABLE_SELLER_SELF_SIGNUP",
  "NEXT_PUBLIC_ENABLE_AI_CHAT",
];

/** @param {Record<string, string>} env from loadEnvLocal() */
export function uatPublicOrigin(env) {
  const host = env.SELF_HOST_SUPABASE_HOST || "uat.gf-v.io";
  return `https://${host}`;
}

/** Env for local `npm run build` targeting UAT. */
export function buildNextProductionEnv(env) {
  const origin = uatPublicOrigin(env);
  const out = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
  };
  for (const key of SERVER_ENV_KEYS) {
    if (env[key]) out[key] = env[key];
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL && !Object.keys(env).includes("xNEXT_PUBLIC_SUPABASE_URL")) {
    out.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  }
  return out;
}

/** Lines for /data/deploy/next/.env on server. */
export function buildNextServerEnvFile(env) {
  const origin = uatPublicOrigin(env);
  const lines = [
    "NODE_ENV=production",
    `NEXT_PUBLIC_SUPABASE_URL=${origin}`,
    `NEXT_PUBLIC_APP_URL=${origin}`,
  ];
  for (const key of SERVER_ENV_KEYS) {
    if (env[key]) lines.push(`${key}=${env[key]}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Supabase GoTrue SITE_URL / redirects when App lives on UAT. */
export function buildSupabaseUatEnvPatch(env) {
  const origin = uatPublicOrigin(env);
  return [
    `SUPABASE_PUBLIC_URL=${origin}`,
    `API_EXTERNAL_URL=${origin}`,
    `SITE_URL=${origin}`,
    `ADDITIONAL_REDIRECT_URLS=${origin}/auth/callback,http://localhost:3000/auth/callback`,
  ];
}

/** Full .env.uat for server (merged into upstream/.env by bootstrap pattern). */
export function buildSupabaseUatEnvFile(env) {
  const lines = [...buildSupabaseUatEnvPatch(env)];
  const smtpKeys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM_ADDRESS",
    "EMAIL_FROM_NAME",
  ];
  for (const key of smtpKeys) {
    if (env[key]) {
      const outKey = key === "EMAIL_FROM_ADDRESS" ? "SMTP_ADMIN_EMAIL" : key === "EMAIL_FROM_NAME" ? "SMTP_SENDER_NAME" : key;
      lines.push(`${outKey}=${env[key]}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
