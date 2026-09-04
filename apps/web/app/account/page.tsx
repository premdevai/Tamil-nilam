import {
  notificationDeliveries,
  notificationPreferences,
  savedStacks,
  estates,
  users,
  watchedEstates,
} from '@nilam/db';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

import { AccountSettings } from '../../components/account-settings';
import { BilingualHeading } from '../../components/public-shell';
import { requireSession } from '../../lib/authz';
import { can } from '../../lib/authz';
import { getDatabase } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const database = getDatabase().db;
  const [[user], [preferences], stacks, watches, history] = await Promise.all([
    database.select().from(users).where(eq(users.id, userId)).limit(1),
    database
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1),
    database
      .select({
        id: savedStacks.id,
        name: savedStacks.name,
        rulesetVersion: savedStacks.rulesetVersion,
        createdAt: savedStacks.createdAt,
      })
      .from(savedStacks)
      .where(eq(savedStacks.userId, userId))
      .orderBy(desc(savedStacks.createdAt)),
    database
      .select({
        estateId: watchedEstates.estateId,
        name: estates.name,
        slug: estates.slug,
      })
      .from(watchedEstates)
      .innerJoin(estates, eq(estates.id, watchedEstates.estateId))
      .where(eq(watchedEstates.userId, userId))
      .orderBy(desc(watchedEstates.createdAt)),
    database
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.userId, userId))
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(10),
  ]);

  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow={`Account · ${session.user.role}`}
        title="Saved work and alerts"
        titleTa="சேமித்தவை மற்றும் அறிவிப்புகள்"
      >
        <p className="lede">
          Signed in as {session.user.email}. Your public Matcher and land
          browsing still work without this account.
        </p>
      </BilingualHeading>

      <div className="account-summary" aria-label="Account summary">
        <article>
          <strong>{stacks.length}</strong>
          <span>projects</span>
        </article>
        <article>
          <strong>{watches.length}</strong>
          <span>watched estates</span>
        </article>
        <article>
          <strong>{history.length}</strong>
          <span>recent notifications</span>
        </article>
      </div>

      {can(session.user.role, 'operations:read') ? (
        <p className="notice">
          Your role includes operational access.{' '}
          <Link href="/admin">Open operations</Link>.
        </p>
      ) : null}

      <p className="notice">
        Paid DPR and Pro tools live under{' '}
        <Link href="/account/billing">Billing</Link>,{' '}
        <Link href="/account/dpr">Guided DPR</Link> and{' '}
        <Link href="/account/workspace">Workspace</Link>. Documents never claim
        legal or bank approval.
      </p>

      <AccountSettings
        telegramLinked={user?.telegramChatId != null}
        initialPreferences={{
          emailEnabled: preferences?.emailEnabled ?? true,
          telegramEnabled: preferences?.telegramEnabled ?? false,
          deadlineReminders: preferences?.deadlineReminders ?? true,
          goChangeAlerts: preferences?.goChangeAlerts ?? true,
          vacancyAlerts: preferences?.vacancyAlerts ?? true,
        }}
      />

      <section className="account-card">
        <h2>Projects</h2>
        {stacks.length === 0 ? (
          <p>Save a Matcher result to pin its inputs and ruleset here.</p>
        ) : (
          <ul className="history-list">
            {stacks.map((stack) => (
              <li key={stack.id}>
                <strong>
                  <Link href={`/account/projects/${stack.id}`}>
                    {stack.name}
                  </Link>
                </strong>
                <span>
                  Ruleset {stack.rulesetVersion} ·{' '}
                  {stack.createdAt.toLocaleDateString('en-IN')}
                </span>
                <span>Open facts, assumptions and verified next action</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="account-card">
        <h2>Watched estates</h2>
        {watches.length === 0 ? (
          <p>Watch a published estate to receive verified vacancy changes.</p>
        ) : (
          <ul className="history-list">
            {watches.map((watch) => (
              <li key={watch.estateId}>
                <Link href={`/estates/${watch.slug}`}>{watch.name}</Link>
                <span>Vacancy alerts enabled</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="account-card">
        <h2>Notification history</h2>
        {history.length === 0 ? (
          <p>No notifications have been queued yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((delivery) => (
              <li key={delivery.id}>
                <strong>{delivery.subject}</strong>
                <span>
                  {delivery.channel} · {delivery.status} ·{' '}
                  {delivery.createdAt.toLocaleDateString('en-IN')}
                </span>
                {delivery.lastError === null ? null : (
                  <small>{delivery.lastError}</small>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
