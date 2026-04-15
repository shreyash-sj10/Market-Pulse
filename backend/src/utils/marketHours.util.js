const IST_TZ = "Asia/Kolkata";
const OPEN_MINUTES = 9 * 60 + 15;
const CLOSE_MINUTES = 15 * 60 + 30;

const getIstParts = (date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TZ,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) map[part.type] = part.value;
  return map;
};

const toWeekdayIndex = (weekdayShort) => {
  const map = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekdayShort] ?? -1;
};

const isMarketOpen = (now = new Date()) => {
  const parts = getIstParts(now);
  const day = toWeekdayIndex(parts.weekday);
  if (day === 0 || day === 6) return false;

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= OPEN_MINUTES && totalMinutes <= CLOSE_MINUTES;
};

module.exports = { isMarketOpen };

