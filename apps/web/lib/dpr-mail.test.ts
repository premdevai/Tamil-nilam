import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { dprFinancialInputSchema } from '@nilam/paid';
import { describe, expect, it } from 'vitest';

import {
  composeDprMail,
  dprEmailRequestSchema,
  outboxDir,
  sendDprMail,
} from './dpr-mail';

const dpr = dprFinancialInputSchema.parse({
  businessName: 'Kaveri Areca Plates',
  promoterName: 'A. Selvi',
  sector: 'Areca & paper plate unit',
  district: 'Kallakurichi',
  projectCost: 5_000_000,
  landAndBuildingCost: 1_500_000,
  plantAndMachineryCost: 2_250_000,
  otherFixedCost: 250_000,
  workingCapital: 1_000_000,
  promoterContribution: 250_000,
  termLoan: 4_750_000,
  otherFunding: 0,
  projectedAnnualRevenue: 8_000_000,
  projectedAnnualOperatingCost: 6_400_000,
  employment: 8,
  implementationMonths: 9,
  capitalSubsidy: 1_000_000,
  subsidySchemeName: 'NEEDS (Tamil Nadu)',
  citations: [
    {
      title: 'About NEEDS',
      url: 'https://msmeonline.tn.gov.in/needs/needs_desc.php',
      verifiedOn: '2026-11-21',
    },
  ],
});

const attachments = [
  {
    filename: 'DPR-kaveri.pdf',
    content: new TextEncoder().encode('%PDF-1.7 test'),
    contentType: 'application/pdf',
  },
  {
    filename: 'DPR-kaveri.docx',
    content: new Uint8Array([80, 75, 3, 4]),
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
];

describe('DPR email', () => {
  it('validates recipients and caps them at five', () => {
    expect(
      dprEmailRequestSchema.safeParse({ to: ['not-an-email'] }).success,
    ).toBe(false);
    expect(
      dprEmailRequestSchema.safeParse({
        to: Array.from({ length: 6 }, (_, i) => `b${i}@bank.test`),
      }).success,
    ).toBe(false);
  });

  it('copies the sender, sets reply-to and escapes the note', () => {
    const mail = composeDprMail({
      dpr,
      request: dprEmailRequestSchema.parse({
        to: ['Manager@Bank.test', 'manager@bank.test'],
        note: '<b>Please review</b>',
      }),
      senderEmail: 'founder@nilam.test',
      attachments,
    });
    expect(mail.to).toEqual(['manager@bank.test']);
    expect(mail.cc).toEqual(['founder@nilam.test']);
    expect(mail.replyTo).toBe('founder@nilam.test');
    expect(mail.subject).toContain('Kaveri Areca Plates');
    expect(mail.text).toContain('Average DSCR');
    expect(mail.html).toContain('&lt;b&gt;Please review');
    expect(mail.html).not.toContain('<b>Please review');
  });

  it('writes a complete .eml with both attachments when SMTP is not set', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nilam-mail-'));
    const env = {
      NODE_ENV: 'test',
      DOCUMENT_STORAGE_DIR: path.join(root, 'documents'),
    } as NodeJS.ProcessEnv;
    try {
      const mail = composeDprMail({
        dpr,
        request: dprEmailRequestSchema.parse({ to: ['manager@bank.test'] }),
        senderEmail: 'founder@nilam.test',
        attachments,
      });
      const sent = await sendDprMail(mail, env);
      expect(sent.transport).toBe('local-outbox');
      const [file] = await readdir(outboxDir(env));
      const eml = await readFile(path.join(outboxDir(env), file ?? ''), 'utf8');
      expect(eml).toContain('To: manager@bank.test');
      expect(eml).toContain('Reply-To: founder@nilam.test');
      expect(eml).toContain('filename=DPR-kaveri.pdf');
      expect(eml).toContain('filename=DPR-kaveri.docx');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses to fall back to the outbox in production', async () => {
    const mail = composeDprMail({
      dpr,
      request: dprEmailRequestSchema.parse({ to: ['manager@bank.test'] }),
      senderEmail: undefined,
      attachments,
    });
    await expect(
      sendDprMail(mail, { NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).rejects.toThrow(/SMTP/);
  });
});
