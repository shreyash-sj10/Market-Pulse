# TRADE CONTRACT v1 (STRICT)

## PURPOSE
Single source of truth for all trade-related data

---

## ✅ ALLOWED FIELDS

{
  pricePaise: number,
  stopLossPaise: number,
  targetPricePaise: number,
  pnlPct: number,
  quantity: number,
  side: "BUY" | "SELL"
}

---

## ❌ FORBIDDEN FIELDS

- price
- pnlPercentage
- rrRatio
- stopLoss
- targetPrice

---

## 🔴 STRICT RULES

1. No alias allowed  
2. No fallback conversion  
3. Invalid field → HARD ERROR  
4. All services must use canonical fields  
5. Frontend must send canonical payload  
6. Backend must return canonical response  

---

## ⚠️ VALIDATION RULES

- pricePaise must be integer
- stopLossPaise < pricePaise (for BUY)
- targetPricePaise > pricePaise (for BUY)
- quantity > 0

---

## 🧠 PRINCIPLE

System speaks ONE language only