const mongoose = require('mongoose');

/**
 * Execute a block of code within a Mongoose transaction with automatic retry
 * logic for TransientTransactionErrors.
 * 
 * @param {Function} work - Async function containing the transactional logic. 
 *                          Receives 'session' as an argument.
 * @param {number} retries - Max number of retries (default 3).
 */
const runInTransaction = async (work, retries = 3) => {
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
      
      const isTransient = error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError');
      attempt++;
      
      if (isTransient && attempt < retries) {
        console.warn(`[Transaction] Transient error, retrying attempt ${attempt + 1}...`);
        continue;
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }
};

module.exports = { runInTransaction };
