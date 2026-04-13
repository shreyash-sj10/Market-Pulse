require("dotenv").config();
const mongoose = require("mongoose");
const Trade = require("../src/models/trade.model");

const CANONICAL_KEYS = new Set(["_id", "pricePaise", "stopLossPaise", "targetPricePaise", "pnlPct"]);

const isMissing = (value) => value === undefined || value === null;

const inspectTrade = (trade) => {
  const issues = [];

  if (isMissing(trade.pricePaise)) {
    issues.push("MISSING_pricePaise");
  }

  if (isMissing(trade.stopLossPaise)) {
    issues.push("MISSING_stopLossPaise");
  }

  if (isMissing(trade.targetPricePaise)) {
    issues.push("MISSING_targetPricePaise");
  }

  const nonCanonicalKeys = Object.keys(trade).filter((key) => !CANONICAL_KEYS.has(key));
  if (nonCanonicalKeys.length > 0) {
    issues.push(`NON_CANONICAL_KEYS_PRESENT:${nonCanonicalKeys.join(",")}`);
  }

  return issues;
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI_NOT_SET");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log("[strictAudit] Connected");

  const projection = {
    _id: 1,
    pricePaise: 1,
    stopLossPaise: 1,
    targetPricePaise: 1,
    pnlPct: 1,
  };

  const cursor = Trade.find({}, projection).lean().cursor();

  let totalRecords = 0;
  let validCount = 0;
  let invalidCount = 0;
  const invalidExamples = [];

  for await (const trade of cursor) {
    totalRecords += 1;
    const issues = inspectTrade(trade);

    if (issues.length === 0) {
      validCount += 1;
      continue;
    }

    invalidCount += 1;
    const entry = {
      tradeId: String(trade._id),
      issues,
    };

    console.log(JSON.stringify(entry));
    if (invalidExamples.length < 10) {
      invalidExamples.push(entry);
    }
  }

  console.log("[strictAudit] SUMMARY");
  console.log(
    JSON.stringify(
      {
        totalRecords,
        validCount,
        invalidCount,
      },
      null,
      2
    )
  );

  console.log("[strictAudit] INVALID_RECORD_EXAMPLES");
  console.log(JSON.stringify(invalidExamples, null, 2));
};

run()
  .then(async () => {
    await mongoose.disconnect();
    console.log("[strictAudit] Completed");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[strictAudit] Failed:", error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
