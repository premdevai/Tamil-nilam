export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEvent = {
  level: LogLevel;
  message: string;
  service?: string;
  requestId?: string;
  route?: string;
  status?: number;
  [key: string]: unknown;
};

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function configuredLogLevel(value = process.env.LOG_LEVEL): LogLevel {
  if (
    value === 'debug' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error'
  ) {
    return value;
  }
  return 'info';
}

export function shouldLog(
  level: LogLevel,
  minimum = configuredLogLevel(),
): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minimum];
}

export function serializeLog(event: LogEvent): string {
  const { level, message, service = 'nilam-web', ...fields } = event;
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service,
    message,
    ...redact(fields),
  });
}

export function log(event: LogEvent, write = console.log): void {
  if (!shouldLog(event.level)) return;
  write(serializeLog(event));
}

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    'email',
    'password',
    'secret',
    'token',
    'authorization',
    'cookie',
    'signature',
  ]);
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => !blocked.has(key.toLowerCase())),
  );
}
