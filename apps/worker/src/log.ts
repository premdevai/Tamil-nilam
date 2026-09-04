export function workerLog(event: {
  level: 'info' | 'warn' | 'error';
  message: string;
  [key: string]: unknown;
}): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: 'nilam-worker',
      ...event,
    }),
  );
}
