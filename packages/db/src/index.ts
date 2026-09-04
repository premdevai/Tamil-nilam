import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';

import * as schema from './schema/index';

const databaseUrlSchema = z.string().url().startsWith('postgresql://');

export function createDatabase(databaseUrl: string) {
  const connectionString = databaseUrlSchema.parse(databaseUrl);
  const pool = new Pool({ connectionString });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}

export * from './schema/index';
