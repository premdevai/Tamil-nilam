import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: 'unavailable',
    paymentGateway: process.env.PAYMENT_GATEWAY_MODE ?? 'fake',
    razorpayLiveLocked: process.env.RAZORPAY_ALLOW_LIVE !== 'true',
  };
  try {
    const { getDatabase } = await import('../../../../lib/db');
    await getDatabase().pool.query('select 1 as ok');
    checks.database = 'ok';
  } catch {
    checks.database = 'unavailable';
  }
  const ok = checks.database === 'ok';
  return NextResponse.json(
    {
      service: 'nilam-web',
      status: ok ? 'ok' : 'degraded',
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
