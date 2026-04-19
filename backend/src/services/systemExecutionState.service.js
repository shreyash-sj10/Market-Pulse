const SystemExecutionState = require("../models/systemExecutionState.model");
const logger = require("../utils/logger");

const STALE_MS_DEFAULT = 30 * 60 * 1000;
const STUCK_WARN_MS_DEFAULT = 3 * 60 * 1000;

function isLegacyCompleted(doc) {
  if (!doc) return false;
  if (doc.status === "COMPLETED") return true;
  if (doc.executedAt && doc.status !== "RUNNING") return true;
  return false;
}

function staleRunningMs() {
  const n = Number(process.env.SQUAREOFF_CLAIM_STALE_MS || STALE_MS_DEFAULT);
  return Number.isFinite(n) && n > 0 ? n : STALE_MS_DEFAULT;
}

function stuckWarnMs() {
  const n = Number(process.env.SQUAREOFF_STUCK_WARN_MS || STUCK_WARN_MS_DEFAULT);
  return Number.isFinite(n) && n > 0 ? n : STUCK_WARN_MS_DEFAULT;
}

function isCorruptedLegacy(doc) {
  return Boolean(doc && !doc.status && !doc.executedAt);
}

/**
 * Atomically claim a unique execution key. Mongo is the authority (survives Redis down).
 * Reclaims stale RUNNING rows (crash mid-run) after SQUAREOFF_CLAIM_STALE_MS.
 * FAILED rows (after abort) are reclaimed for retry while preserving failure metadata until reclaim.
 */
async function claimExecution(key, { _recursed = false } = {}) {
  try {
    const doc = await SystemExecutionState.create({
      key,
      status: "RUNNING",
      startedAt: new Date(),
      executedAt: null,
    });
    return doc;
  } catch (err) {
    if (err?.code !== 11000) throw err;

    const existing = await SystemExecutionState.findOne({ key }).lean();
    if (!existing) {
      if (_recursed) return null;
      return claimExecution(key, { _recursed: true });
    }

    if (isCorruptedLegacy(existing)) {
      await SystemExecutionState.deleteOne({ key });
      if (_recursed) return null;
      return claimExecution(key, { _recursed: true });
    }

    if (isLegacyCompleted(existing)) return null;

    if (existing.status === "FAILED") {
      const reclaimed = await SystemExecutionState.findOneAndUpdate(
        { key, status: "FAILED" },
        {
          $set: {
            status: "RUNNING",
            startedAt: new Date(),
            executedAt: null,
          },
          $unset: { failedAt: 1, lastErrorMessage: 1 },
        },
        { new: true }
      );
      if (reclaimed) return reclaimed;
      if (_recursed) return null;
      return claimExecution(key, { _recursed: true });
    }

    if (existing.status === "RUNNING") {
      const started = existing.startedAt ? new Date(existing.startedAt).getTime() : 0;
      const ageMs = started ? Date.now() - started : 0;
      if (started && ageMs > staleRunningMs()) {
        await SystemExecutionState.deleteOne({ key, status: "RUNNING" });
        if (_recursed) return null;
        return claimExecution(key, { _recursed: true });
      }
      if (started && ageMs > stuckWarnMs()) {
        logger.warn({
          event: "SQUAREOFF_STUCK",
          key,
          startedAt: existing.startedAt,
          ageMs,
        });
      }
      return null;
    }

    return null;
  }
}

async function completeExecution(key) {
  await SystemExecutionState.updateOne(
    { key, status: "RUNNING" },
    {
      $set: {
        status: "COMPLETED",
        executedAt: new Date(),
      },
      $unset: { failedAt: 1, lastErrorMessage: 1 },
    }
  );
}

/** Mark RUNNING as FAILED so the same key can be reclaimed after a thrown error (audit trail). */
async function abortExecution(key, lastErrorMessage = "") {
  const msg = String(lastErrorMessage || "").slice(0, 500);
  await SystemExecutionState.updateOne(
    { key, status: "RUNNING" },
    {
      $set: {
        status: "FAILED",
        failedAt: new Date(),
        lastErrorMessage: msg || "(no message)",
      },
    }
  );
}

module.exports = {
  claimExecution,
  completeExecution,
  abortExecution,
};
