import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCODING = 'base64url';
const PREFIX = 'nilam-secret:v1';

export function secretsKey(
  environment: NodeJS.ProcessEnv = process.env,
): Buffer {
  const configured = environment.SECRETS_ENCRYPTION_KEY;
  if (configured !== undefined && /^[0-9a-f]{64}$/i.test(configured)) {
    return Buffer.from(configured, 'hex');
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error(
      'SECRETS_ENCRYPTION_KEY must be 32 bytes of hex in production.',
    );
  }
  return Buffer.from('11'.repeat(32), 'hex');
}

export function encryptSecret(
  plaintext: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretsKey(environment), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString(ENCODING),
    tag.toString(ENCODING),
    encrypted.toString(ENCODING),
  ].join('.');
}

export function decryptSecret(
  payload: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const [prefix, ivPart, tagPart, bodyPart] = payload.split('.');
  if (
    prefix !== PREFIX ||
    ivPart === undefined ||
    tagPart === undefined ||
    bodyPart === undefined
  ) {
    throw new Error('Encrypted secret payload is malformed.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    secretsKey(environment),
    Buffer.from(ivPart, ENCODING),
  );
  decipher.setAuthTag(Buffer.from(tagPart, ENCODING));
  return Buffer.concat([
    decipher.update(Buffer.from(bodyPart, ENCODING)),
    decipher.final(),
  ]).toString('utf8');
}
