import { ProWorkspacePanel } from '../../../components/pro-workspace-panel';
import { BilingualHeading } from '../../../components/public-shell';
import { requireSession } from '../../../lib/authz';
import { isPaidEnabled } from '../../../lib/payment-gateway';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  await requireSession();
  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Pro and consultant"
        title="Client workspaces and bulk runs"
        titleTa="வாடிக்கையாளர் இடங்கள் மற்றும் தொகுப்பு ஓட்டங்கள்"
      >
        <p className="lede">
          {isPaidEnabled()
            ? 'Server-side authorization gates every write. Quotas are monthly and plan-specific.'
            : 'Pro and consultant tools are not offered on this deployment.'}
        </p>
      </BilingualHeading>
      {isPaidEnabled() ? <ProWorkspacePanel /> : null}
    </section>
  );
}
