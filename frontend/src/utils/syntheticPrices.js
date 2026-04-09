/**
 * Approximate base prices (INR) for NSE stocks.
 * Used as seeds for the synthetic price walk when live data is unavailable.
 */
export const BASE_PRICES = {
  // Large Cap
  "RELIANCE.NS": 1280, "TCS.NS": 3500, "HDFCBANK.NS": 1620,
  "BHARTIARTL.NS": 1550, "ICICIBANK.NS": 1250, "INFOSYS.NS": 1580,
  "SBIN.NS": 820, "HINDUNILVR.NS": 2350, "ITC.NS": 455, "BAJFINANCE.NS": 6800,
  "LT.NS": 3500, "HCLTECH.NS": 1550, "MARUTI.NS": 12500, "SUNPHARMA.NS": 1750,
  "KOTAKBANK.NS": 1900, "TITAN.NS": 3200, "ONGC.NS": 270, "AXISBANK.NS": 1100,
  "ASIANPAINT.NS": 2400, "ULTRACEMCO.NS": 10500, "BAJAJ-AUTO.NS": 9200,
  "WIPRO.NS": 480, "NESTLEIND.NS": 2300, "JSWSTEEL.NS": 920, "TATAMOTORS.NS": 750,
  "M&M.NS": 2900, "POWERGRID.NS": 320, "NTPC.NS": 355, "TATASTEEL.NS": 145,
  "TECHM.NS": 1550, "ADANIENT.NS": 2400, "ADANIPORTS.NS": 1350, "COALINDIA.NS": 415,
  "GRASIM.NS": 2700, "DRREDDY.NS": 1250, "DIVISLAB.NS": 5200, "CIPLA.NS": 1580,
  "EICHERMOT.NS": 4800, "HINDALCO.NS": 650, "VEDL.NS": 450, "IOC.NS": 148,
  "BPCL.NS": 310, "BRITANNIA.NS": 5100, "PIDILITIND.NS": 2900, "HDFCLIFE.NS": 680,
  "SBILIFE.NS": 1580, "SHREECEM.NS": 27000, "APOLLOHOSP.NS": 6800,
  "TATACONSUM.NS": 1050, "AMBUJACEM.NS": 560,
  // Mid Cap
  "BANKBARODA.NS": 240, "COLPAL.NS": 2700, "DABUR.NS": 520, "GODREJCP.NS": 1250,
  "MARICO.NS": 620, "BERGEPAINT.NS": 450, "HAVELLS.NS": 1650, "VOLTAS.NS": 1450,
  "CROMPTON.NS": 390, "AUBANK.NS": 580, "IDFCFIRSTB.NS": 68, "FEDERALBNK.NS": 185,
  "INDUSINDBK.NS": 960, "BANDHANBNK.NS": 175, "TORNTPHARM.NS": 3200, "LUPIN.NS": 2200,
  "BIOCON.NS": 345, "AUROPHARMA.NS": 1150, "MUTHOOTFIN.NS": 2100, "CHOLAFIN.NS": 1250,
  "LICHSGFIN.NS": 620, "PEL.NS": 1050, "OBEROIRLTY.NS": 1900, "DLF.NS": 850,
  "GODREJPROP.NS": 2200, "PRESTIGE.NS": 1750, "ABCAPITAL.NS": 195, "TATACOMM.NS": 1850,
  "MPHASIS.NS": 2800, "LTTS.NS": 5100, "COFORGE.NS": 7200, "PERSISTENT.NS": 5400,
  "KPITTECH.NS": 1650, "TATAELXSI.NS": 6000, "IRCTC.NS": 770, "DMART.NS": 4200,
  "NYKAA.NS": 175, "ZOMATO.NS": 235, "PAYTM.NS": 540, "INDIAMART.NS": 2800,
  "POLICYBZR.NS": 1650, "CAMS.NS": 4200, "BSE.NS": 5500, "ANGELONE.NS": 2900,
  "BALKRISIND.NS": 2600, "BOSCHLTD.NS": 38000, "MOTHERSON.NS": 145,
  "APOLLOTYRE.NS": 520, "MRF.NS": 138000, "CUMMINSIND.NS": 3500,
  // Small Cap
  "RVNL.NS": 420, "IRFC.NS": 175, "HUDCO.NS": 215, "NHPC.NS": 95,
  "SJVN.NS": 115, "RITES.NS": 620, "IRCON.NS": 235, "NBCC.NS": 105,
  "HFCL.NS": 145, "STLTECH.NS": 185, "RAILTEL.NS": 380, "TATATECH.NS": 1050,
  "HAPPSTMNDS.NS": 680, "RATEGAIN.NS": 750, "TANLA.NS": 1000, "MAPMYINDIA.NS": 1450,
  "CAMPUS.NS": 280, "METROBRAND.NS": 1150, "BECTOR.NS": 1500, "DEVYANI.NS": 175,
  "WESTLIFE.NS": 850, "SAPPHIRE.NS": 1350, "JUBLFOOD.NS": 620, "BIKAJI.NS": 750,
  "EMAMILTD.NS": 580, "JYOTHYLAB.NS": 520, "BAJAJCON.NS": 240, "VINATIORGA.NS": 1950,
  "NAVINFLUOR.NS": 3800, "FLUOROCHEM.NS": 3400, "DEEPAKNTR.NS": 2200,
  "CLEAN.NS": 1150, "SOLARINDS.NS": 10500, "BEL.NS": 295, "HAL.NS": 4500,
  "COCHINSHIP.NS": 1950, "GRSE.NS": 1650, "MAZDOCK.NS": 3800, "PGEL.NS": 680,
  "AMBER.NS": 6200, "DIXON.NS": 16000, "KAYNES.NS": 4800, "SYRMA.NS": 485,
  "GRAVITA.NS": 2200, "IDEAFORGE.NS": 680, "ZFCVINDIA.NS": 12500,
  "SUPRAJIT.NS": 430, "MINDACORP.NS": 280, "CRAFTSMAN.NS": 5200, "SANSERA.NS": 1050,
};

/**
 * Generate synthetic 30-day price data using Geometric Brownian Motion.
 * This is the same stochastic model used in Black-Scholes option pricing.
 *
 * @param {string} symbol - NSE stock symbol (e.g. "TCS.NS")
 * @param {number} [volatility=0.015] - Daily volatility (1.5% default)
 * @returns {{ date: string, price: number }[]}
 */
export function generateSyntheticPrices(symbol, volatility = 0.015) {
  const basePrice = BASE_PRICES[symbol] || 1000;
  const days = 30;
  const prices = [];

  // Seeded deterministic random using symbol hash so the same stock
  // always generates the same shape (reproducible simulation)
  let seed = symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  // Box-Muller transform to get Gaussian random (better than uniform rand)
  const gaussian = () => {
    const u1 = rand() || 1e-10;
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  let currentPrice = basePrice;
  const drift = 0.0003; // slight upward drift (realistic bull market bias)

  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const shock = drift + volatility * gaussian();
    currentPrice = currentPrice * Math.exp(shock);

    prices.push({
      date: d.toISOString().split("T")[0],
      price: Number(currentPrice.toFixed(2)),
      simulated: true,
    });
  }

  return prices;
}
