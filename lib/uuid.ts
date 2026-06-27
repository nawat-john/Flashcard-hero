/**
 * Client-generated UUID v4. Used so rows created offline get a stable id up
 * front (no server round-trip, no id remapping when the outbox is flushed).
 * Not cryptographically strong, but collision risk is negligible for our use.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
