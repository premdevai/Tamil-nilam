import {
  auditRecords,
  businessProfiles,
  bulkStackRuns,
  clientWorkspaces,
  entitlements,
  generatedDprs,
  paymentReceipts,
  payments,
  printableReports,
  subscriptions,
  usageLedger,
} from '@nilam/db';
import { eq } from 'drizzle-orm';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import { authorizeEntitlement } from '../../../../lib/paid-access';

export async function POST() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const entitlementError = await authorizeEntitlement(userId, 'audit:export');
  if (entitlementError !== undefined) return entitlementError;
  const database = getDatabase().db;
  const [
    clientRows,
    profiles,
    dprs,
    reports,
    bulkRuns,
    paymentRows,
    receiptRows,
    subscriptionRows,
    entitlementRows,
    usage,
    audits,
  ] = await Promise.all([
    database
      .select()
      .from(clientWorkspaces)
      .where(eq(clientWorkspaces.consultantUserId, userId)),
    database
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.ownerUserId, userId)),
    database
      .select()
      .from(generatedDprs)
      .where(eq(generatedDprs.userId, userId)),
    database
      .select()
      .from(printableReports)
      .where(eq(printableReports.userId, userId)),
    database
      .select()
      .from(bulkStackRuns)
      .where(eq(bulkStackRuns.ownerUserId, userId)),
    database.select().from(payments).where(eq(payments.userId, userId)),
    database
      .select({
        id: paymentReceipts.id,
        paymentId: paymentReceipts.paymentId,
        receiptNumber: paymentReceipts.receiptNumber,
        issuedAt: paymentReceipts.issuedAt,
      })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .where(eq(payments.userId, userId)),
    database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId)),
    database.select().from(entitlements).where(eq(entitlements.userId, userId)),
    database.select().from(usageLedger).where(eq(usageLedger.userId, userId)),
    database
      .select()
      .from(auditRecords)
      .where(eq(auditRecords.actorId, userId)),
  ]);
  const generatedAt = new Date();
  await database.insert(auditRecords).values({
    actorId: userId,
    action: 'audit.exported',
    targetType: 'user',
    targetId: userId,
  });
  return new Response(
    JSON.stringify(
      {
        format: 'nilam-audit-export-v1',
        generatedAt: generatedAt.toISOString(),
        disclaimer:
          'This export is an operational record of NILAM activity. It is not a legal filing, invoice substitute from a tax authority, or evidence of bank or government approval.',
        clients: clientRows,
        businessProfiles: profiles,
        generatedDprs: dprs,
        printableReports: reports,
        bulkStackRuns: bulkRuns,
        payments: paymentRows,
        receipts: receiptRows,
        subscriptions: subscriptionRows,
        entitlements: entitlementRows,
        usageLedger: usage,
        auditRecords: audits,
      },
      null,
      2,
    ),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="nilam-audit-${generatedAt.toISOString().slice(0, 10)}.json"`,
        'cache-control': 'no-store',
      },
    },
  );
}
