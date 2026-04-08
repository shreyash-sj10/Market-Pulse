# Explainable Stock Trading Simulator — System Design

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React + Vite + TanStack Query)                     │
│  ─────────────────────────────────────────────────────────   │
│  AuthContext → Axios (JWT Interceptor) → React Query Cache   │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / REST
┌───────────────────────────▼──────────────────────────────────┐
│  Express API  (Node.js)                                       │
│  ─────────────────────────────────────────────────────────   │
│  Route → Zod Validation → Auth Middleware → Controller       │
│                        ↓                                     │
│              Service (Business Logic)                        │
│               ├─ Deterministic Risk Engine                   │
│               ├─ Decimal.js (Float Safety)                   │
│               └─ AI Explanation (post-processing only)       │
│                        ↓                                     │
│              MongoDB (Atlas / Local)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Zod Runtime Schema Validation (Phase 1)
**Problem:** Business controllers were trusting raw HTTP body data.  
**Decision:** Added `validateData(schema)` middleware on every mutation route.  
**Why Zod over Joi:** Zod is TypeScript-first, isomorphic (works frontend too), and gives structured error objects ideal for JSON API responses.  
**Trade-off:** ~0.3ms validation overhead per request — completely acceptable.

### 2. Decimal.js for All Financial Calculations
**Problem:** JavaScript's IEEE 754 floats produce drift: `0.1 + 0.2 = 0.30000000000000004`.  
**Decision:** Every multiplication and subtraction touching money uses `new Decimal(x).mul(y).toNumber()`.  
**Why this matters:** A 100-share trade at $150.33 would produce a $0.000000001 ledger error per trade with native floats. At scale, these accumulate.  
**Trade-off:** Slight overhead vs native arithmetic — non-negotiable for financial systems.

### 3. Atomic MongoDB Operations (Double-Spend Prevention)
**Problem:** Two concurrent BUY requests could both pass a `balance >= totalValue` check before either deducts.  
**Decision:** Combined the check and deduction in a single `findOneAndUpdate` with `{ balance: { $gte: totalValue } }`.  
**Why:** MongoDB document-level atomicity guarantees the read-modify-write is never split, even under concurrent load.  
**Trade-off:** Cannot span two documents in one atomic op — acceptable for single-user portfolios.

### 4. Portfolio Derived from Trade History (No Snapshot Store)
**Problem:** Maintaining a live portfolio document requires a write on every trade — two-document operations.  
**Decision:** Portfolio is computed on-read by aggregating trade history.  
**Why (YAGNI):** For ≤10K users, O(n) aggregation < 25ms. Caching is an optimization for later, not a day-one requirement.  
**Scalability path:** Add Redis snapshot cache when P99 aggregation latency exceeds 200ms.

### 5. JWT Access + Refresh Token Rotation
**Problem:** Long-lived JWTs are a security risk.  
**Decision:** Short-lived access tokens (15m) + long-lived refresh tokens (7d) stored in DB.  
**Interceptor Pattern:** Axios response interceptor catches 401, silently refreshes, and replays the original request — zero UX disruption.  
**Trade-off:** Extra round-trip on token expiry — invisible to users given the interceptor.

### 6. AI as Explanation Layer Only (Deterministic Contract)
**Problem:** LLMs are non-deterministic. Financial decisions cannot depend on them.  
**Decision:** Risk score and mistake tags are computed deterministically first. AI receives those as rigid inputs and only narrates.  
**Fail-safe:** `Promise.race([geminiCall, timeout(3000)])` — if AI is offline, generic explanation fires instantly. System remains 100% functional without the LLM.  
**Why this matters:** "AI trading system" is a liability. "AI explanation for a rule-based engine" is defensible and auditable.

### 7. React Query over Redux for Server State
**Problem:** Redux adds boilerplate for data that is owned by the server, not the client.  
**Decision:** TanStack Query manages all async server state (trades, portfolio, prices). React `useState` handles UI-only state (modals, toggles).  
**Why:** Query handles caching, background refetch, pagination, and invalidation out of the box.  
**Trade-off:** Less control over cache timing vs Redux — acceptable, since aggressive cache is desired for portfolios.

---

## Data Flow: Trade Execution Pipeline

```
POST /trades/buy
    │
    ▼
[Zod Middleware] — rejects bad payloads immediately (400)
    │
    ▼
[Auth Middleware] — verifies JWT, attaches user doc to req
    │
    ▼
[TradeController.buyTrade] — thin HTTP adapter
    │
    ▼
[TradeService.executeBuyTrade]
    ├─ 1. Atomic balance check + deduction ($gte + $inc)
    ├─ 2. Count trades in last 24h (for overtrading detection)
    ├─ 3. calculateMistakeAnalysis() — deterministic rule engine
    ├─ 4. Trade.create() — persist to MongoDB
    └─ 5. generateExplanation() — AI post-processing (non-blocking)
    │
    ▼
[Response] — { trade, balance, analysis, explanation }
```

---

## Scalability Roadmap

| Scale | Users | Action Required |
|-------|-------|----------------|
| Now | < 10K | Compound indexes, Pagination ✅ |
| Next | 10K–100K | Redis cache for portfolio aggregations |
| Future | 100K–1M | Read replicas, connection pooling, rate limiting |
| Scale | 1M+ | DB sharding by userId, message queues for trade execution |

---

## Security Posture

| Layer | Control |
|-------|---------|
| Auth | JWT (15m access) + Refresh Token (7d, DB-verified) |
| Input | Zod schema validation on all mutation routes |
| Transactions | MongoDB atomic `$gte + $inc` (no race conditions) |
| Secrets | All keys in `.env` (never committed) |
| AI | No DB write access, deterministic inputs only |
| Observability | Winston structured JSON logs, Morgan HTTP tracing |

---

## Interview-Ready Talking Points

**"How do you prevent overselling?"**  
> We derive holdings by summing BUYs and subtracting SELLs from trade history before any SELL is allowed. If `holdings < quantity`, it throws a 400 immediately. No stale cache risk.

**"How do you prevent double-spend?"**  
> Single `findOneAndUpdate` with `{ balance: { $gte: totalValue } }` as the filter. If another concurrent request deducted first, this query finds no matching document and throws before any money moves.

**"Why not TypeScript?"**  
> We enforced runtime type-safety with Zod at API boundaries (same guarantees for external data) and JSDoc annotations for IDE-level type inference internally. This gave us type safety without the migration cost of converting an already-shipped system mid-flight.

**"What if Gemini is down?"**  
> `Promise.race()` with a 3-second timeout fires a static fallback explanation. The trade is already persisted. AI failure never blocks a financial operation.

**"How would you scale to 1M users?"**  
> Shard MongoDB by userId, add Redis for portfolio snapshot caching, introduce a message queue (SQS or BullMQ) to serialize trade execution per user, and move AI explanation to a background worker to make the primary response sub-100ms.
