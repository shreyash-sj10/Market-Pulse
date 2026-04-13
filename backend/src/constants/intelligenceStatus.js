const INTELLIGENCE_STATUS = Object.freeze({
  VALID: "VALID",
  UNAVAILABLE: "UNAVAILABLE",
});

const createValidStatus = (meta = {}) => ({
  status: INTELLIGENCE_STATUS.VALID,
  ...meta,
});

const createUnavailableStatus = (reason) => ({
  status: INTELLIGENCE_STATUS.UNAVAILABLE,
  reason: reason || "UNKNOWN_UNAVAILABLE_REASON",
});

const isValidStatus = (payload) => payload?.status === INTELLIGENCE_STATUS.VALID;

module.exports = {
  INTELLIGENCE_STATUS,
  createValidStatus,
  createUnavailableStatus,
  isValidStatus,
};
