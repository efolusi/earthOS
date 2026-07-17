import { describe, expect, it, vi } from 'vitest';
import { TimeEngine } from '../src/time-engine';

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('TimeEngine', () => {
  it('starts live, tracking the wall clock', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    expect(time.live).toBe(true);
    expect(time.now()).toBe(1_000_000);
    clock.advance(500);
    expect(time.now()).toBe(1_000_500);
    expect(time.rate).toBe(1);
  });

  it('advances at the configured rate after leaving live mode', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    time.setRate(100);
    clock.advance(1000);
    expect(time.now()).toBe(1_000_000 + 100_000);
  });

  it('pauses at rate 0', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    time.pause();
    const frozen = time.now();
    clock.advance(10_000);
    expect(time.now()).toBe(frozen);
  });

  it('jumps without a rate change and continues from there', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    time.setRate(2);
    time.jumpTo(5_000_000);
    clock.advance(100);
    expect(time.now()).toBe(5_000_200);
  });

  it('setRate re-anchors so there is no discontinuity', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    time.setRate(10);
    clock.advance(100); // sim +1000
    const before = time.now();
    time.setRate(1);
    expect(time.now()).toBe(before);
  });

  it('resumeLive returns to wall clock', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    time.jumpTo(0);
    time.resumeLive();
    expect(time.live).toBe(true);
    expect(time.now()).toBe(clock.now());
  });

  it('fires change events on jump/rate/live transitions only', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    const events: string[] = [];
    time.onChange((e) => events.push(e.type));

    time.now();
    clock.advance(50);
    time.now();
    expect(events).toEqual([]);

    time.setRate(10); // live -> false, rate
    time.jumpTo(123); // jump
    time.resumeLive(); // live, jump
    expect(events).toEqual(['live', 'rate', 'jump', 'live', 'jump']);
  });

  it('setRate(1) while live is a no-op', () => {
    const clock = fakeClock();
    const time = new TimeEngine({ clock: clock.now });
    const spy = vi.fn();
    time.onChange(spy);
    time.setRate(1);
    expect(spy).not.toHaveBeenCalled();
    expect(time.live).toBe(true);
  });
});
