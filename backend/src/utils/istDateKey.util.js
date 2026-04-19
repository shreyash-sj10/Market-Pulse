const IST_TZ = "Asia/Kolkata";

/** YYYY-MM-DD in Asia/Kolkata — stable idempotency key for same calendar day. */
function getIstDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

module.exports = { getIstDateKey, IST_TZ };
