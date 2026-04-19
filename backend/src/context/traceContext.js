const { AsyncLocalStorage } = require("async_hooks");

const als = new AsyncLocalStorage();

/**
 * Run callback with trace + user context (propagates through async/await).
 */
const runWithTrace = (store, callback) => {
  const base = {
    traceId: store.traceId,
    userId: store.userId != null ? String(store.userId) : null,
  };
  return als.run(base, callback);
};

const getStore = () => als.getStore();

const getTraceId = () => getStore()?.traceId || null;

const getUserId = () => getStore()?.userId || null;

const mergeTraceUser = (userId) => {
  const s = getStore();
  if (s && userId != null) {
    s.userId = String(userId);
  }
};

module.exports = {
  runWithTrace,
  getStore,
  getTraceId,
  getUserId,
  mergeTraceUser,
};
