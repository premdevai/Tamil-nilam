import { createHash } from 'node:crypto';

import { z } from 'zod';

import { getDatabase } from '../../../../lib/db';
import { log } from '../../../../lib/log';
import { createPaymentGateway } from '../../../../lib/payment-gateway';
import {
  processProviderEvent,
  providerEventId,
  webhookReplayDecision,
} from '../../../../lib/payment-state';

const eventSchema = z
  .object({
    id: z.string().default(''),
    event: z.string().min(1),
    created_at: z.number().optional(),
    payload: z
      .object({
        payment: z
          .object({ entity: z.record(z.string(), z.unknown()).optional() })
          .optional(),
        subscription: z
          .object({ entity: z.record(z.string(), z.unknown()).optional() })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  let gateway;
  try {
    gateway = createPaymentGateway();
  } catch {
    return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  }
  if (!gateway.verifyWebhook(rawBody, signature)) {
    return Response.json(
      { error: 'invalid_webhook_signature' },
      { status: 401 },
    );
  }
  const parsed = eventSchema.safeParse(safeJson(rawBody));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_webhook_payload' }, { status: 400 });
  }
  const eventId =
    request.headers.get('x-razorpay-event-id') ??
    providerEventId(parsed.data, rawBody);
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  const pool = getDatabase().pool;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into payment_webhook_events
         (provider, provider_event_id, event_type, signature, payload_hash, raw_payload)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (provider, provider_event_id) do nothing`,
      [
        gateway.provider,
        eventId,
        parsed.data.event,
        signature,
        payloadHash,
        rawBody,
      ],
    );
    const eventRecord = await client.query<{
      processedAt: Date | null;
      payloadHash: string;
    }>(
      `select processed_at as "processedAt", payload_hash as "payloadHash"
       from payment_webhook_events
       where provider = $1 and provider_event_id = $2
       for update`,
      [gateway.provider, eventId],
    );
    const decision = webhookReplayDecision(eventRecord.rows[0], payloadHash);
    if (decision === 'missing') {
      throw new Error('Webhook event was not recorded.');
    }
    if (decision === 'mismatch') {
      await client.query('rollback');
      return Response.json(
        { error: 'webhook_event_id_payload_mismatch' },
        { status: 409 },
      );
    }
    if (decision === 'replayed') {
      await client.query('commit');
      return Response.json({ received: true, replayed: true });
    }
    await processProviderEvent(client, parsed.data);
    await client.query(
      `update payment_webhook_events
       set processed_at = now(), processing_error = null
       where provider = $1 and provider_event_id = $2`,
      [gateway.provider, eventId],
    );
    await client.query('commit');
    return Response.json({ received: true });
  } catch (error) {
    await client.query('rollback');
    await pool.query(
      `insert into payment_webhook_events
         (provider, provider_event_id, event_type, signature, payload_hash,
          raw_payload, processing_error)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)
       on conflict (provider, provider_event_id)
       do update set processing_error = excluded.processing_error`,
      [
        gateway.provider,
        eventId,
        parsed.data.event,
        signature,
        payloadHash,
        rawBody,
        error instanceof Error
          ? error.message.slice(0, 2_000)
          : 'Unknown webhook processing error',
      ],
    );
    log({
      level: 'error',
      message: 'webhook_processing_failed',
      route: '/api/payments/webhook',
      status: 500,
    });
    return Response.json(
      { error: 'webhook_processing_failed' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

function safeJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}
