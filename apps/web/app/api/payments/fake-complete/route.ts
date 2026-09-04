import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import { processProviderEvent } from '../../../../lib/payment-state';

const schema = z.object({ paymentId: z.uuid() }).strict();

export async function POST(request: Request) {
  if ((process.env.PAYMENT_GATEWAY_MODE ?? 'fake') !== 'fake') {
    return Response.json({ error: 'not_available' }, { status: 404 });
  }
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payment' }, { status: 400 });
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
         and p.provider = 'fake' for update of p`,
      [parsed.data.paymentId, authorization.session.user.id],
    );
    const record = payment.rows[0];
    if (record === undefined) {
      await client.query('rollback');
      return Response.json({ error: 'payment_not_found' }, { status: 404 });
    }
    const createdAt = Math.floor(Date.now() / 1000);
    await processProviderEvent(client, {
      id: `evt_fake_payment_${parsed.data.paymentId}`,
      event: 'payment.captured',
      created_at: createdAt,
      payload: {
        payment: {
          entity: {
            id: `pay_fake_${parsed.data.paymentId.replaceAll('-', '')}`,
            order_id: record.orderId,
            subscription_id: record.providerSubscriptionId,
          },
        },
      },
    });
    if (record.providerSubscriptionId !== null) {
      await processProviderEvent(client, {
        id: `evt_fake_subscription_${parsed.data.paymentId}`,
        event: 'subscription.activated',
        created_at: createdAt,
        payload: {
          subscription: {
            entity: {
              id: record.providerSubscriptionId,
              current_end: createdAt + 30 * 24 * 60 * 60,
            },
          },
        },
      });
    }
    await client.query('commit');
    return Response.json({ completed: true });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
