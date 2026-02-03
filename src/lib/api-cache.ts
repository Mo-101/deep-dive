/**
 * API Cache Utility
 * Reduces API calls by caching responses with TTL
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // Default TTL: 10 minutes for weather data
  private defaultTTL = 10 * 60 * 1000;
  
  // Specific TTLs for different data types
  private ttls: Record<string, number> = {
    'weather': 10 * 60 * 1000,      // 10 minutes
    'forecast': 30 * 60 * 1000,     // 30 minutes
    'cyclone': 60 * 60 * 1000,      // 1 hour
    'outbreak': 30 * 60 * 1000,     // 30 minutes
    'grid-status': 60 * 1000,       // 1 minute
    'fnv3': 6 * 60 * 60 * 1000,     // 6 hours (FNV3 updates every 6h)
  };

  /**
   * Get cached data if valid
   */
  get<T>(key: string, type: string = 'default'): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = this.ttls[type] || this.defaultTTL;
    const now = Date.now();
    
    if (now - entry.timestamp > ttl) {
      // Expired
      this.cache.delete(key);
      return null;
    }

    console.log(`[Cache] Hit: ${key}`);
    return entry.data;
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`[Cache] Stored: ${key}`);
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const apiCache = new APICache();

/**
 * Cached fetch wrapper
 */
export async function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  cacheType: string = 'default'
): Promise<T> {
  const cacheKey = `${options?.method || 'GET'}:${url}`;
  
  // Check cache first
  const cached = apiCache.get<T>(cacheKey, cacheType);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Store in cache
  apiCache.set(cacheKey, data);
  
  return data;
}

export default apiCache;
