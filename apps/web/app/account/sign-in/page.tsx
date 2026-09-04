import { redirect } from 'next/navigation';

import { SignInForm } from '../../../components/sign-in-form';
import { BilingualHeading } from '../../../components/public-shell';
import { getSession } from '../../../lib/auth';

export default async function SignInPage() {
  if ((await getSession())?.user !== undefined) redirect('/account');

  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Account · கணக்கு"
        title="Sign in without a password"
        titleTa="கடவுச்சொல் இல்லாமல் உள்நுழையுங்கள்"
      >
        <p className="lede">
          We will email a one-time link that expires in 15 minutes. Public
          matching and browsing remain available without an account.
        </p>
      </BilingualHeading>
      <SignInForm />
    </section>
  );
}
