import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const result = await getDatabase().pool.query(
    `select r.id::text, r.receipt_number as "receiptNumber",
       r.provider_receipt_url as "providerReceiptUrl",
       r.issued_at as "issuedAt", p.amount_paise as "amountPaise",
       p.currency, p.status, p.provider
     from payment_receipts r
     join payments p on p.id = r.payment_id
     where p.user_id = $1::uuid
     order by r.issued_at desc limit 100`,
    [authorization.session.user.id],
  );
  return Response.json({ receipts: result.rows });
}
