import { redirect } from 'next/navigation';

import { SignInForm } from '../../../components/sign-in-form';
import { BilingualHeading } from '../../../components/public-shell';
import { getSession } from '../../../lib/auth';

export default async function SignInPage() {
  if ((await getSession())?.user !== undefined) redirect('/account');
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
      {mailConfigured ? <SignInForm /> : null}
    </section>
  );
}
