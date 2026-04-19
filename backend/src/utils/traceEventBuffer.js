/**
 * In-memory ring buffer for dev/debug trace reconstruction (optional Task 8).
 * Not durable — production should use log aggregation by traceId field.
 */

const MAX = Number(process.env.TRACE_EVENT_BUFFER_MAX || 400);
const buffer = [];

const push = (entry) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TRACE_BUFFER !== "true") {
    return;
  }
  buffer.push({ ...entry, ts: new Date().toISOString() });
  while (buffer.length > MAX) buffer.shift();
};

const listByTraceId = (traceId) => {
  if (!traceId) return [];
  return buffer.filter((e) => e.traceId === traceId);
};

module.exports = { push, listByTraceId };
