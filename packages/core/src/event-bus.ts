import type { Disposer, EventBusLike, Logger } from './types';

type Handler = (payload: unknown) => void;

/**
 * Minimal synchronous typed event bus. Plugin buses are namespaced views:
 * a plugin emitting 'data' publishes 'plugin:<id>:data' globally, while its
 * `on` hears both its own namespace and global core events verbatim.
 */
export class EventBus implements EventBusLike {
  private handlers = new Map<string, Set<Handler>>();

  constructor(private logger?: Logger) {}

  on<T = unknown>(event: string, handler: (payload: T) => void): Disposer {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
    return () => {
      set.delete(handler as Handler);
      if (set.size === 0) this.handlers.delete(event);
    };
  }

  once<T = unknown>(event: string, handler: (payload: T) => void): Disposer {
    const dispose = this.on<T>(event, (payload) => {
      dispose();
      handler(payload);
    });
    return dispose;
  }

  emit<T = unknown>(event: string, payload?: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        this.logger?.error(`event handler for "${event}" threw`, err);
      }
    }
  }

  /** Namespaced view for one plugin. */
  scoped(pluginId: string): EventBusLike {
    const prefix = `plugin:${pluginId}:`;
    const parent = this;
    return {
      on: (event, handler) =>
        parent.on(event.startsWith('core:') ? event : prefix + event, handler),
      once: (event, handler) =>
        parent.once(event.startsWith('core:') ? event : prefix + event, handler),
      emit: (event, payload) =>
        parent.emit(event.startsWith('core:') ? event : prefix + event, payload),
    };
  }
}
