const { EventEmitter } = require("events");
class TradeEventBus extends EventEmitter {}
const eventBus = new TradeEventBus();
module.exports = eventBus;
