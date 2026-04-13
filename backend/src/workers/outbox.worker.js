const Outbox = require("../models/outbox.model");
const { tradeQueue } = require("../queue/queue");
const logger = require("../lib/logger");

const processOutbox = async () => {
  try {
    const messages = await Outbox.find({ status: "PENDING" }).limit(50);
    
    for (const msg of messages) {
      if (msg.type === "TRADE_CLOSED") {
        await tradeQueue.add("TRADE_CLOSED", msg.payload, {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 }
        });
      }
      
      msg.status = "SENT";
      await msg.save();
    }
  } catch (error) {
    logger.error(`[Outbox Worker] Error processing pending outbox messages: \${error.message}`);
  }
};

const startOutboxWorker = () => {
  setInterval(processOutbox, 5000);
  logger.info("[Outbox Worker] Polling started.");
};

module.exports = { startOutboxWorker, processOutbox };
