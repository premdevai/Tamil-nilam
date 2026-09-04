import { randomUUID } from 'node:crypto';

import nodemailer from 'nodemailer';

export type DeliveryMessage = {
  channel: 'email' | 'telegram';
  destination: string;
  subject: string;
  body: string;
};

export type DeliveryTransport = {
  send(message: DeliveryMessage): Promise<string>;
};

export function createDeliveryTransport(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryTransport {
  return {
    async send(message) {
      if (message.channel === 'email') {
        return sendEmail(message, env);
      }
      return sendTelegram(message, env);
    },
  };
}

async function sendEmail(
  message: DeliveryMessage,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  if (env.ALERT_SMTP_URL === undefined) {
    if (env.NODE_ENV === 'production') {
      throw new Error('ALERT_SMTP_URL is required for email delivery');
    }
    const id = `local-email:${randomUUID()}`;
    console.info(JSON.stringify({ transport: 'local-email', id, ...message }));
    return id;
  }
  const result = await nodemailer.createTransport(env.ALERT_SMTP_URL).sendMail({
    from: env.ALERT_EMAIL_FROM ?? 'NILAM <alerts@localhost>',
    to: message.destination,
    subject: message.subject,
    text: message.body,
  });
  return result.messageId;
}

async function sendTelegram(
  message: DeliveryMessage,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  if (env.TELEGRAM_BOT_TOKEN === undefined) {
    if (env.NODE_ENV === 'production') {
      throw new Error('TELEGRAM_BOT_TOKEN is required for Telegram delivery');
    }
    const id = `local-telegram:${randomUUID()}`;
    console.info(
      JSON.stringify({ transport: 'local-telegram', id, ...message }),
    );
    return id;
  }
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.destination,
        text: `${message.subject}\n\n${message.body}`,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const result = (await response.json()) as {
    ok: boolean;
    result?: { message_id: number };
    description?: string;
  };
  if (!response.ok || !result.ok || result.result === undefined) {
    throw new Error(result.description ?? `Telegram HTTP ${response.status}`);
  }
  return `telegram:${result.result.message_id}`;
}
