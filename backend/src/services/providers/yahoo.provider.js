const PQueue = require("p-queue").default;
const YahooFinance = require("yahoo-finance2").default;
const { toPaise, enforcePaise } = require("../../utils/paise");
const { normalizeSymbol } = require("../../utils/symbol.utils");

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Same global pacing as legacy market snapshots — avoids Yahoo rate-limit spikes. */
const externalQuoteQueue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
  interval: 12000,
});

async function getLivePriceFromYahoo(symbol) {
  const apiSymbol = normalizeSymbol(symbol);
  const raw = await externalQuoteQueue.add(() => yahooFinance.quote(apiSymbol));

  if (raw.currency && raw.currency !== "INR") {
    throw new Error("NON_INR_CURRENCY");
  }
  if (!raw || raw.regularMarketPrice == null) {
    throw new Error("NO_DATA");
  }

  const pricePaise = enforcePaise(toPaise(raw.regularMarketPrice), "yahoo_price");
  if (pricePaise <= 100) {
    throw new Error("INVALID_PRICE_BAND");
  }
  return pricePaise;
}

module.exports = {
  getLivePriceFromYahoo,
};
