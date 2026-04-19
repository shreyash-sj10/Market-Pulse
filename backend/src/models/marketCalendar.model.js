const mongoose = require("mongoose");

/**
 * MARKET CALENDAR
 *
 * Source of truth for whether an exchange is open on a given IST calendar date.
 * Populated by marketCalendarSync.service.js from the trading-calendar Docker service.
 *
 * Fail-safe contract: if no document exists for today → treat market as CLOSED.
 */
const schema = new mongoose.Schema(
  {
    /** IST calendar date in "YYYY-MM-DD" format. */
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    /** ISO 10383 MIC code for the exchange (e.g. "XNSE" for NSE, "XBOM" for BSE). */
    exchange: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "XNSE",
    },
    /** Is this a trading day? false for weekends AND exchange holidays. */
    isOpen: {
      type: Boolean,
      required: true,
    },
    /** Market open time in "HH:MM" IST (e.g. "09:15"). Ignored when isOpen=false. */
    openTime: {
      type: String,
      default: "09:15",
      trim: true,
    },
    /** Market close time in "HH:MM" IST (e.g. "15:30"). Ignored when isOpen=false. */
    closeTime: {
      type: String,
      default: "15:30",
      trim: true,
    },
    /** Half-day session (e.g. Diwali Muhurat, pre-budget). closeTime reflects the early close. */
    isHalfDay: {
      type: Boolean,
      default: false,
    },
  },
  { versionKey: false, timestamps: true }
);

schema.index(
  { date: 1, exchange: 1 },
  { unique: true, name: "calendar_date_exchange_uniq" }
);

module.exports = mongoose.model("MarketCalendar", schema);
