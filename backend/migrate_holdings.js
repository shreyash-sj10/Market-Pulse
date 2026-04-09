const mongoose = require("mongoose");
const User = require("./src/models/user.model");
const { toSafeKey } = require("./src/utils/safeUtils");
require("dotenv").config();

const migrateKeys = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for migration...");

    const users = await User.find({});
    console.log(`Found ${users.length} users to audit.`);

    for (const user of users) {
      let hasLegacyKeys = false;
      const newHoldings = new Map();

      for (const [key, value] of user.holdings.entries()) {
        const safeKey = toSafeKey(key);
        if (newHoldings.has(safeKey)) {
          const existing = newHoldings.get(safeKey);
          console.log(`User ${user.email}: Merging ${key} into ${safeKey}`);
          
          const totalQty = existing.quantity + value.quantity;
          const weightedAvgCost = ((existing.quantity * existing.avgCost) + (value.quantity * value.avgCost)) / totalQty;
          
          newHoldings.set(safeKey, {
            ...existing,
            quantity: totalQty,
            avgCost: weightedAvgCost
          });
          hasLegacyKeys = true;
        } else {
          newHoldings.set(safeKey, value);
          if (key !== safeKey) hasLegacyKeys = true;
        }
      }

      if (hasLegacyKeys) {
        user.holdings = newHoldings;
      }

      // HEAL: Force sync totalInvested with actual sum
      let correctTotalInvested = 0;
      for (const [_, data] of newHoldings.entries()) {
        correctTotalInvested += (data.quantity * data.avgCost);
      }

      if (Math.abs(user.totalInvested - correctTotalInvested) > 0.01) {
        console.log(`User ${user.email}: Healing totalInvested ${user.totalInvested} -> ${correctTotalInvested}`);
        user.totalInvested = correctTotalInvested;
        hasLegacyKeys = true; // reuse flag to trigger save
      }

      if (hasLegacyKeys) {
        await user.save();
        console.log(`User ${user.email} state synchronized successfully.`);
      }
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

migrateKeys();
