import crypto from 'crypto';

const TOKEN_SECRET = process.env.SESSION_SECRET || 'hrf-chattogram-secure-key-2026-prod';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

export interface SessionPayload {
  userId: number;
  uid: string;
  email: string;
  exp: number;
}

export function createSessionToken(user: { id: number; uid: string; email: string }): string {
  const payload: SessionPayload = {
    userId: user.id,
    uid: user.uid,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');
  return `hrf.${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    if (!token.startsWith('hrf.')) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, data, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(data)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
