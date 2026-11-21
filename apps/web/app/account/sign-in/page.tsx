import { redirect } from 'next/navigation';

import { SignInForm } from '../../../components/sign-in-form';
import { BilingualHeading } from '../../../components/public-shell';
import { getSession } from '../../../lib/auth';
import { safeNextPath } from '../../../lib/authz';

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  if ((await getSession())?.user !== undefined) redirect(next ?? '/account');
  const mailConfigured =
    process.env.NODE_ENV !== 'production' ||
    process.env.AUTH_SMTP_URL !== undefined;

  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Account · கணக்கு"
        title="Sign in without a password"
        titleTa="கடவுச்சொல் இல்லாமல் உள்நுழையுங்கள்"
      >
        <p className="lede">
          {mailConfigured
            ? 'We will email a one-time link that expires in 15 minutes. Public matching and browsing remain available without an account.'
            : 'Magic-link email is not configured on this deployment. Public matching and browsing stay available without an account.'}
        </p>
      </BilingualHeading>
      {next?.startsWith('/account/dpr') === true ? (
        <p className="notice">
          Sign in to build your DPR. Your numbers are kept and you will come
          straight back to them.
        </p>
      ) : null}
      {mailConfigured ? <SignInForm next={next ?? '/account'} /> : null}
    </section>
  );
}
