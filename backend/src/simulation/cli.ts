/**
 * CLI entry: loads `backend/.env` (path relative to this file), connects Mongo, runs `runSimulation`.
 *
 * Usage (from `backend/`): `npm run simulate`
 * Optional env: SIMULATION_EMAIL, SIMULATION_PASSWORD, SIMULATION_TRADE_COUNT, SIMULATION_SYMBOLS
 *
 * Do not commit real passwords; keep secrets in `.env` (gitignored).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

async function main() {
  // Use runtime import so module evaluation happens after dotenv config.
  const { runSimulation } = await import("./simulationRunner");

  const tradeCount = Number(process.env.SIMULATION_TRADE_COUNT || "50");
  const symbolsRaw = process.env.SIMULATION_SYMBOLS;
  const symbols = symbolsRaw
    ? symbolsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const result = await runSimulation({
    tradeCount: Number.isFinite(tradeCount) ? tradeCount : 50,
    symbols,
    connectDb: true,
  });

  const failedSteps = result.steps
    .map((s, i) => ({ i, ...s }))
    .filter((s) => s.error || s.buySkipReason || s.sellSkipReason);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        summary: result.summary,
        requested: result.requested,
        ...(failedSteps.length
          ? {
              note: "Winston may print [object Object] in the terminal; see backend/logs/combined.log for full JSON.",
              firstFailures: failedSteps.slice(0, 8).map(({ i, symbol, error, buySkipReason, sellSkipReason }) => ({
                stepIndex: i,
                symbol,
                error,
                buySkipReason,
                sellSkipReason,
              })),
            }
          : {}),
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
