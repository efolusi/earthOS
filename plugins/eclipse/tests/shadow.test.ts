import { describe, expect, it } from 'vitest';
import { shadowAt } from '../src/shadow';

describe('solar eclipse shadow', () => {
  it('finds totality on 2026-08-12 crossing the North Atlantic corridor', () => {
    // Peak of the 2026-08-12 total eclipse is ~17:46 UTC.
    const s = shadowAt(Date.UTC(2026, 7, 12, 17, 46));
    expect(s.hit).toBe(true);
    expect(s.umbraKm).toBeGreaterThan(0); // total, not annular
    expect(s.umbraKm).toBeLessThan(200);
    expect(s.penumbraKm).toBeGreaterThan(2000);
    // Iceland -> Spain corridor.
    expect(s.latDeg).toBeGreaterThan(25);
    expect(s.latDeg).toBeLessThan(75);
    expect(s.lonDeg).toBeGreaterThan(-45);
    expect(s.lonDeg).toBeLessThan(10);
  });

  it('sweeps west-to-east-ish over the eclipse window', () => {
    const early = shadowAt(Date.UTC(2026, 7, 12, 17, 0));
    const late = shadowAt(Date.UTC(2026, 7, 12, 18, 20));
    expect(early.hit).toBe(true);
    expect(late.hit).toBe(true);
    expect(early.latDeg).toBeGreaterThan(late.latDeg); // path descends toward Iberia
  });

  it('misses the Earth on an ordinary day', () => {
    expect(shadowAt(Date.UTC(2026, 7, 5, 17, 46)).hit).toBe(false);
    expect(shadowAt(Date.UTC(2026, 6, 18, 12, 0)).hit).toBe(false);
  });
});
