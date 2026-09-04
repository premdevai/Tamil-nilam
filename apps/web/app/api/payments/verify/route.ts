import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import { createPaymentGateway } from '../../../../lib/payment-gateway';
import { processProviderEvent } from '../../../../lib/payment-state';

const schema = z
  .object({
    paymentId: z.uuid(),
    providerOrderId: z.string().min(3).max(120),
    providerPaymentId: z.string().min(3).max(120),
    providerSubscriptionId: z.string().min(3).max(120).optional(),
    signature: z.string().min(8).max(256),
  })
  .strict();

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_payment_signature' },
      { status: 400 },
    );
  }
  const gateway = createPaymentGateway();
  if (
    !gateway.verifyCheckoutSignature({
      providerOrderId: parsed.data.providerOrderId,
      providerPaymentId: parsed.data.providerPaymentId,
      signature: parsed.data.signature,
      ...(parsed.data.providerSubscriptionId === undefined
        ? {}
        : { providerSubscriptionId: parsed.data.providerSubscriptionId }),
    })
  ) {
    return Response.json(
      { error: 'invalid_checkout_signature' },
      { status: 401 },
    );
  }
  const pool = getDatabase().pool;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const payment = await client.query<{
      orderId: string;
      providerSubscriptionId: string | null;
    }>(
      `select p.provider_order_id as "orderId",
         s.provider_subscription_id as "providerSubscriptionId"
       from payments p left join subscriptions s on s.id = p.subscription_id
       where p.id = $1::uuid and p.user_id = $2::uuid
       for update of p`,
      [parsed.data.paymentId, authorization.session.user.id],
    );
    const record = payment.rows[0];
    if (
      record === undefined ||
      record.orderId !== parsed.data.providerOrderId
    ) {
      await client.query('rollback');
      return Response.json({ error: 'payment_not_found' }, { status: 404 });
    }
    const createdAt = Math.floor(Date.now() / 1000);
    await processProviderEvent(client, {
      id: `evt_verify_${parsed.data.providerPaymentId}`,
      event: 'payment.captured',
      created_at: createdAt,
      payload: {
        payment: {
          entity: {
            id: parsed.data.providerPaymentId,
            order_id: parsed.data.providerOrderId,
            subscription_id:
              parsed.data.providerSubscriptionId ??
              record.providerSubscriptionId,
          },
        },
      },
    });
    await client.query('commit');
    return Response.json({ verified: true });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
