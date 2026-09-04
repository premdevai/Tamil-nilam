export const WORKER_CRONTAB = [
  '* * * * * run_operations ?id=run-operations&fill=1m',
  '* * * * * process_publication_impacts ?id=publication-impacts&fill=1m',
  '*/2 * * * * deliver_notifications ?id=deliver-notifications&fill=2m',
  '0 3 * * * scan_deadlines ?id=scan-deadlines&fill=1d',
].join('\n');
