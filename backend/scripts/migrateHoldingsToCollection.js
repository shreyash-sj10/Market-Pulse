require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user.model");
const Holding = require("../src/models/holding.model");

const parseLegacyHoldings = (legacy) => {
  if (!legacy || typeof legacy !== "object") return [];
  return Object.entries(legacy).map(([rawSymbol, value]) => {
    const symbol = String(rawSymbol || "").replace(/_/g, ".").toUpperCase().trim();
    const quantity = Number(value?.quantity) || 0;
    const avgPricePaise = Math.round(Number(value?.avgCost ?? value?.avgPricePaise ?? 0));
    return { symbol, quantity, avgPricePaise };
  }).filter((item) => item.symbol && item.quantity > 0);
};

const sumQuantity = (rows) => rows.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0);

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await Holding.syncIndexes();

  const legacyUsers = await mongoose.connection.collection("users")
    .find({ holdings: { $exists: true, $ne: {} } })
    .toArray();

  if (!legacyUsers.length) {
    console.log("MIGRATION_SKIPPED:NO_LEGACY_HOLDINGS");
    await mongoose.disconnect();
    return;
  }

  let migratedUsers = 0;
  for (const legacyUser of legacyUsers) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const parsed = parseLegacyHoldings(legacyUser.holdings);
        const expectedQty = sumQuantity(parsed);
        const existingCount = await Holding.countDocuments({ userId: legacyUser._id }).session(session);
        if (existingCount > 0) {
          throw new Error(`MIGRATION_CONFLICT_EXISTING_HOLDINGS:${legacyUser._id}`);
        }

        for (const holding of parsed) {
          await Holding.create([{
            userId: legacyUser._id,
            symbol: holding.symbol,
            quantity: holding.quantity,
            avgPricePaise: holding.avgPricePaise,
            updatedAt: new Date(),
          }], { session });
        }

        const postHoldings = await Holding.find({ userId: legacyUser._id }).session(session);
        const migratedQty = sumQuantity(postHoldings);

        if (migratedQty !== expectedQty) {
          throw new Error(`MIGRATION_QUANTITY_MISMATCH:${legacyUser._id}:${expectedQty}:${migratedQty}`);
        }

        await mongoose.connection.collection("users").updateOne(
          { _id: legacyUser._id },
          { $unset: { holdings: "" } },
          { session }
        );

        await User.updateOne(
          { _id: legacyUser._id },
          { $set: { totalInvested: postHoldings.reduce((acc, h) => acc + (h.quantity * h.avgPricePaise), 0) } },
          { session }
        );
      });
      migratedUsers += 1;
    } finally {
      await session.endSession();
    }
  }

  console.log(`MIGRATION_DONE:${migratedUsers}`);
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(`MIGRATION_FAILED:${error.message}`);
  try {
    await mongoose.disconnect();
  } catch (_error) {}
  process.exit(1);
});
