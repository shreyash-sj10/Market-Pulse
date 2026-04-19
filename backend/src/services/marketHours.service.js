const {
  isMarketOpen,
  getMarketClockState,
  isAfterMarketClose,
  isSquareoffWindowEligible,
  getSquareoffMinutesIst,
} = require("../utils/marketHours.util");

module.exports = {
  isMarketOpen,
  getMarketClockState,
  isAfterMarketClose,
  isSquareoffWindowEligible,
  getSquareoffMinutesIst,
};
