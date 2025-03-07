/**
 * Cache interface for token storage
 */
export interface CacheInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<string>;
  del(key: string): Promise<number>;
}

/**
 * In-memory cache implementation for Edge Runtime
 */
class MemoryCache implements CacheInterface {
  private static instance: MemoryCache;
  private cache: Map<string, { value: string; expiry: number | null }> = new Map();

  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<string> {
    let expiry: number | null = null;
    
    if (options && options.EX) {
      expiry = Date.now() + (options.EX * 1000);
    }
    
    this.cache.set(key, { value, expiry });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.cache.delete(key);
    return deleted ? 1 : 0;
  }
}

/**
 * Get a cache instance that works in Edge Runtime
 */
const getCache = async (): Promise<CacheInterface> => {
  console.log('Using Memory Cache for Edge Runtime');
  return MemoryCache.getInstance();
};

export default getCache;
