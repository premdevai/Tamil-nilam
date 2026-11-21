import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { buildDprFinancials, type DprFinancialInput } from '@nilam/paid';
import nodemailer from 'nodemailer';
import { z } from 'zod';

export const MAX_DPR_RECIPIENTS = 5;
export const DPR_EMAILS_PER_DAY = 10;

export const dprEmailRequestSchema = z
  .object({
    to: z.array(z.email().max(254)).min(1).max(MAX_DPR_RECIPIENTS),
    note: z.string().trim().max(1_000).default(''),
    copyMe: z.boolean().default(true),
  })
  .strict();

export type DprEmailRequest = z.infer<typeof dprEmailRequestSchema>;

export type DprMailAttachment = {
  readonly filename: string;
  readonly content: Uint8Array;
  readonly contentType: string;
};

export type DprMail = {
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly replyTo: string | undefined;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly attachments: readonly DprMailAttachment[];
};

const lakh = (value: number) =>
  `₹${(value / 100_000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lakh`;

/** Email body: who sent it, their note, the headline numbers, the caveat. */
export function composeDprMail(input: {
  readonly dpr: DprFinancialInput;
  readonly request: DprEmailRequest;
  readonly senderEmail: string | undefined;
  readonly attachments: readonly DprMailAttachment[];
}): DprMail {
  const { dpr, request, senderEmail } = input;
  const f = buildDprFinancials(dpr);
  const to = unique(request.to);
  const cc =
    request.copyMe &&
    senderEmail !== undefined &&
    !to.includes(senderEmail.toLowerCase())
      ? [senderEmail.toLowerCase()]
      : [];
  const headline: [string, string][] = [
    ['Project cost', lakh(dpr.projectCost)],
    ['Term loan sought', lakh(dpr.termLoan)],
    ['Promoter contribution', lakh(dpr.promoterContribution)],
    ...(dpr.capitalSubsidy !== undefined && dpr.capitalSubsidy > 0
      ? ([
          [
            'Capital subsidy expected',
            `${lakh(dpr.capitalSubsidy)}${dpr.subsidySchemeName === undefined ? '' : ` (${dpr.subsidySchemeName})`}`,
          ],
        ] as [string, string][])
      : []),
    ['Average DSCR', f.averageDscr === null ? 'n/a' : f.averageDscr.toFixed(2)],
    ['Project IRR', f.irrPct === null ? 'n/a' : `${f.irrPct.toFixed(1)}%`],
    ['Employment', String(dpr.employment)],
  ];
  const subject = `Detailed Project Report — ${dpr.businessName} (${dpr.district})`;
  const sender = dpr.promoterName;
  const caveat =
    'Prepared with NILAM from the promoter’s inputs. The projections are estimates for appraisal and are not a sanction or approval by any bank or government body.';
  const text = [
    `Please find attached the Detailed Project Report for ${dpr.businessName}, ${dpr.sector}, ${dpr.district} district, Tamil Nadu, from ${sender}.`,
    ...(request.note.length > 0 ? ['', request.note] : []),
    '',
    ...headline.map(([label, value]) => `${label}: ${value}`),
    '',
    'Attached: the report as PDF and as an editable Word document.',
    ...(senderEmail === undefined
      ? []
      : [`Reply to this email to reach ${sender} (${senderEmail}).`]),
    '',
    caveat,
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:620px">
<p>Please find attached the Detailed Project Report for <strong>${escapeHtml(dpr.businessName)}</strong>, ${escapeHtml(dpr.sector)}, ${escapeHtml(dpr.district)} district, Tamil Nadu, from ${escapeHtml(sender)}.</p>
${request.note.length > 0 ? `<p style="white-space:pre-wrap;border-left:3px solid #1c4d38;padding-left:10px">${escapeHtml(request.note)}</p>` : ''}
<table style="border-collapse:collapse;margin:12px 0">${headline
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`,
    )
    .join('')}</table>
<p>Attached: the report as PDF and as an editable Word document.${senderEmail === undefined ? '' : ` Reply to this email to reach ${escapeHtml(sender)}.`}</p>
<p style="color:#777;font-size:12px">${escapeHtml(caveat)}</p></div>`;
  return {
    to,
    cc,
    replyTo: senderEmail,
    subject,
    text,
    html,
    attachments: input.attachments,
  };
}

/**
 * Sends through DPR_SMTP_URL (or the auth / alert SMTP URL). Outside
 * production with no SMTP configured, the full message — attachments
 * included — is written to `.data/outbox/*.eml` so it can be opened and
 * checked in any mail client.
 */
export async function sendDprMail(
  mail: DprMail,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ transport: 'smtp' | 'local-outbox'; id: string }> {
  const smtpUrl = env.DPR_SMTP_URL ?? env.AUTH_SMTP_URL ?? env.ALERT_SMTP_URL;
  const from =
    env.DPR_EMAIL_FROM ?? env.AUTH_EMAIL_FROM ?? 'NILAM <no-reply@localhost>';
  const message = {
    from,
    to: [...mail.to],
    cc: [...mail.cc],
    ...(mail.replyTo === undefined ? {} : { replyTo: mail.replyTo }),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: mail.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content),
      contentType: attachment.contentType,
    })),
  };
  if (smtpUrl === undefined) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'DPR_SMTP_URL (or AUTH_SMTP_URL) is required to email DPRs in production',
      );
    }
    const built = await nodemailer
      .createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
      .sendMail(message);
    const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
    const file = path.join(outboxDir(env), `${id}.eml`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, built.message as Buffer);
    console.info(
      JSON.stringify({
        transport: 'local-outbox',
        file,
        to: mail.to.length,
        cc: mail.cc.length,
      }),
    );
    return { transport: 'local-outbox', id };
  }
  const result = await nodemailer.createTransport(smtpUrl).sendMail(message);
  return { transport: 'smtp', id: result.messageId };
}

export function outboxDir(env: NodeJS.ProcessEnv = process.env): string {
  const root =
    env.DOCUMENT_STORAGE_DIR === undefined
      ? path.join(process.cwd(), '.data')
      : path.dirname(path.resolve(env.DOCUMENT_STORAGE_DIR));
  return path.join(root, 'outbox');
}

function unique(addresses: readonly string[]): string[] {
  return [...new Set(addresses.map((address) => address.trim().toLowerCase()))];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
