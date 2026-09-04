import nodemailer from 'nodemailer';
import type { SendVerificationRequestParams } from 'next-auth/providers/email';

import { rememberLocalMagicLink } from './local-magic-link';

export type MagicLinkMessage = Pick<
  SendVerificationRequestParams,
  'identifier' | 'url' | 'expires'
>;

export async function sendMagicLink(
  message: MagicLinkMessage,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const smtpUrl = env.AUTH_SMTP_URL;
  const from = env.AUTH_EMAIL_FROM ?? 'NILAM <no-reply@localhost>';

  if (smtpUrl === undefined) {
    if (env.NODE_ENV === 'production') {
      throw new Error('AUTH_SMTP_URL is required in production');
    }
    rememberLocalMagicLink(
      message.identifier,
      message.url,
      message.expires,
      env,
    );
    console.info(
      JSON.stringify({
        transport: 'local-email',
        to: message.identifier,
        expires: message.expires.toISOString(),
        magicLink: message.url,
      }),
    );
    return;
  }

  const transport = nodemailer.createTransport(smtpUrl);
  await transport.sendMail({
    to: message.identifier,
    from,
    subject: 'Sign in to NILAM',
    text: `Sign in to NILAM:\n\n${message.url}\n\nThis link expires at ${message.expires.toISOString()} and can only be used once.`,
    html: `<p>Sign in to NILAM:</p><p><a href="${escapeHtml(message.url)}">Continue securely</a></p><p>This one-time link expires at ${message.expires.toISOString()}.</p>`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
