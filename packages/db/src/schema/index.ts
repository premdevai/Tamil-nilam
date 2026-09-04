import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const geography = customType<{ data: string }>({
  dataType() {
    return 'geography';
  },
});

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const agencyKind = pgEnum('agency_kind', [
  'tansidco',
  'sipcot',
  'government',
  'financial',
  'other',
]);
export const plotStatus = pgEnum('plot_status', [
  'vacant',
  'allotted',
  'litigation',
  'reserved',
  'pending_cancel',
  'unknown',
]);
export const schemeLevel = pgEnum('scheme_level', ['central', 'state']);
export const conflictKind = pgEnum('conflict_kind', ['exclusive', 'caution']);
export const confirmationLevel = pgEnum('confirmation_level', [
  'go_text',
  'dic_written',
  'dic_verbal',
  'inferred',
]);
export const verificationAction = pgEnum('verification_action', [
  'created',
  'verified',
  'published',
  'corrected',
  'retired',
]);
export const reviewStatus = pgEnum('review_status', [
  'pending',
  'approved',
  'rejected',
  'needs_changes',
]);
export const userRole = pgEnum('user_role', [
  'user',
  'consultant',
  'reviewer',
  'admin',
]);
export const subscriptionStatus = pgEnum('subscription_status', [
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
]);
export const paymentStatus = pgEnum('payment_status', [
  'created',
  'authorized',
  'captured',
  'failed',
  'refunded',
]);
export const dprStatus = pgEnum('dpr_status', [
  'queued',
  'generating',
  'ready',
  'failed',
  'expired',
]);
export const bulkRunStatus = pgEnum('bulk_run_status', [
  'queued',
  'running',
  'ready',
  'failed',
]);
export const notificationChannel = pgEnum('notification_channel', [
  'email',
  'telegram',
]);
export const notificationStatus = pgEnum('notification_status', [
  'queued',
  'sending',
  'delivered',
  'failed',
  'suppressed',
]);
export const operationJobStatus = pgEnum('operation_job_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export const accountRequestStatus = pgEnum('account_request_status', [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export const agencies = pgTable(
  'agencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    nameTa: text('name_ta'),
    kind: agencyKind('kind').notNull(),
    applyUrl: text('apply_url'),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [uniqueIndex('agencies_slug_idx').on(table.slug)],
);

export const sourceDocuments = pgTable(
  'source_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id').references(() => agencies.id),
    title: text('title').notNull(),
    url: text('url').notNull(),
    contentHash: text('content_hash'),
    publishedOn: date('published_on'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    mimeType: text('mime_type'),
    storageKey: text('storage_key'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('source_documents_url_hash_idx').on(
      table.url,
      table.contentHash,
    ),
    index('source_documents_agency_idx').on(table.agencyId),
  ],
);

export const estates = pgTable(
  'estates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id),
    sourceDocumentId: uuid('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    nameTa: text('name_ta'),
    district: text('district').notNull(),
    block: text('block'),
    backwardBlock: boolean('backward_block').default(false).notNull(),
    centroid: geography('centroid'),
    boundary: geography('boundary'),
    rates: jsonb('rates')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    infrastructure: jsonb('infrastructure')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    sourceUrl: text('source_url').notNull(),
    verifiedOn: date('verified_on').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('estates_slug_idx').on(table.slug),
    index('estates_district_idx').on(table.district),
    index('estates_centroid_gist_idx').using('gist', table.centroid),
    index('estates_boundary_gist_idx').using('gist', table.boundary),
  ],
);

export const plots = pgTable(
  'plots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    estateId: uuid('estate_id')
      .notNull()
      .references(() => estates.id),
    sourceDocumentId: uuid('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id),
    plotNumber: text('plot_number').notNull(),
    areaCents: numeric('area_cents', { precision: 14, scale: 4 }),
    status: plotStatus('status').default('unknown').notNull(),
    geom: geography('geom'),
    sourceSyncedAt: timestamp('source_synced_at', {
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('plots_estate_number_idx').on(table.estateId, table.plotNumber),
    index('plots_status_idx').on(table.status),
    index('plots_filter_idx').on(table.estateId, table.status, table.areaCents),
    index('plots_geom_gist_idx').using('gist', table.geom),
  ],
);

export const schemes = pgTable(
  'schemes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    nameTa: text('name_ta'),
    level: schemeLevel('level').notNull(),
    department: text('department').notNull(),
    summaryMd: text('summary_md').notNull(),
    applyStepsMd: text('apply_steps_md').notNull(),
    docsChecklist: jsonb('docs_checklist')
      .$type<string[]>()
      .default([])
      .notNull(),
    portalUrl: text('portal_url'),
    sunsetDate: date('sunset_date'),
    ...timestamps,
  },
  (table) => [uniqueIndex('schemes_slug_idx').on(table.slug)],
);

export const goReferences = pgTable(
  'go_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    schemeId: uuid('scheme_id')
      .notNull()
      .references(() => schemes.id),
    sourceDocumentId: uuid('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id),
    goNumber: text('go_number').notNull(),
    goDate: date('go_date').notNull(),
    url: text('url').notNull(),
    summary: text('summary').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('go_references_scheme_number_idx').on(
      table.schemeId,
      table.goNumber,
    ),
  ],
);

export const ruleVersions = pgTable(
  'rule_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    schemeId: uuid('scheme_id')
      .notNull()
      .references(() => schemes.id),
    goReferenceId: uuid('go_reference_id')
      .notNull()
      .references(() => goReferences.id),
    version: integer('version').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    ruleJson: jsonb('rule_json').$type<Record<string, unknown>>().notNull(),
    verifiedOn: date('verified_on').notNull(),
    verifiedBy: text('verified_by').notNull(),
    changelogMd: text('changelog_md').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('rule_versions_scheme_version_idx').on(
      table.schemeId,
      table.version,
    ),
    check(
      'rule_versions_effective_range_check',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
);

export const conflictPairs = pgTable(
  'conflict_pairs',
  {
    schemeAId: uuid('scheme_a_id')
      .notNull()
      .references(() => schemes.id),
    schemeBId: uuid('scheme_b_id')
      .notNull()
      .references(() => schemes.id),
    kind: conflictKind('kind').notNull(),
    rationaleMd: text('rationale_md').notNull(),
    confirmedAt: confirmationLevel('confirmed_at').notNull(),
    goReferenceId: uuid('go_reference_id').references(() => goReferences.id),
    verifiedOn: date('verified_on').notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.schemeAId, table.schemeBId] }),
    check(
      'conflict_pairs_order_check',
      sql`${table.schemeAId} <> ${table.schemeBId}`,
    ),
  ],
);

export const playbooks = pgTable(
  'playbooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    archetype: text('archetype').notNull(),
    steps: jsonb('steps')
      .$type<Record<string, unknown>[]>()
      .default([])
      .notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('playbooks_slug_idx').on(table.slug)],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email'),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    telegramChatId: text('telegram_chat_id'),
    name: text('name'),
    image: text('image'),
    role: userRole('role').default('user').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_telegram_chat_idx').on(table.telegramChatId),
  ],
);

export const authAccounts = pgTable(
  'auth_accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index('auth_accounts_user_idx').on(table.userId),
  ],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [index('auth_sessions_user_idx').on(table.userId)],
);

export const authVerificationTokens = pgTable(
  'auth_verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
    uniqueIndex('auth_verification_tokens_token_idx').on(table.token),
  ],
);

export const authAuthenticators = pgTable(
  'auth_authenticators',
  {
    credentialID: text('credential_id').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerAccountId: text('provider_account_id').notNull(),
    credentialPublicKey: text('credential_public_key').notNull(),
    counter: integer('counter').notNull(),
    credentialDeviceType: text('credential_device_type').notNull(),
    credentialBackedUp: boolean('credential_backed_up').notNull(),
    transports: text('transports'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.credentialID] }),
    index('auth_authenticators_user_idx').on(table.userId),
  ],
);

export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    version: text('version').notNull(),
    granted: boolean('granted').notNull(),
    source: text('source').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('consent_records_user_idx').on(table.userId, table.recordedAt),
  ],
);

export const auditRecords = pgTable(
  'audit_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('audit_records_actor_idx').on(table.actorId, table.createdAt),
    index('audit_records_target_idx').on(table.targetType, table.targetId),
  ],
);

export const telegramLinkTokens = pgTable(
  'telegram_link_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('telegram_link_tokens_hash_idx').on(table.tokenHash),
    index('telegram_link_tokens_user_idx').on(table.userId, table.createdAt),
  ],
);

export const accountDataRequests = pgTable(
  'account_data_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    status: accountRequestStatus('status').default('queued').notNull(),
    storageKey: text('storage_key'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    error: text('error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('account_data_requests_user_idx').on(table.userId, table.createdAt),
    check(
      'account_data_requests_kind_check',
      sql`${table.kind} in ('export', 'deletion')`,
    ),
  ],
);

export const verificationLogs = pgTable(
  'verification_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: verificationAction('action').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    actorLabel: text('actor_label').notNull(),
    sourceDocumentId: uuid('source_document_id').references(
      () => sourceDocuments.id,
    ),
    note: text('note'),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('verification_logs_entity_idx').on(table.entityType, table.entityId),
  ],
);

export const reviewItems = pgTable(
  'review_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(),
    entityKey: text('entity_key').notNull(),
    sourceDocumentId: uuid('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id),
    status: reviewStatus('status').default('pending').notNull(),
    proposedData: jsonb('proposed_data')
      .$type<Record<string, unknown>>()
      .notNull(),
    fieldDiff: jsonb('field_diff')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    ...timestamps,
  },
  (table) => [
    index('review_items_status_idx').on(table.status, table.createdAt),
  ],
);

export const savedStacks = pgTable(
  'saved_stacks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    telegramChatId: text('telegram_chat_id'),
    name: text('name').default('Saved stack').notNull(),
    inputs: jsonb('inputs').$type<Record<string, unknown>>().notNull(),
    resultSnapshot: jsonb('result_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    resultHash: text('result_hash').notNull(),
    rulesetVersion: text('ruleset_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('saved_stacks_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('saved_stacks_user_hash_idx').on(
      table.userId,
      table.resultHash,
    ),
  ],
);

export const watchedEstates = pgTable(
  'watched_estates',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    estateId: uuid('estate_id')
      .notNull()
      .references(() => estates.id, { onDelete: 'cascade' }),
    vacancyAlerts: boolean('vacancy_alerts').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.estateId] }),
    index('watched_estates_estate_idx').on(table.estateId),
  ],
);

export const userPlaybookProgress = pgTable(
  'user_playbook_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    playbookId: uuid('playbook_id')
      .notNull()
      .references(() => playbooks.id, { onDelete: 'cascade' }),
    completedStepKeys: jsonb('completed_step_keys')
      .$type<string[]>()
      .default([])
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.playbookId] })],
);

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  telegramEnabled: boolean('telegram_enabled').default(false).notNull(),
  deadlineReminders: boolean('deadline_reminders').default(true).notNull(),
  goChangeAlerts: boolean('go_change_alerts').default(true).notNull(),
  vacancyAlerts: boolean('vacancy_alerts').default(true).notNull(),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  ...timestamps,
});

export const impactEvents = pgTable(
  'impact_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: text('kind').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    versionKey: text('version_key').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('impact_events_version_idx').on(
      table.kind,
      table.entityType,
      table.entityId,
      table.versionKey,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    impactEventId: uuid('impact_event_id').references(() => impactEvents.id, {
      onDelete: 'set null',
    }),
    channel: notificationChannel('channel').notNull(),
    kind: text('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: notificationStatus('status').default('queued').notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('notification_deliveries_idempotency_idx').on(
      table.idempotencyKey,
    ),
    index('notification_deliveries_retry_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('notification_deliveries_user_idx').on(table.userId, table.createdAt),
  ],
);

export const operationJobs = pgTable(
  'operation_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    task: text('task').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    status: operationJobStatus('status').default('queued').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('operation_jobs_idempotency_idx').on(table.idempotencyKey),
    index('operation_jobs_status_idx').on(table.status, table.nextAttemptAt),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    providerSubscriptionId: text('provider_subscription_id').notNull(),
    provider: text('provider').default('razorpay').notNull(),
    plan: text('plan').notNull(),
    status: subscriptionStatus('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    gracePeriodEnd: timestamp('grace_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    lastProviderEventAt: timestamp('last_provider_event_at', {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('subscriptions_provider_id_idx').on(
      table.providerSubscriptionId,
    ),
    index('subscriptions_user_idx').on(table.userId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    providerPaymentId: text('provider_payment_id').notNull(),
    providerOrderId: text('provider_order_id'),
    provider: text('provider').default('razorpay').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    currency: text('currency').default('INR').notNull(),
    status: paymentStatus('status').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    rawPayload: jsonb('raw_payload')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('payments_provider_id_idx').on(table.providerPaymentId),
    uniqueIndex('payments_provider_order_idx').on(table.providerOrderId),
    uniqueIndex('payments_idempotency_idx').on(table.idempotencyKey),
    check('payments_amount_positive_check', sql`${table.amountPaise} > 0`),
  ],
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    signature: text('signature').notNull(),
    payloadHash: text('payload_hash').notNull(),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('payment_webhook_events_provider_id_idx').on(
      table.provider,
      table.providerEventId,
    ),
    index('payment_webhook_events_unprocessed_idx').on(table.processedAt),
  ],
);

export const paymentReceipts = pgTable(
  'payment_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    receiptNumber: text('receipt_number').notNull(),
    providerReceiptUrl: text('provider_receipt_url'),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
  },
  (table) => [
    uniqueIndex('payment_receipts_payment_idx').on(table.paymentId),
    uniqueIndex('payment_receipts_number_idx').on(table.receiptNumber),
  ],
);

export const entitlements = pgTable(
  'entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('entitlements_source_key_idx').on(
      table.userId,
      table.key,
      table.sourceType,
      table.sourceId,
    ),
    index('entitlements_access_idx').on(
      table.userId,
      table.key,
      table.endsAt,
      table.revokedAt,
    ),
  ],
);

export const clientWorkspaces = pgTable(
  'client_workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    consultantUserId: uuid('consultant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contactEmail: text('contact_email'),
    externalReference: text('external_reference'),
    notes: text('notes'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('client_workspaces_consultant_idx').on(
      table.consultantUserId,
      table.createdAt,
    ),
  ],
);

export const businessProfiles = pgTable(
  'business_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientWorkspaceId: uuid('client_workspace_id').references(
      () => clientWorkspaces.id,
      { onDelete: 'cascade' },
    ),
    name: text('name').notNull(),
    profileData: jsonb('profile_data')
      .$type<Record<string, unknown>>()
      .notNull(),
    profileHash: text('profile_hash').notNull(),
    ...timestamps,
  },
  (table) => [
    index('business_profiles_owner_idx').on(table.ownerUserId, table.createdAt),
    uniqueIndex('business_profiles_owner_hash_idx').on(
      table.ownerUserId,
      table.profileHash,
    ),
  ],
);

export const bulkStackRuns = pgTable(
  'bulk_stack_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientWorkspaceId: uuid('client_workspace_id').references(
      () => clientWorkspaces.id,
      { onDelete: 'cascade' },
    ),
    status: bulkRunStatus('status').default('queued').notNull(),
    inputRows: jsonb('input_rows').$type<Record<string, unknown>[]>().notNull(),
    resultSnapshot: jsonb('result_snapshot')
      .$type<Record<string, unknown>[]>()
      .default([])
      .notNull(),
    rowCount: integer('row_count').notNull(),
    rulesetVersion: text('ruleset_version').notNull(),
    error: text('error'),
    ...timestamps,
  },
  (table) => [
    index('bulk_stack_runs_owner_idx').on(table.ownerUserId, table.createdAt),
  ],
);

export const usageLedger = pgTable(
  'usage_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    capability: text('capability').notNull(),
    periodKey: text('period_key').notNull(),
    quantity: integer('quantity').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('usage_ledger_idempotency_idx').on(table.idempotencyKey),
    index('usage_ledger_quota_idx').on(
      table.userId,
      table.capability,
      table.periodKey,
    ),
    check('usage_ledger_quantity_positive_check', sql`${table.quantity} > 0`),
  ],
);

export const generatedDprs = pgTable(
  'generated_dprs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    paymentId: uuid('payment_id').references(() => payments.id),
    clientWorkspaceId: uuid('client_workspace_id').references(
      () => clientWorkspaces.id,
      { onDelete: 'set null' },
    ),
    businessProfileId: uuid('business_profile_id').references(
      () => businessProfiles.id,
      { onDelete: 'set null' },
    ),
    status: dprStatus('status').default('queued').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    inputSnapshot: jsonb('input_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    rulesetSnapshot: jsonb('ruleset_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    inputHash: text('input_hash').notNull(),
    rulesetHash: text('ruleset_hash').notNull(),
    validationWarnings: jsonb('validation_warnings')
      .$type<string[]>()
      .default([])
      .notNull(),
    documentVersion: integer('document_version').default(1).notNull(),
    docxStorageKey: text('docx_storage_key'),
    pdfStorageKey: text('pdf_storage_key'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    error: text('error'),
    generationAttempts: integer('generation_attempts').default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index('generated_dprs_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('generated_dprs_idempotency_idx').on(
      table.userId,
      table.idempotencyKey,
    ),
    check(
      'generated_dprs_document_version_positive_check',
      sql`${table.documentVersion} > 0`,
    ),
  ],
);

export const printableReports = pgTable(
  'printable_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientWorkspaceId: uuid('client_workspace_id').references(
      () => clientWorkspaces.id,
      { onDelete: 'set null' },
    ),
    status: dprStatus('status').default('queued').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    inputSnapshot: jsonb('input_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    rulesetSnapshot: jsonb('ruleset_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    inputHash: text('input_hash').notNull(),
    rulesetHash: text('ruleset_hash').notNull(),
    documentVersion: integer('document_version').default(1).notNull(),
    docxStorageKey: text('docx_storage_key'),
    pdfStorageKey: text('pdf_storage_key'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    error: text('error'),
    generationAttempts: integer('generation_attempts').default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index('printable_reports_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('printable_reports_idempotency_idx').on(
      table.userId,
      table.idempotencyKey,
    ),
    check(
      'printable_reports_document_version_positive_check',
      sql`${table.documentVersion} > 0`,
    ),
  ],
);

export const staging = pgSchema('staging');

export const rawSourceSnapshots = staging.table(
  'raw_source_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connector: text('connector').notNull(),
    sourceUrl: text('source_url').notNull(),
    contentHash: text('content_hash').notNull(),
    rawBody: bytea('raw_body').notNull(),
    mimeType: text('mime_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('raw_source_snapshots_connector_hash_idx').on(
      table.connector,
      table.contentHash,
    ),
  ],
);

export const stagedRecords = staging.table(
  'records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => rawSourceSnapshots.id),
    entityType: text('entity_type').notNull(),
    entityKey: text('entity_key').notNull(),
    normalizedData: jsonb('normalized_data')
      .$type<Record<string, unknown>>()
      .notNull(),
    fieldDiff: jsonb('field_diff')
      .$type<Record<string, unknown>[]>()
      .default([])
      .notNull(),
    sourceUrl: text('source_url').notNull(),
    verifiedOn: date('verified_on'),
    deadlineOn: date('deadline_on'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('staged_records_entity_idx').on(table.entityType, table.entityKey),
    uniqueIndex('staged_records_snapshot_entity_idx').on(
      table.snapshotId,
      table.entityType,
      table.entityKey,
    ),
  ],
);

export const stagedReviewQueue = staging.table(
  'review_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => rawSourceSnapshots.id),
    entityType: text('entity_type').notNull(),
    entityKey: text('entity_key').notNull(),
    proposedData: jsonb('proposed_data')
      .$type<Record<string, unknown>>()
      .notNull(),
    fieldDiff: jsonb('field_diff')
      .$type<Record<string, unknown>[]>()
      .default([])
      .notNull(),
    sourceUrl: text('source_url').notNull(),
    contentHash: text('content_hash').notNull(),
    status: reviewStatus('status').default('pending').notNull(),
    reviewedData: jsonb('reviewed_data').$type<Record<string, unknown>>(),
    reviewer: text('reviewer'),
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('staged_review_queue_status_idx').on(table.status, table.createdAt),
    uniqueIndex('staged_review_queue_snapshot_entity_idx').on(
      table.snapshotId,
      table.entityType,
      table.entityKey,
    ),
  ],
);

export const stagedReviewActions = staging.table(
  'review_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewItemId: uuid('review_item_id')
      .notNull()
      .references(() => stagedReviewQueue.id),
    action: text('action').notNull(),
    actor: text('actor').notNull(),
    note: text('note').notNull(),
    reviewedData: jsonb('reviewed_data').$type<Record<string, unknown>>(),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('staged_review_actions_item_idx').on(table.reviewItemId, table.at),
    check(
      'staged_review_actions_action_check',
      sql`${table.action} in ('approved', 'rejected', 'needs_changes')`,
    ),
  ],
);

export const publicationVersions = pgTable(
  'publication_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewItemId: uuid('review_item_id')
      .notNull()
      .references(() => stagedReviewQueue.id),
    entityType: text('entity_type').notNull(),
    entityKey: text('entity_key').notNull(),
    version: integer('version').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    verifier: text('verifier').notNull(),
    citationUrl: text('citation_url').notNull(),
    sourceHash: text('source_hash').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('publication_versions_entity_version_idx').on(
      table.entityType,
      table.entityKey,
      table.version,
    ),
    index('publication_versions_review_item_idx').on(table.reviewItemId),
  ],
);

export const correctiveVersions = pgTable(
  'corrective_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publicationVersions.id),
    replacementPublicationId: uuid('replacement_publication_id').references(
      () => publicationVersions.id,
    ),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    reason: text('reason').notNull(),
    proposedData: jsonb('proposed_data')
      .$type<Record<string, unknown>>()
      .notNull(),
    status: reviewStatus('status').default('pending').notNull(),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('corrective_versions_status_idx').on(table.status, table.createdAt),
  ],
);

export const publicationOutbox = pgTable(
  'publication_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publicationVersions.id),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('publication_outbox_publication_kind_idx').on(
      table.publicationId,
      table.kind,
    ),
    index('publication_outbox_unprocessed_idx').on(table.processedAt),
  ],
);
