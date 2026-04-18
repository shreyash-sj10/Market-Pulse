/**
 * Seeds realistic holdings + trade history for ONE user (local / QA only).
 *
 * Creates:
 *   - 10 open positions (10 distinct .NS symbols)
 *   - 6 closed round-trips (FIFO: BUY → full SELL → re-BUY) so journal/profile see closed trades
 *   - 4 symbols with a single BUY only
 *
 * Usage (from backend/):
 *   node scripts/seedPortfolioDemo.js <email> [--replace]
 *
 *   --replace  Deletes ALL Trade + Holding rows for that user first (only that user).
 *
 * Env:
 *   MONGO_URI | MONGODB_URI
 *   SEED_USER_BALANCE_PAISE  optional cash balance after seed (default 800_000_000)
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const path = require("path");
const { randomUUID } = require("crypto");

const User = require(path.join(__dirname, "..", "src", "models", "user.model"));
const Holding = require(path.join(__dirname, "..", "src", "models", "holding.model"));
const Trade = require(path.join(__dirname, "..", "src", "models", "trade.model"));

const { mapToClosedTrades } = require(path.join(__dirname, "..", "src", "domain", "closedTrade.mapper"));
const { normalizeTrade } = require(path.join(__dirname, "..", "src", "domain", "trade.contract"));

/** @typedef {{ symbol: string; leg: 'cycle' | 'open'; buy1?: { q: number; p: number }; sell?: { q: number; p: number }; buy2?: { q: number; p: number }; single?: { q: number; p: number } }} Row */

/** @type {Row[]} */
const PLAN = [
  { symbol: "RELIANCE.NS", leg: "cycle", buy1: { q: 8, p: 285000 }, sell: { q: 8, p: 292500 }, buy2: { q: 3, p: 288000 } },
  { symbol: "TCS.NS", leg: "cycle", buy1: { q: 5, p: 382000 }, sell: { q: 5, p: 378000 }, buy2: { q: 2, p: 380000 } },
  { symbol: "INFY.NS", leg: "cycle", buy1: { q: 12, p: 152000 }, sell: { q: 12, p: 158800 }, buy2: { q: 6, p: 155000 } },
  { symbol: "HDFCBANK.NS", leg: "cycle", buy1: { q: 10, p: 168000 }, sell: { q: 10, p: 172400 }, buy2: { q: 4, p: 169500 } },
  { symbol: "ICICIBANK.NS", leg: "cycle", buy1: { q: 20, p: 112000 }, sell: { q: 20, p: 115800 }, buy2: { q: 10, p: 113500 } },
  { symbol: "SBIN.NS", leg: "cycle", buy1: { q: 25, p: 78000 }, sell: { q: 25, p: 80500 }, buy2: { q: 12, p: 79200 } },
  { symbol: "ITC.NS", leg: "open", single: { q: 40, p: 42500 } },
  { symbol: "WIPRO.NS", leg: "open", single: { q: 30, p: 26500 } },
  { symbol: "LT.NS", leg: "open", single: { q: 6, p: 358000 } },
  { symbol: "BHARTIARTL.NS", leg: "open", single: { q: 15, p: 168500 } },
];

function computeRr(entryP, slP, tpP) {
  const risk = Math.abs(entryP - slP);
  const reward = Math.abs(tpP - entryP);
  if (risk === 0) return 1.5;
  return Number((reward / risk).toFixed(2));
}

function buyDoc(userId, symbol, qty, pricePaise, when, extras = {}) {
  const sl = Math.round(pricePaise * 0.97);
  const tp = Math.round(pricePaise * 1.06);
  const rr = computeRr(pricePaise, sl, tp);
  const totalValuePaise = Math.round(qty * pricePaise);
  return {
    user: userId,
    idempotencyKey: `seed-${randomUUID()}`,
    symbol,
    type: "BUY",
    status: "EXECUTED",
    reflectionStatus: null,
    quantity: qty,
    pricePaise,
    totalValuePaise,
    priceSource: "REAL",
    stopLossPaise: sl,
    targetPricePaise: tp,
    rr,
    reason: "Seed demo entry",
    userThinking: extras.userThinking || `Demo thesis: disciplined ${symbol} swing — risk framed with SL/TP.`,
    entryPlan: {
      entryPricePaise: pricePaise,
      stopLossPaise: sl,
      targetPricePaise: tp,
      rr,
      intent: "DEMO_SEED",
      reasoning: "Deterministic seed data for UI verification.",
    },
    decisionSnapshot: { verdict: "BUY", score: 72, pillars: {} },
    createdAt: when,
    updatedAt: when,
  };
}

function sellDoc(userId, symbol, qty, pricePaise, when, entryTradeId, pnlPaise, pnlPct, extras = {}) {
  const totalValuePaise = Math.round(qty * pricePaise);
  return {
    user: userId,
    idempotencyKey: `seed-${randomUUID()}`,
    symbol,
    type: "SELL",
    status: "EXECUTED",
    reflectionStatus: "DONE",
    quantity: qty,
    pricePaise,
    totalValuePaise,
    priceSource: "REAL",
    entryTradeId,
    pnlPaise,
    pnlPct,
    reason: "Seed demo exit",
    userThinking: extras.userThinking || "Demo exit — booked P&L for journal coverage.",
    learningOutcome: {
      verdict: pnlPaise >= 0 ? "DISCIPLINED_PROFIT" : "DISCIPLINED_LOSS",
      type: "SEED",
      context: "Synthetic history",
      insight: pnlPaise >= 0 ? "Plan held; exit matched thesis." : "Controlled loss within plan.",
      improvementSuggestion: "Keep journaling entries after live trades.",
    },
    analysis: {
      riskScore: pnlPaise >= 0 ? 68 : 55,
      mistakeTags: [],
      explanation: "Seed trade — no live model run.",
    },
    createdAt: when,
    updatedAt: when,
  };
}

async function createTrade(doc) {
  const [t] = await Trade.create([doc]);
  return t;
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--replace");
  const replace = process.argv.includes("--replace");
  const email = (argv[0] || "").trim().toLowerCase();

  if (!email) {
    console.error("Usage: node scripts/seedPortfolioDemo.js <user-email> [--replace]");
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGO_URI or MONGODB_URI");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user with email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const userId = user._id;

  if (replace) {
    const tr = await Trade.deleteMany({ user: userId });
    const ho = await Holding.deleteMany({ userId });
    console.log(`Removed existing data for ${email}: trades=${tr.deletedCount}, holdings=${ho.deletedCount}`);
  } else {
    const existingH = await Holding.countDocuments({ userId });
    const existingT = await Trade.countDocuments({ user: userId });
    if (existingH > 0 || existingT > 0) {
      console.error(
        `User already has ${existingH} holding(s) and ${existingT} trade(s). Re-run with --replace to wipe that user's trades+holdings, or use another account.`,
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  const now = Date.now();
  let day = 0;
  const nextDay = () => {
    day += 1;
    return new Date(now - (90 - day) * 86400000);
  };

  let realizedPnL = 0;
  const holdingRows = [];

  for (const row of PLAN) {
    const sym = row.symbol.toUpperCase();

    if (row.leg === "open" && row.single) {
      const t = nextDay();
      await createTrade(buyDoc(userId, sym, row.single.q, row.single.p, t));
      holdingRows.push({
        userId,
        symbol: sym,
        quantity: row.single.q,
        avgPricePaise: row.single.p,
        updatedAt: new Date(),
      });
      continue;
    }

    if (row.leg === "cycle" && row.buy1 && row.sell && row.buy2) {
      const t1 = nextDay();
      const buy1 = await createTrade(
        buyDoc(userId, sym, row.buy1.q, row.buy1.p, t1, {
          userThinking: `Opened ${sym} — first tranche (seed).`,
        }),
      );

      const t2 = nextDay();
      const entryVal = row.buy1.q * row.buy1.p;
      const exitVal = row.sell.q * row.sell.p;
      const pnlPaise = Math.round(exitVal - entryVal);
      const pnlPct = entryVal > 0 ? Number(((pnlPaise / entryVal) * 100).toFixed(2)) : 0;
      realizedPnL += pnlPaise;

      await createTrade(
        sellDoc(userId, sym, row.sell.q, row.sell.p, t2, buy1._id, pnlPaise, pnlPct, {
          userThinking: `Closed first tranche on ${sym} (seed).`,
        }),
      );

      const t3 = nextDay();
      await createTrade(
        buyDoc(userId, sym, row.buy2.q, row.buy2.p, t3, {
          userThinking: `Re-entered ${sym} after first exit — current open lot (seed).`,
        }),
      );

      holdingRows.push({
        userId,
        symbol: sym,
        quantity: row.buy2.q,
        avgPricePaise: row.buy2.p,
        updatedAt: new Date(),
      });
    }
  }

  await Holding.insertMany(holdingRows);

  let totalInvested = 0;
  for (const h of holdingRows) {
    totalInvested += Math.round(h.quantity * h.avgPricePaise);
  }

  const balanceAfter =
    Number(process.env.SEED_USER_BALANCE_PAISE) || Math.max(800_000_000, totalInvested * 3 + realizedPnL + 100_000_000);

  user.balance = balanceAfter;
  user.totalInvested = totalInvested;
  user.realizedPnL = replace ? realizedPnL : (user.realizedPnL || 0) + realizedPnL;
  user.reservedBalancePaise = 0;
  user.analyticsSnapshot = {
    ...(user.analyticsSnapshot || {}),
    lastUpdated: new Date(0),
    skillScore: user.analyticsSnapshot?.skillScore ?? 52,
    disciplineScore: user.analyticsSnapshot?.disciplineScore ?? 58,
    trend: "STABLE",
    tags: user.analyticsSnapshot?.tags?.length ? user.analyticsSnapshot.tags : ["DEMO_SEED"],
  };
  await user.save();

  const trades = await Trade.find({ user: userId }).sort({ createdAt: 1 });
  const normalized = trades.map((t) => normalizeTrade(t));
  let closed;
  try {
    closed = mapToClosedTrades(normalized);
  } catch (e) {
    console.error("FIFO validation failed:", e.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Seeded user ${email}`);
  console.log(`  Holdings: ${holdingRows.length}`);
  console.log(`  Trades: ${trades.length}`);
  console.log(`  Closed pairs (journal): ${closed.length}`);
  console.log(`  totalInvested (paise): ${totalInvested}`);
  console.log(`  realizedPnL added (paise): ${realizedPnL}`);
  console.log(`  balance (paise): ${user.balance}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
