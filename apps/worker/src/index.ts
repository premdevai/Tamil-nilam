import { run, type Runner } from 'graphile-worker';

import { WORKER_CRONTAB } from './cron.js';
import { getWorkerEnv } from './env.js';
import { workerLog } from './log.js';
import { createTaskList } from './tasks.js';

const env = getWorkerEnv();

const runner: Runner = await run({
  connectionString: env.DATABASE_URL,
  concurrency: env.WORKER_CONCURRENCY,
  crontab: WORKER_CRONTAB,
  noHandleSignals: true,
  taskList: createTaskList(),
});

async function shutdown(signal: string) {
  workerLog({ level: 'info', message: 'worker_stopping', signal });
  await runner.stop();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

workerLog({
  level: 'info',
  message: 'worker_started',
  concurrency: env.WORKER_CONCURRENCY,
  logLevel: env.LOG_LEVEL,
});
