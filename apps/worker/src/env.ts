import { z } from 'zod';

export const workerEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(20).default(2),
  DOCUMENT_STORAGE_DIR: z.string().min(1).optional(),
});

export function getWorkerEnv() {
  return workerEnvSchema.parse(process.env);
}
