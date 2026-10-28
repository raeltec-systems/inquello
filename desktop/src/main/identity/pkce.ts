/**
 * PKCE (RFC 7636) and the one-use `state` for the system-browser sign-in.
 *
 * The verifier is 32 random bytes in base64url (43 characters, inside the
 * 43–128 range); the challenge is its S256 hash. `state` and the
 * per-sign-in values never leave the main process except as the parameters the
 * protocol requires.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export interface Pkce {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export function base64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

export function isCodeVerifier(value: string): boolean {
  return VERIFIER_PATTERN.test(value);
}

export function s256Challenge(verifier: string): string {
  if (!isCodeVerifier(verifier)) throw new Error('invalid PKCE verifier');
  return base64url(createHash('sha256').update(verifier, 'ascii').digest());
}

export function createPkce(random: (size: number) => Buffer = randomBytes): Pkce {
  const verifier = base64url(random(32));
  return { verifier, challenge: s256Challenge(verifier), method: 'S256' };
}

/** A fresh random `state` (256 bits, base64url). */
export function createState(random: (size: number) => Buffer = randomBytes): string {
  return base64url(random(32));
}

/** Constant-time string equality for secrets such as `state`. */
export function secretEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
