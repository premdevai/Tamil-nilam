import { BillingPanel } from '../../../components/billing-panel';
import { BilingualHeading } from '../../../components/public-shell';
import { requireSession } from '../../../lib/authz';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  await requireSession();
  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Paid product"
        title="Checkout and entitlements"
        titleTa="கட்டணம் மற்றும் உரிமைகள்"
      >
        <p className="lede">
          Use the fake gateway locally. Live Razorpay stays locked until an
          approved environment sets RAZORPAY_ALLOW_LIVE=true.
        </p>
      </BilingualHeading>
      <BillingPanel />
    </section>
  );
}
