import { z } from 'zod';

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  MEILI_HOST: z.string().url(),
  MEILI_MASTER_KEY: z.string().min(16),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_SMTP_URL: z.string().url().optional(),
  AUTH_EMAIL_FROM: z.string().min(3).optional(),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .regex(/^[A-Za-z0-9_]{5,32}$/)
    .optional(),
  TELEGRAM_LINK_SECRET: z.string().min(24).optional(),
  PAYMENT_GATEWAY_MODE: z
    .enum(['disabled', 'fake', 'razorpay'])
    .default('disabled'),
  FAKE_PAYMENT_SECRET: z.string().min(16).optional(),
  RAZORPAY_KEY_ID: z.string().min(8).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(16).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(16).optional(),
  RAZORPAY_PRO_PLAN_ID: z.string().min(3).optional(),
  RAZORPAY_CONSULTANT_PLAN_ID: z.string().min(3).optional(),
  RAZORPAY_ALLOW_LIVE: z.enum(['true', 'false']).default('false'),
  DOWNLOAD_SIGNING_SECRET: z.string().min(32).optional(),
  DOCUMENT_STORAGE_DIR: z.string().min(1).optional(),
  SECRETS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional(),
  E2E_AUTH_SECRET: z.string().min(16).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  NILAM_HOME_MODE: z.enum(['rich', 'safe']).default('rich'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function resolveNilamHomeMode(
  value: string | undefined = process.env.NILAM_HOME_MODE,
): 'rich' | 'safe' {
  return value === 'safe' ? 'safe' : 'rich';
}
