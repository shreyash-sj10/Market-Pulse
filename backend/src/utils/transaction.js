const mongoose = require("mongoose");
const logger = require("./logger");

/**
 * Execute a block of code within a Mongoose transaction with automatic retry
 * logic for TransientTransactionErrors.
 * 
 * @param {Function} work - Async function containing the transactional logic. 
 *                          Receives 'session' as an argument.
 * @param {number} retries - Max number of retries (default 3).
 */
const runInTransaction = async (work, retries = 8) => {
  let attempt = 0;
  
  while (attempt < retries) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      const hasTransientLabel =
        typeof error?.hasErrorLabel === "function" &&
        (error.hasErrorLabel("TransientTransactionError") ||
          error.hasErrorLabel("UnknownTransactionCommitResult"));
      /** WiredTiger write races on the same document (e.g. concurrent BUY reserve same user). */
      const isWriteConflict =
        error?.code === 112 || /write conflict/i.test(String(error?.message || ""));

      const isTransient = hasTransientLabel || isWriteConflict;
      attempt++;

      if (isTransient && attempt < retries) {
        logger.warn({
          service: "transaction",
          step: "TRANSACTION_RETRY",
          status: "WARN",
          data: { attempt, message: error?.message, code: error?.code },
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      throw error;
    } finally {
      session.endSession();
    }
  }
};

module.exports = { runInTransaction };
