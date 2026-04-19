/**
 * Lightweight request / error counters for observability (additive).
 */

let requestsTotal = 0;
let errorsTotal = 0;

const onRequest = (req, res, next) => {
  requestsTotal += 1;
  const done = () => {
    res.removeListener("finish", done);
    if (res.statusCode >= 400) {
      errorsTotal += 1;
    }
  };
  res.on("finish", done);
  next();
};

const snapshot = () => ({
  requestsTotal,
  errorsTotal,
  uptimeSeconds: Math.round(process.uptime()),
});

module.exports = { onRequest, snapshot };
