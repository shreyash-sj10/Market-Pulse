/**
 * Lightweight process-local flags set from server startup (not cluster-wide).
 * Surfaced on /ready and /health for operators.
 */
const state = {
  stopLossMonitor: false,
  outboxWorker: false,
  sweeper: false,
  executionExecutor: false,
  squareoffMode: "off",
  bullmqReflectionWorker: false,
  bullmqSquareoffWorker: false,
};

const mark = (key, value = true) => {
  if (Object.prototype.hasOwnProperty.call(state, key)) {
    state[key] = value;
  }
};

const snapshot = () => ({ ...state });

module.exports = { mark, snapshot };
