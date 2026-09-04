import { createDatabase } from '@nilam/db';

type DatabaseConnection = ReturnType<typeof createDatabase>;

const globalDatabase = globalThis as typeof globalThis & {
  nilamDatabase?: DatabaseConnection;
};

export function getDatabase(): DatabaseConnection {
  if (globalDatabase.nilamDatabase !== undefined) {
    return globalDatabase.nilamDatabase;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required for authenticated features');
  }

  const connection = createDatabase(databaseUrl);
  if (process.env.NODE_ENV !== 'production') {
    globalDatabase.nilamDatabase = connection;
  }
  return connection;
}
