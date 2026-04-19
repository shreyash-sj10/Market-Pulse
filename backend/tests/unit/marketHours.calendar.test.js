/**
 * Tests for the calendar-aware isMarketOpen() and isSquareoffWindowEligible()
 * without requiring a real MongoDB connection or Docker service.
 *
 * Strategy: call refreshCalendarCache() is NOT tested here (it needs DB).
 * Instead we test the exported synchronous functions by directly manipulating
 * the module-level _cache via the refreshCalendarCache mock path.
 *
 * We use jest.doMock / jest.resetModules to reload marketHours.util with
 * a controlled cache state per test group.
 */

const IST_TZ = "Asia/Kolkata";

/** Builds a UTC Date such that the IST wall-clock time equals HH:MM on the given IST date. */
const makeIst = (dateIst, hhmm) => {
  const [yyyy, mm, dd] = dateIst.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  // IST = UTC+5:30 → UTC = IST − 5h30m
  return new Date(Date.UTC(yyyy, mm - 1, dd, h - 5, m - 30));
};

// ---------------------------------------------------------------------------
// Helper to load a fresh module instance with a synthetic calendar cache.
// We expose the internal cache indirectly by monkey-patching the
// MarketCalendar model require before loading the util.
// ---------------------------------------------------------------------------

describe("isMarketOpen — calendar authority", () => {
  let util;

  /** Load marketHours.util with a specific calendar entry pre-seeded. */
  const loadWithEntry = async (entry) => {
    jest.resetModules();

    // Stub MarketCalendar.findOne to return a controlled entry.
    jest.doMock("../../src/models/marketCalendar.model", () => ({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(entry),
      }),
    }));
    // Stub logger to silence output.
    jest.doMock("../../src/utils/logger", () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    util = require("../../src/utils/marketHours.util");
    // Warm the cache so isMarketOpen can see the entry.
    await util.refreshCalendarCache();
    return util;
  };

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  // 1. Normal trading day — should open between 09:15 and 15:30 IST
  it("returns true on a normal weekday within trading hours", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
    const { isMarketOpen } = await loadWithEntry({
      date: today,
      exchange: "XNSE",
      isOpen: true,
      openTime: "09:15",
      closeTime: "15:30",
      isHalfDay: false,
    });

    // 10:30 IST = inside trading window
    const insideWindow = makeIst(today, "10:30");
    expect(isMarketOpen(insideWindow)).toBe(true);
  });

  it("returns false before market open even on a trading day", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
    const { isMarketOpen } = await loadWithEntry({
      date: today,
      isOpen: true,
      openTime: "09:15",
      closeTime: "15:30",
      isHalfDay: false,
    });

    const beforeOpen = makeIst(today, "09:00");
    expect(isMarketOpen(beforeOpen)).toBe(false);
  });

  // 2. Exchange holiday — isOpen=false in calendar
  it("returns false on a known exchange holiday (isOpen=false)", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
    const { isMarketOpen } = await loadWithEntry({
      date: today,
      isOpen: false, // ← holiday
      openTime: "09:15",
      closeTime: "15:30",
      isHalfDay: false,
    });

    const midDay = makeIst(today, "11:00");
    expect(isMarketOpen(midDay)).toBe(false);
  });

  // 3. Half-day — closes early (e.g. Diwali Muhurat: 18:15–20:00 or budget 09:15–13:00)
  it("returns false after early close on a half-day", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
    const { isMarketOpen } = await loadWithEntry({
      date: today,
      isOpen: true,
      openTime: "09:15",
      closeTime: "13:00", // ← early close
      isHalfDay: true,
    });

    const afterHalfClose = makeIst(today, "13:05");
    expect(isMarketOpen(afterHalfClose)).toBe(false);

    const beforeHalfClose = makeIst(today, "12:00");
    expect(isMarketOpen(beforeHalfClose)).toBe(true);
  });

  // 4. Missing calendar entry — fail-safe: return false
  it("returns false (fail-safe) when no calendar entry exists for today", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
    const { isMarketOpen } = await loadWithEntry(null); // ← no record in DB

    const midDay = makeIst(today, "11:00");
    expect(isMarketOpen(midDay)).toBe(false);
  });

  // 5. Date mismatch — cache is for a different day → fail-safe
  it("returns false when cache is stale (different date)", async () => {
    // Load util normally without seeding cache (module is fresh, cache is empty)
    jest.resetModules();
    jest.doMock("../../src/models/marketCalendar.model", () => ({
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    }));
    jest.doMock("../../src/utils/logger", () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));
    const freshUtil = require("../../src/utils/marketHours.util");
    // Do NOT call refreshCalendarCache — cache stays {dateKey: null, entry: null}.

    const now = new Date();
    // Even if it looks like a trading day by clock, cache miss → false
    expect(freshUtil.isMarketOpen(now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSquareoffWindowEligible — holiday veto + time gate
// ---------------------------------------------------------------------------
describe("isSquareoffWindowEligible — calendar holiday veto", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("returns false on a holiday even when squareoff time has passed", async () => {
    jest.resetModules();
    jest.doMock("../../src/utils/logger", () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
    jest.doMock("../../src/models/marketCalendar.model", () => ({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          date: today,
          isOpen: false, // holiday
        }),
      }),
    }));

    const util = require("../../src/utils/marketHours.util");
    await util.refreshCalendarCache();

    process.env.SQUAREOFF_TIME_IST = "15:20";
    const afterSquareoff = makeIst(today, "15:25");
    expect(util.isSquareoffWindowEligible(afterSquareoff)).toBe(false);
    delete process.env.SQUAREOFF_TIME_IST;
  });
});
