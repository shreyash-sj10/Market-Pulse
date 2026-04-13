# ARCHITECTURE MAPPING

## PURPOSE
Map current codebase → final architecture roles
Ensure no duplicate logic, no ambiguity

---

## 🔴 ENGINES (CORE LOGIC)

backend/src/engines/reflection.engine.js  
→ FINAL: Reflection Engine (canonical)  
→ ACTION: KEEP  

backend/src/services/intelligence/reflectionEngine.service.js  
→ FINAL: Reflection Engine  
→ ACTION: DELETE (duplicate)

backend/src/services/review.engine.js  
→ FINAL: Reflection Engine  
→ ACTION: DELETE (legacy)

---

backend/src/services/risk.engine.js  
→ FINAL: Risk Engine  
→ ACTION: REFACTOR  
→ NOTES: Remove legacy fields (price, rrRatio)

---

backend/src/services/behavior.engine.js  
→ FINAL: Behavior Engine  
→ ACTION: KEEP / VERIFY purity

---

backend/src/services/skill.engine.js  
→ FINAL: Skill Engine  
→ ACTION: KEEP

---

backend/src/domain/closedTrade.mapper.js  
→ FINAL: ClosedTrade Mapper  
→ ACTION: KEEP

---

## 🟠 CONTROLLERS

backend/src/controllers/trade.controller.js  
→ FINAL: Thin Controller  
→ ACTION: REFACTOR  
→ REMOVE: business logic, validation logic

---

backend/src/controllers/portfolio.controller.js  
→ FINAL: Data Formatter  
→ ACTION: REFACTOR  
→ ENSURE: canonical contract only

---

## 🟡 MODELS / DB

backend/src/models/trade.model.js  
→ FINAL: Trade Collection  
→ ACTION: REFACTOR  
→ REMOVE: rrRatio

---

backend/src/models/user.model.js  
→ FINAL: User ONLY  
→ ACTION: REFACTOR  
→ REMOVE: holdings map

---

NEW: holdings.collection  
→ FINAL: Holdings  
→ ACTION: CREATE

---

## 🔵 FRONTEND

frontend/src/features/trades/TradeForm.jsx  
→ FINAL: UI ONLY  
→ ACTION: REFACTOR  
→ REMOVE: RR logic, calculations

---

frontend/src/api/trade.api.js  
→ FINAL: API Client  
→ ACTION: REFACTOR  
→ ENSURE: canonical payload

---

## ⚫ GLOBAL RULE

- No duplicate engines
- No logic in UI
- No legacy fields