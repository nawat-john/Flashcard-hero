/**
 * Client-generated UUID v4. Used so rows created offline get a stable id
 * up front (no server round-trip, no id remapping when the outbox is flushed).
 *
 * Resolution order (most → least secure):
 *   1. globalThis.crypto.randomUUID()  — native in Hermes (RN 0.73+) / Node 19+
 *   2. globalThis.crypto.getRandomValues() — available in Hermes (RN 0.72+) / Node 15+
 *   3. Math.random() fallback — only for very old Hermes builds in Expo Go
 *
 * Bare `crypto` is not always in scope in Hermes/Metro modules, so we always
 * go through globalThis to avoid ReferenceErrors.
 */
export function uuid(): string {
  const c = (globalThis as any).crypto as Crypto | undefined;

  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }

  if (typeof c?.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
    buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10xx
    const h = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // Last resort: Math.random (same entropy as the original implementation).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
