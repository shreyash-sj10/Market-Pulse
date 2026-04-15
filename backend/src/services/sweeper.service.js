const { sweepPendingOrders, startSweeper } = require("./order.sweeper");

// Backward-compatible export name for existing imports.
const sweepStaleTrades = sweepPendingOrders;

module.exports = { sweepStaleTrades, sweepPendingOrders, startSweeper };

