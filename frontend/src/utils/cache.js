// Simple cache utility for faster loading
const CACHE_DURATION = 30000; // 30 seconds

export const cacheManager = {
  set: (key, data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      sessionStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  },

  get: (key) => {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Return cached data if less than 30 seconds old
      if (age < CACHE_DURATION) {
        return data;
      }

      // Clear old cache
      sessionStorage.removeItem(key);
      return null;
    } catch (error) {
      return null;
    }
  },

  clear: (key) => {
    try {
      if (key) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.clear();
      }
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }
};
