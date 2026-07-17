import type { CacheEntry, KeyValueCache } from './types';

/**
 * In-memory KeyValueCache with LRU eviction by entry count. The default
 * engine cache; @earthos/providers layers IndexedDB persistence on top.
 */
export class MemoryCache implements KeyValueCache {
  private map = new Map<string, CacheEntry>();

  constructor(private maxEntries = 500) {}

  get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = this.map.get(key);
    if (entry) {
      // refresh LRU position
      this.map.delete(key);
      this.map.set(key, entry);
    }
    return Promise.resolve(entry as CacheEntry<T> | undefined);
  }

  set<T>(key: string, value: T): Promise<void> {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, storedAt: Date.now() });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }

  clearPrefix(prefix: string): Promise<void> {
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
    return Promise.resolve();
  }
}

/** View of a cache where every key is silently namespaced. */
export function namespacedCache(cache: KeyValueCache, namespace: string): KeyValueCache {
  const prefix = `${namespace}/`;
  return {
    get: (key) => cache.get(prefix + key),
    set: (key, value) => cache.set(prefix + key, value),
    delete: (key) => cache.delete(prefix + key),
    clearPrefix: (p) => cache.clearPrefix(prefix + p),
  };
}
