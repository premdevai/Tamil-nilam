import { agencies, playbooks } from './schema/index.js';
import { createDatabase } from './index.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const { db, pool } = createDatabase(databaseUrl);

try {
  await db
    .insert(agencies)
    .values([
      {
        slug: 'tansidco',
        name: 'Tamil Nadu Small Industries Development Corporation',
        nameTa: 'தமிழ்நாடு சிறுதொழில் வளர்ச்சி நிறுவனம்',
        kind: 'tansidco',
        applyUrl: 'https://www.tansidco.tn.gov.in/',
      },
      {
        slug: 'sipcot',
        name: 'State Industries Promotion Corporation of Tamil Nadu',
        nameTa: 'தமிழ்நாடு தொழில் முன்னேற்ற நிறுவனம்',
        kind: 'sipcot',
        applyUrl: 'https://sipcot.tn.gov.in/',
      },
    ])
    .onConflictDoNothing({ target: agencies.slug });

  await db
    .insert(playbooks)
    .values([
      {
        slug: 'first-generation-manufacturer',
        archetype: 'first-generation-manufacturer',
        steps: Array.from({ length: 5 }, (_, index) => ({
          key: String(index),
        })),
      },
      {
        slug: 'micro-food-formalisation',
        archetype: 'micro-food-formalisation',
        steps: Array.from({ length: 5 }, (_, index) => ({
          key: String(index),
        })),
      },
      {
        slug: 'industrial-land-shortlist',
        archetype: 'industrial-land-shortlist',
        steps: Array.from({ length: 5 }, (_, index) => ({
          key: String(index),
        })),
      },
    ])
    .onConflictDoNothing({ target: playbooks.slug });

  console.log('Foundation agencies and playbooks seeded');
} finally {
  await pool.end();
}
