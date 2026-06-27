import { uuid } from '@/lib/uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid()', () => {
  it('produces a valid v4 UUID', () => {
    expect(uuid()).toMatch(UUID_V4);
  });

  it('generates unique values across many calls', () => {
    const ids = new Set(Array.from({ length: 2000 }, uuid));
    expect(ids.size).toBe(2000);
  });

  it('version nibble is always 4', () => {
    for (let i = 0; i < 50; i++) {
      expect(uuid()[14]).toBe('4');
    }
  });

  it('variant nibble is always 8, 9, a or b', () => {
    for (let i = 0; i < 50; i++) {
      expect(uuid()[19]).toMatch(/[89ab]/);
    }
  });
});
