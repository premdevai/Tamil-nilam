import { BilingualHeading } from '../../../components/public-shell';
import { peekLocalMagicLink } from '../../../lib/local-magic-link';

export default async function VerifyPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).email;
  const email = typeof raw === 'string' ? raw : undefined;
  const localUrl = email === undefined ? null : peekLocalMagicLink(email);

  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Email sent · மின்னஞ்சல் அனுப்பப்பட்டது"
        title="Check your inbox"
        titleTa="உங்கள் மின்னஞ்சலைப் பாருங்கள்"
      >
        <p className="lede">
          Open the NILAM sign-in link on this device. It expires in 15 minutes
          and works once.
        </p>
        {localUrl === null ? (
          process.env.NODE_ENV === 'production' ? null : (
            <p>
              Local development has no SMTP. Request a link again from Sign in —
              it will appear on this page.
            </p>
          )
        ) : (
          <p>
            Local development has no inbox.{' '}
            <a className="button-link" href={localUrl}>
              Continue on this device
            </a>
          </p>
        )}
      </BilingualHeading>
    </section>
  );
}
