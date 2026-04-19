require("dotenv").config();
const mongoose = require("mongoose");
const Holding = require("../src/models/holding.model");
const Trade = require("../src/models/trade.model");

const PRODUCT_TYPES = new Set(["DELIVERY", "INTRADAY"]);
const TERMINAL_STATUSES = new Set([
  "EXECUTED",
  "EXECUTED_PENDING_REFLECTION",
  "COMPLETE",
  "CLOSED",
]);

const normalizeProductType = (raw) => {
  const value = typeof raw === "string" ? raw.toUpperCase().trim() : "";
  return value === "INTRADAY" ? "INTRADAY" : "DELIVERY";
};

const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));

const dropLegacyUniqueIndex = async () => {
  const indexes = await Holding.collection.indexes();
  const legacy = indexes.find(
    (idx) => idx?.key?.userId === 1 && idx?.key?.symbol === 1 && !Object.prototype.hasOwnProperty.call(idx.key, "tradeType")
  );
  if (!legacy) {
    console.log("MIGRATION_INFO:LEGACY_INDEX_NOT_FOUND");
    return;
  }
  await Holding.collection.dropIndex(legacy.name);
  console.log(`MIGRATION_INFO:DROPPED_INDEX:${legacy.name}`);
};

const derivePerTypeHoldings = async (session, userId, symbol) => {
  const trades = await Trade.find(
    {
      user: userId,
      symbol,
      type: { $in: ["BUY", "SELL"] },
      status: { $in: Array.from(TERMINAL_STATUSES) },
    },
    { type: 1, productType: 1, quantity: 1, pricePaise: 1, createdAt: 1 }
  )
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();

  const state = {
    DELIVERY: { quantity: 0, avgPricePaise: 0 },
    INTRADAY: { quantity: 0, avgPricePaise: 0 },
  };

  for (const trade of trades) {
    const productType = normalizeProductType(trade.productType);
    const qty = toInt(trade.quantity);
    if (!qty) continue;
    const bucket = state[productType];

    if (trade.type === "BUY") {
      const buyPricePaise = toInt(trade.pricePaise);
      const newQty = bucket.quantity + qty;
      if (newQty <= 0) continue;
      const weighted =
        (bucket.quantity * bucket.avgPricePaise + qty * buyPricePaise) / Math.max(newQty, 1);
      bucket.quantity = newQty;
      bucket.avgPricePaise = Math.round(weighted);
      continue;
    }

    if (trade.type === "SELL") {
      const remaining = Math.max(0, bucket.quantity - qty);
      bucket.quantity = remaining;
      if (!remaining) bucket.avgPricePaise = 0;
    }
  }

  const docs = [];
  for (const tradeType of ["DELIVERY", "INTRADAY"]) {
    const row = state[tradeType];
    if (!row.quantity) continue;
    docs.push({
      userId,
      symbol,
      tradeType,
      quantity: row.quantity,
      avgPricePaise: row.avgPricePaise,
      updatedAt: new Date(),
    });
  }
  return docs;
};

const deriveFallbackDoc = async (session, legacyHolding) => {
  const lastBuy = await Trade.findOne(
    {
      user: legacyHolding.userId,
      symbol: legacyHolding.symbol,
      type: "BUY",
      status: { $in: Array.from(TERMINAL_STATUSES) },
    },
    { productType: 1 }
  )
    .sort({ createdAt: -1, _id: -1 })
    .session(session)
    .lean();

  return {
    userId: legacyHolding.userId,
    symbol: legacyHolding.symbol,
    tradeType: normalizeProductType(lastBuy?.productType || "DELIVERY"),
    quantity: toInt(legacyHolding.quantity),
    avgPricePaise: toInt(legacyHolding.avgPricePaise),
    updatedAt: new Date(),
  };
};

const migrateOneHolding = async (legacyHolding) => {
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const fresh = await Holding.findById(legacyHolding._id).session(session);
      if (!fresh) {
        result = { status: "SKIP_MISSING" };
        return;
      }

      const alreadyTyped = PRODUCT_TYPES.has(String(fresh.tradeType || "").toUpperCase());
      if (alreadyTyped) {
        result = { status: "SKIP_ALREADY_TYPED" };
        return;
      }

      const derivedDocs = await derivePerTypeHoldings(session, fresh.userId, fresh.symbol);
      let docsToInsert = derivedDocs;
      if (!docsToInsert.length) {
        docsToInsert = [await deriveFallbackDoc(session, fresh)];
      }

      await Holding.deleteOne({ _id: fresh._id }).session(session);

      if (docsToInsert.some((doc) => toInt(doc.quantity) > 0)) {
        const nonZero = docsToInsert.filter((doc) => toInt(doc.quantity) > 0);
        await Holding.insertMany(nonZero, { session, ordered: true });
        result = { status: "MIGRATED", inserted: nonZero.length };
      } else {
        result = { status: "REMOVED_ZERO_QTY", inserted: 0 };
      }
    });
  } finally {
    await session.endSession();
  }
  return result;
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI_NOT_SET");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("MIGRATION_INFO:CONNECTED");

  await dropLegacyUniqueIndex();

  const legacyHoldings = await Holding.find(
    {
      $or: [{ tradeType: { $exists: false } }, { tradeType: null }, { tradeType: { $nin: ["DELIVERY", "INTRADAY"] } }],
    },
    { _id: 1, userId: 1, symbol: 1, quantity: 1, avgPricePaise: 1, tradeType: 1 }
  ).lean();

  if (!legacyHoldings.length) {
    await Holding.syncIndexes();
    console.log("MIGRATION_SKIPPED:NO_LEGACY_HOLDINGS");
    await mongoose.disconnect();
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let removed = 0;
  for (const legacyHolding of legacyHoldings) {
    const outcome = await migrateOneHolding(legacyHolding);
    if (outcome?.status === "MIGRATED") migrated += 1;
    if (outcome?.status === "REMOVED_ZERO_QTY") removed += 1;
    if (String(outcome?.status || "").startsWith("SKIP_")) skipped += 1;
  }

  await Holding.syncIndexes();

  const invalidRemaining = await Holding.countDocuments({
    $or: [{ tradeType: { $exists: false } }, { tradeType: { $nin: ["DELIVERY", "INTRADAY"] } }],
  });
  if (invalidRemaining > 0) {
    throw new Error(`MIGRATION_INCOMPLETE_INVALID_TRADE_TYPE_REMAINING:${invalidRemaining}`);
  }

  console.log(
    `MIGRATION_DONE:migrated=${migrated}:removedZeroQty=${removed}:skipped=${skipped}:total=${legacyHoldings.length}`
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`MIGRATION_FAILED:${error.message}`);
  try {
    await mongoose.disconnect();
  } catch (_error) {}
  process.exit(1);
});
