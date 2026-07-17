import { openDB, type IDBPDatabase } from 'idb';
import { MemoryCache, type CacheEntry, type KeyValueCache } from '@earthos/core';

interface StoredEntry {
  value: unknown;
  storedAt: number;
}

/**
 * IndexedDB-backed KeyValueCache (structured clone, survives reloads).
 * All failures degrade to cache misses: a broken IDB must never break data
 * loading, only persistence.
 */
export class IdbCache implements KeyValueCache {
  private db: Promise<IDBPDatabase> | null = null;

  constructor(private dbName = 'earthos-cache') {}

  private open(): Promise<IDBPDatabase> {
    if (!this.db) {
      this.db = openDB(this.dbName, 1, {
        upgrade(db) {
          db.createObjectStore('kv');
        },
      });
    }
    return this.db;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    try {
      const db = await this.open();
      const entry = (await db.get('kv', key)) as StoredEntry | undefined;
      return entry ? { value: entry.value as T, storedAt: entry.storedAt } : undefined;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.open();
      await db.put('kv', { value, storedAt: Date.now() } satisfies StoredEntry, key);
    } catch {
      // Persistence is best-effort.
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.open();
      await db.delete('kv', key);
    } catch {
      // best-effort
    }
  }

  async clearPrefix(prefix: string): Promise<void> {
    try {
      const db = await this.open();
      const range = IDBKeyRange.bound(prefix, prefix + '￿');
      await db.delete('kv', range);
    } catch {
      // best-effort
    }
  }
}

/** Read-through layered cache: fast (memory) in front of slow (IDB). */
export class LayeredCache implements KeyValueCache {
  constructor(
    private fast: KeyValueCache,
    private slow: KeyValueCache,
  ) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const hit = await this.fast.get<T>(key);
    if (hit) return hit;
    const slowHit = await this.slow.get<T>(key);
    if (slowHit) void this.fast.set(key, slowHit.value);
    return slowHit;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await Promise.all([this.fast.set(key, value), this.slow.set(key, value)]);
  }

  async delete(key: string): Promise<void> {
    await Promise.all([this.fast.delete(key), this.slow.delete(key)]);
  }

  async clearPrefix(prefix: string): Promise<void> {
    await Promise.all([this.fast.clearPrefix(prefix), this.slow.clearPrefix(prefix)]);
  }
}

/**
 * The recommended engine cache: memory LRU in front of IndexedDB in the
 * browser, memory only elsewhere (SSR, tests, node scripts).
 */
export function createDefaultCache(): KeyValueCache {
  const memory = new MemoryCache(1000);
  if (typeof indexedDB === 'undefined') return memory;
  return new LayeredCache(memory, new IdbCache());
}
