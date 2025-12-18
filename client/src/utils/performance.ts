/**
 * Performance Optimization Utilities
 * Provides caching, debouncing, and performance helpers
 */

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expiry: number }>();

/**
 * Cache wrapper for API calls
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> {
  const cached = cache.get(key);

  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  const data = await fetcher();
  cache.set(key, { data, expiry: Date.now() + ttlMs });

  return data;
}

/**
 * Clear specific cache entry or all entries
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Debounce function for reducing API call frequency
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function for limiting call frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Lazy load images with intersection observer
 */
export function setupLazyLoading(): void {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.dataset.src;

          if (dataSrc) {
            img.src = dataSrc;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/**
 * Preload critical resources
 */
export function preloadResources(urls: string[]): void {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;

    if (url.endsWith('.js')) {
      link.as = 'script';
    } else if (url.endsWith('.css')) {
      link.as = 'style';
    } else if (url.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
      link.as = 'image';
    }

    document.head.appendChild(link);
  });
}

/**
 * Simple performance monitoring
 */
export const performanceMonitor = {
  marks: new Map<string, number>(),

  start(label: string): void {
    this.marks.set(label, performance.now());
  },

  end(label: string): number {
    const start = this.marks.get(label);
    if (start) {
      const duration = performance.now() - start;
      this.marks.delete(label);
      console.debug(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  },

  measure(label: string, fn: () => void): void {
    this.start(label);
    fn();
    this.end(label);
  },

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    const result = await fn();
    this.end(label);
    return result;
  },
};

/**
 * Request Animation Frame throttle for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return (...args: Parameters<T>) => {
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  };
}

/**
 * Check if device is mobile for responsive optimizations
 */
export function isMobileDevice(): boolean {
  return (
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  );
}

/**
 * Get optimal image quality based on connection
 */
export function getOptimalImageQuality(): 'low' | 'medium' | 'high' {
  const connection = (navigator as any).connection;

  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'low';
    if (effectiveType === '3g') return 'medium';
  }

  return 'high';
}
