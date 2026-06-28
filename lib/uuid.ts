/**
 * Client-generated UUID v4 using the Web Crypto API.
 * Available in React Native 0.71+ (Hermes) and Node.js 19+ (test env).
 */
export function uuid(): string {
  return crypto.randomUUID();
}
