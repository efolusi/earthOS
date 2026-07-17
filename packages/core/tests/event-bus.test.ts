import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/event-bus';

describe('EventBus', () => {
  it('delivers to subscribers and supports disposal', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    const dispose = bus.on('x', spy);
    bus.emit('x', 1);
    dispose();
    bus.emit('x', 2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('once fires a single time', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.once('x', spy);
    bus.emit('x');
    bus.emit('x');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a throwing handler does not break other handlers', () => {
    const bus = new EventBus({ debug() {}, info() {}, warn() {}, error() {} });
    const good = vi.fn();
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.on('x', good);
    bus.emit('x');
    expect(good).toHaveBeenCalled();
  });

  it('scoped buses namespace plugin events but pass core events through', () => {
    const bus = new EventBus();
    const scoped = bus.scoped('starlink');
    const local = vi.fn();
    const global = vi.fn();
    const core = vi.fn();

    scoped.on('data', local);
    bus.on('plugin:starlink:data', global);
    scoped.on('core:time:change', core);

    scoped.emit('data', 42);
    bus.emit('core:time:change', { rate: 2 });

    expect(local).toHaveBeenCalledWith(42);
    expect(global).toHaveBeenCalledWith(42);
    expect(core).toHaveBeenCalledWith({ rate: 2 });
  });
});
