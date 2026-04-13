const isMarketOpen = (now = new Date()) => {
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);
  const day = istDate.getDay(); // 0: Sunday, 6: Saturday
  
  if (day === 0 || day === 6) {
    return false;
  }
  
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  const openTime = 9 * 60 + 15;
  const closeTime = 15 * 60 + 30;
  
  return timeInMinutes >= openTime && timeInMinutes <= closeTime;
};

module.exports = {
  isMarketOpen
};
