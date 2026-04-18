export const normalizeResponse = (res) => res?.data ?? res ?? {};

/**
 * Global Market Data Normalizer (Part 1, Task 4)
 */
export function normalizeMarketData(res) {
  const payload = normalizeResponse(res)?.data || {};
  return {
    indices: Array.isArray(payload.indices) ? payload.indices : (Array.isArray(payload) ? payload : []),
    degraded: !!normalizeResponse(res)?.degraded
  };
}


/**
 * Part 1, Task 2: Forced safe array guard
 */
export const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
