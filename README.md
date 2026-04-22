# Behavior-Aware Trading Intelligence Platform

![CI](https://github.com/shreyash-beyond/trading-platform/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-20.x-brightgreen)
![MongoDB](https://img.shields.io/badge/mongodb-replica%20set-green)
![Tests](https://img.shields.io/badge/tests-170%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 1. Overview

A paper trading simulation platform for the Indian equity market (NSE) that treats behavioral psychology as a first-class data input — equal in weight to price signals and risk metrics.

The platform simulates real brokerage constraints (T+1 settlement, IST market hours, NSE holiday calendar, intraday square-off at 15:20) without connecting to any live broker. Every trade decision passes through a deterministic multi-engine stack before execution is authorized. No AI system has decision authority. All BUY/AVOID verdicts are produced by auditable rule-based engines; AI is used solely for post-decision synthesis in plain English.

### Frontend Navigation Note

- The app now uses a single canonical trader profile route: `/profile`.
- The separate `Evolution` navigation entry and `/evolution-profile` route were removed to avoid duplicate pages showing the same content.
- Any profile-related UI references should point to `Profile`.

**Supported trade types:**
- Delivery (multi-day hold, no overnight intraday risk)
- Intraday buy-only (must exit same day; auto-squared off at 15:20 IST)

**Not supported (by design):** margin, short selling, F&O, leverage, real broker integration.

---

## 2. Problem Statement

Standard trading platforms are execution engines. They record what happened (price, quantity, time) but are entirely blind to *why* a decision was made. A revenge trade after a loss and a disciplined entry after thorough analysis produce identical records.

This creates a reinforcement problem for beginners: the platform cannot distinguish a lucky profit from a disciplined one, so it cannot teach the user anything meaningful about their process. Behavioral mistakes are invisible until they accumulate into significant capital loss.

**Specific gaps this platform addresses:**

| Gap | Standard Platform | This Platform |
|---|---|---|
| Why was the trade taken? | Not recorded | `userThinking` + behavioral flags at entry |
| Was the exit process-driven or fear-driven? | Not classified | Exit engine classifies PANIC / PLANNED / SL_HIT / TARGET_HIT |
| Did the user make a lucky profit on a bad process? | Treated as success | Tagged LUCKY_WIN — prevents reinforcement of bad behavior |
| Is the user revenge trading? | Not detected | Exponential cooldown window enforced pre-execution |
| Did the user hold a loser beyond their stop? | No tracking | Reflection engine: FAILED_STOPLOSS / HOLDING_LOSERS |

---

## 3. Solution Approach

The system is built on two structural commitments:

**Commitment 1 — Pre-decision capture.** Before any execution is authorized, the system collects the user's entry reasoning, computes a behavioral profile from prior trade history, checks market context via news sentiment, and scores the decision across three axes: setup quality, market alignment, and behavioral discipline. This snapshot is immutably stored on the trade document.

**Commitment 2 — Process/outcome separation.** Profit and loss are necessary outputs but insufficient for learning. The reflection engine maps the realized exit against the original plan to produce a process verdict independent of the financial result. A trade that hit its stop loss with a clean plan is `DISCIPLINED_LOSS`. A trade that made money by holding past the target without a plan update is `LUCKY_WIN`. Users see both verdicts explicitly.

---

## 4. Core Principles

### Deterministic Decision Making
Every verdict (BUY, CAUTION, AVOID) is produced by `entry.engine.js` using explicit weighted scoring with auditable thresholds. No stochastic output, no AI inference in the decision path. The same input always produces the same output. The engine is unit-tested with this invariant explicitly asserted.

### Constraint-First Design
The system is designed around what it refuses, not what it allows. Behavioral veto floor: if `behaviorScore < 20`, the entry engine returns BLOCK regardless of setup or market score. RR gate: if risk-reward < 1.2, the execute button is disabled client-side and the pre-trade endpoint rejects the plan server-side. Stale price guard: if market data is marked STALE at execution time, the trade is rejected. These constraints are not configurable by users.

### Human-in-the-Loop
No automated action modifies user capital without an explicit pre-trade token. System-triggered sells (stop loss, target, squareoff) issue their own tokens via `issueDecisionToken()` with `verdict: "SELL"` — they go through the same execution pipeline as user-initiated trades. There is no privileged bypass path.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React + React Query)                 │
│  Trade Terminal │ Portfolio Dashboard │ Journal │ Analytics           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTPS / WebSocket
┌──────────────────────────────▼──────────────────────────────────────┐
│                      EXPRESS API LAYER                               │
│  auth.route  │  trade.route  │  intelligence.route  │  market.route  │
│  Middleware: requestTrace → requestMetrics → helmet → cors → zod    │
└──────┬────────────────────────────┬────────────────────────┬────────┘
       │                            │                        │
┌──────▼──────┐          ┌──────────▼──────────┐   ┌────────▼────────┐
│  AUTH CORE  │          │   INTELLIGENCE LAYER │   │  MARKET DATA    │
│  JWT + CSRF │          │  entry.engine        │   │  price.engine   │
│  Redis cache│          │  behavior.engine     │   │  Yahoo Finance  │
│  bcrypt hash│          │  risk.engine         │   │  Redis cache    │
└─────────────┘          │  preTradeGuard       │   │  memory cache   │
                         │  news.engine (AI)    │   └─────────────────┘
                         └──────────┬──────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                       TRADE EXECUTION CORE                             │
│                                                                        │
│  trade.service.js                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  1. Idempotency check (ExecutionLock upsert — unique index)      │ │
│  │  2. preTradeToken claim (Mongo txn, VALID → IN_USE)              │ │
│  │  3. Payload hash verify (HMAC-SHA256 match)                      │ │
│  │  4. Price fetch + slippage guard (|drift| ≤ 0.5%)               │ │
│  │  5. runInTransaction (8-retry, write-conflict aware)             │ │
│  │     ├─ User.balance debit / reservedBalancePaise deduct          │ │
│  │     ├─ Holding upsert (weighted avg cost, aggregation pipeline)  │ │
│  │     ├─ Trade document create (full snapshot)                     │ │
│  │     ├─ Outbox event create (TRADE_CLOSED — same session)         │ │
│  │     └─ validateSystemInvariants (balance ≥ 0 check)             │ │
│  │  6. ExecutionLock → COMPLETED (responseData stored for replay)   │ │
│  │  7. preTradeToken → CONSUMED                                     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                     BACKGROUND WORKER LAYER                            │
│                                                                        │
│  outbox.worker  ──────► reflection.engine ──► analytics.service       │
│  stopLossMonitor (30s) ──► executeSellTrade (same execution pipeline) │
│  squareoff.schedule    ──► executeAutoSquareoff (p-limit concurrency)  │
│  marketCalendar.worker ──► MarketCalendar model ──► isMarketOpen()    │
│  execution.executor    ──► pending INTRADAY order sweep               │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                          PERSISTENCE LAYER                             │
│                                                                        │
│  MongoDB Atlas (replica set)                                           │
│  ├── users          ├── trades         ├── holdings                   │
│  ├── executionlocks ├── pretrade_tokens ├── outboxes                  │
│  ├── traces         ├── market_calendars └── systemexecutionstates    │
│                                                                        │
│  Redis (optional — degrades gracefully)                                │
│  ├── price:SYMBOL (30s TTL)   ├── pretrade:<token>                   │
│  ├── auth:uc:<userId> (30s)   └── rl:trade:<userId> (rate limit)     │
└───────────────────────────────────────────────────────────────────────┘
```

**Tech stack:**

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + React Query | Atomic per-engine cached state |
| Backend | Node.js 20 + Express | Modular service-oriented |
| Database | MongoDB + Mongoose | Replica set required for transactions |
| Cache / Queue | Redis + Bull | Optional; system degrades without it |
| Market Data | yahoo-finance2 | PQueue throttled: 1 req / 12s |
| AI Synthesis | Anthropic Claude | Post-decision explanation only |
| Deployment | Railway (single instance) | See §12 on worker scaling constraints |
| CI | GitHub Actions | backend tests + frontend build on every push |
| Logging | Pino (structured JSON) | traceId + userId on every log line |
| Validation | Zod | Two separate schemas: pre-trade vs execution |

---

## 6. End-to-End System Flow

### 6.1 Authentication Flow

```
Client                         Server
  │                               │
  ├─ POST /api/auth/register ────►│ bcrypt hash password (salt rounds: 10)
  │                               │ Create User (balance: ₹1,00,000 in paise)
  │                               │
  ├─ POST /api/auth/login ───────►│ Compare bcrypt hash
  │                               │ generateTokens(userId)
  │                               │   access:  JWT { userId, tokenType:"access" }  TTL: 15m
  │                               │   refresh: JWT { userId, tokenType:"refresh", nonce: UUID } TTL: 7d
  │                               │ hashToken(refreshToken) → SHA-256 → stored in User.refreshToken
  │                               │ Set-Cookie: refreshToken (HttpOnly, Secure, SameSite=Strict, path=/api/auth)
  │                               │ Set-Cookie: csrfToken   (readable JS, same path — for CSRF header)
  │◄─ { accessToken } ───────────│
  │
  │  Client stores accessToken in React memory only (no localStorage, no sessionStorage)
  │
  ├─ GET /api/users/me ──────────►│ protect middleware:
  │  Authorization: Bearer <tok>  │   JWT verify → tokenType === "access" guard
  │                               │   Redis cache hit (30s TTL, identity fields only — no balance)
  │                               │   Cache miss → User.findById().lean() → warm cache
  │◄─ { id, email, name } ───────│
  │
  ├─ POST /api/auth/refresh ─────►│ Read refreshToken cookie
  │  X-CSRF-Token: <csrfToken>   │ Verify CSRF header (SKIP_CSRF_DEV=false enforces this)
  │                               │ Hash incoming cookie → compare to User.refreshToken (SHA-256)
  │                               │ Verify JWT signature + tokenType === "refresh"
  │                               │ Issue new access token
  │◄─ { accessToken } ───────────│
```

**Key security decisions:**
- Refresh token is stored as SHA-256 hash only — raw token never persists to DB
- Access token lives in JS memory; XSS cannot exfiltrate it from `localStorage`
- CSRF token is a separate readable cookie; double-submit pattern prevents cross-site refresh abuse
- Redis user cache excludes `balance` — financial operations always re-read from DB inside transactions

---

### 6.2 Market Data Pipeline

```
Consumer (trade.service / stopLossMonitor / squareoff)
    │
    ▼
getPrice(symbol)                  [price.engine.js]
    │
    ├──[1] Redis LIVE tier ─────► key: "price:SYMBOL"  TTL: 30s
    │       hit? → { pricePaise, source: "REDIS" }
    │
    ├──[2] Memory cache ─────────► Map<symbol, { pricePaise, ts }>  TTL: 30s
    │       fresh? → { pricePaise, source: "MEMORY" }
    │
    ├──[3] Yahoo Finance API ────► yahoo-finance2.quote(symbol)
    │       PQueue: concurrency=1, intervalCap=1, interval=12s
    │       Validates: currency=INR, regularMarketPrice != null, pricePaise > 100
    │       On success: write to memory cache, write to Redis
    │       → { pricePaise, source: "LIVE" }
    │
    └──[4] Stale memory ─────────► if memory entry exists but expired
            → { pricePaise, source: "STALE" }
            Note: STALE source BLOCKS trade execution (STALE_PRICE_EXECUTION_BLOCKED)
            Only LIVE / REDIS / MEMORY sources allow execution.
            If all fail → throw AppError("MARKET_DATA_UNAVAILABLE", 503)

Price source tags surfaced to UI and stored on Trade document:
  REAL   (mapped from LIVE)
  CACHE  (mapped from REDIS | MEMORY)
  STALE  (tagged on UI, blocks execution)
  FALLBACK
```

**Rate limit reality:** Yahoo Finance's unofficial API is throttled to 1 request per 12 seconds via p-queue. Under load, consumers fall back to the Redis / memory cache. This is a known constraint documented in §18.

---

### 6.3 Trade Entry Flow (Pre-Execution Decision)

```
User fills Trade Terminal
    │
    ├─ Selects symbol + tradeType (DELIVERY | INTRADAY)
    ├─ Inputs: entryPricePaise, stopLossPaise, targetPricePaise, quantity
    ├─ Inputs: userThinking (qualitative reasoning), conviction (1–5)
    │
    ▼
Client-side gates (frontend only — not security guarantees):
    ├─ RR computed: rr = (target - entry) / (entry - stopLoss)
    └─ If rr < 1.2 → execute button disabled with explanation

    ▼
POST /api/intelligence/pre-trade       [validatePreTradePayload → preTradeGuard.service]
    │
    ├─ LAYER 1: Market Intelligence
    │   newsEngine.getProcessedNews(symbol, holdings)
    │   → { signals[], consensusVerdict: "BUY"|"AVOID"|"NEUTRAL", status: VALID|UNAVAILABLE }
    │
    ├─ LAYER 2: Behavioral Analysis
    │   getBehavioralFlags(user, symbol)
    │   → checks last 10 trades for same-symbol SELL with pnlPaise < 0 within revengeWindowMs
    │   → flags: ["REVENGE_TRADING_RISK"] | []
    │   + analyzeBehavior(closedTrades) → discipline profile (requires ≥ 3 closed trades)
    │
    ├─ LAYER 3: Risk Validation
    │   validatePlan({ pricePaise, stopLossPaise, targetPricePaise })
    │   → rr computed server-side; client rr never trusted
    │   → if rr < 1.2 → BLOCK (INVALID_PLAN)
    │
    ├─ LAYER 4: Entry Engine Score [entry.engine.js]
    │   setupScore  = f(rr, plan quality)
    │   marketScore = f(consensusVerdict, adaptedRiskLevel)
    │   behaviorScore = f(disciplineScore, flags)
    │
    │   Weights (DELIVERY):  setup×0.4 + market×0.3 + behavior×0.3
    │   Weights (INTRADAY):  setup×0.4 + market×0.2 + behavior×0.4
    │
    │   Behavioral veto: if behaviorScore < 20 → BLOCK (BEHAVIORAL_VETO)
    │   regardless of composite score.
    │
    │   Composite thresholds:
    │     < 50  → BLOCK (AVOID)
    │     50–70 → CAUTION (WAIT)
    │     ≥ 70  → ALLOW (BUY)
    │
    ├─ LAYER 5: AI Synthesis (non-blocking, best-effort)
    │   explainDecision(snapshot) → plain-English reasoning
    │   If Claude unavailable → status: UNAVAILABLE (never fake output)
    │
    ├─ Issue preTradeToken if verdict ≠ BLOCK:
    │   token = crypto.randomUUID()
    │   payloadHash = HMAC-SHA256(JWT_SECRET, canonicalJSON({ symbol, productType,
    │                              pricePaise, quantity, stopLossPaise, targetPricePaise }))
    │   Persisted to PreTradeToken collection + Redis (TTL: 2 min)
    │   State: VALID
    │
    └─► Response: { verdict, scores, reasons, token, aiExplanation }
```

---

### 6.4 Pre-Trade Validation & Token System

The preTradeToken is a signed payload commitment. Its purpose is to guarantee that the payload evaluated by the decision engine is identical to the payload submitted for execution.

```
Token lifecycle:
  VALID ──[execution starts]──► IN_USE ──[txn commits]──► CONSUMED
                                         └[txn fails]──► VALID (retry possible)
                                         └[TTL expires]── document remains, expiresAt gate rejects

Token structure (persisted to MongoDB + Redis):
  {
    token:       UUID (random — not a JWT)
    userId:      ObjectId
    payloadHash: HMAC-SHA256(JWT_SECRET, canonicalJSON(tradeFields))
    verdict:     "BUY" | "SELL"
    expiresAt:   Date (2 min TTL)
    state:       "VALID" | "IN_USE" | "CONSUMED"
  }

At execution (placeOrderCoreInSession):
  currentHash = HMAC-SHA256(JWT_SECRET, canonicalJSON(submittedPayload))
  if currentHash !== record.payloadHash → PAYLOAD_MISMATCH (400)

This prevents:
  • Replaying an old token with a different price
  • Submitting a CAUTION-scored payload to a BUY-only token
  • Concurrent execution of the same token (IN_USE state claim inside Mongo txn)
```

---

### 6.5 Trade Execution (Atomic Flow)

```
POST /api/trades/buy   (or /sell)
    │
    Middleware chain:
    protect → tradeLimiter (10/window per userId) → enforceRequestId → validateTradePayload
    → header token injection → enforceBuyReview → checkMarketClock → buyTrade controller
    │
    ▼
trade.service.runAtomicTradeExecution(userDoc, payload, "BUY")
    │
    ├─[1] Build execution request hash (HMAC of canonical payload + "BUY" prefix)
    │
    ├─[2] tryReplayCompletedIdempotency(idempotencyKey, requestHash)
    │      Checks ExecutionLock for status=COMPLETED + matching payloadHash
    │      If found → return stored responseData immediately (no DB write)
    │
    ├─[3] getPrice(symbol)
    │      If source === STALE → reject (STALE_PRICE_EXECUTION_BLOCKED)
    │
    ├─[4] runInTransaction (retries: 8, catches: TransientTransactionError + write conflicts)
    │      │
    │      ├─ ExecutionLock.updateOne({ $setOnInsert: ... }, { upsert: true })
    │      │    Unique index on (userId, requestId) — concurrent duplicate → 11000 → 409
    │      │
    │      ├─ cleanupStaleReservations (finds PENDING_EXECUTION trades > 5 min old, releases reserves)
    │      │
    │      ├─ claimPreTradeTokenInSession (VALID → IN_USE, checks expiresAt, verifies userId)
    │      │
    │      ├─ placeOrderCoreInSession
    │      │   ├─ Verify payloadHash (PAYLOAD_MISMATCH guard)
    │      │   ├─ Verify verdict ≠ WAIT / AVOID
    │      │   ├─ Price drift check: |clientPrice - livePrice| / livePrice ≤ 0.5%
    │      │   ├─ Balance check: user.balance - reservedBalancePaise ≥ totalValuePaise
    │      │   ├─ Reserve balance: user.reservedBalancePaise += totalValuePaise
    │      │   └─ Trade.create([tradeObj], { session }) → status: PENDING_EXECUTION
    │      │
    │      ├─ executeOrderCoreInSession (if market open)
    │      │   ├─ Trade: PENDING_EXECUTION → PROCESSING (findOneAndUpdate — race guard)
    │      │   ├─ BUY path:
    │      │   │   user.balance -= totalValuePaise
    │      │   │   user.reservedBalancePaise -= totalValuePaise
    │      │   │   Holding.findOneAndUpdate ($inc qty, weighted avg pipeline, upsert)
    │      │   ├─ SELL path:
    │      │   │   Holding quantity check (current session read)
    │      │   │   pnlPaise = totalValuePaise - (qty × avgHoldingPricePaise)
    │      │   │   user.balance += totalValuePaise
    │      │   │   Outbox.create([{ type:"TRADE_CLOSED", payload }], { session })
    │      │   ├─ Trade.status → EXECUTED (BUY) | EXECUTED_PENDING_REFLECTION (SELL)
    │      │   ├─ validateSystemInvariants(user, holdings) — balance ≥ 0 guard
    │      │   └─ user.save({ session })
    │      │
    │      ├─ ExecutionLock.status → COMPLETED, responseData stored
    │      ├─ PreTradeToken.state → CONSUMED
    │      └─ user.systemStateVersion++ (optimistic UI invalidation signal)
    │
    └─[5] Redis: delete pretrade:<token> key
```

**If market is closed** (INTRADAY order placed outside hours): trade stays `PENDING_EXECUTION`, balance is reserved, response returns `status: PENDING_EXECUTION, queuedForMarketOpen: true`. The sweeper/execution executor picks it up at next market open.

---

### 6.6 Idempotency & Concurrency Handling

```
Scenario: client sends same idempotencyKey twice (network retry, double-click)

Request A                    MongoDB                     Request B
    │                           │                            │
    ├── upsert ExecutionLock ──►│                            │
    │   (upsertedCount=1)       │◄── upsert ExecutionLock ──┤
    │                           │    code 11000 duplicate    │
    │                           │    key error ─────────────►│
    │                           │                            ├── findOne ExecutionLock
    │                           │                            │   status=IN_PROGRESS
    │                           │                            │◄── 409 EXECUTION_IN_PROGRESS
    │   [executes trade]        │
    │   lock → COMPLETED        │
    │   responseData stored     │
    │                           │
Request C (retry after success):
    │                           │
    ├── tryReplayCompletedIdempotency ──►│
    │   lock.status=COMPLETED           │
    │   payloadHash match verified      │
    │◄── same responseData (no write) ──│
    │   (currentBalance refreshed from DB)
```

Three distinct idempotency states are handled:
1. **IN_PROGRESS** — another request is mid-transaction → 409
2. **COMPLETED** — replay the stored response envelope, refresh currentBalance from live DB read
3. **PAYLOAD_MISMATCH** — same key, different payload → 400 (prevents key reuse with altered trade)

---

### 6.7 Stop Loss & Target Automation

```
stopLossMonitor (setInterval: 30s)
    │
    ├─ isMarketOpen() → false → skip cycle
    ├─ isSquareoffWindowEligible() → true → skip (squareoff handles this window)
    │
    ├─ Holding.find({ quantity: { $gt: 0 } })   [scans all holdings]
    │
    └─ for each user → for each holding:
         │
         ├─ marketService.getLivePrices(symbols)  [batch per user]
         │
         ├─ Trade.find({ user, symbol, type:"BUY", status:{$in:["EXECUTED","EXECUTED_PENDING_REFLECTION"]} })
         │   → aggregate: stopLossPaise = MIN of all open SLs (most conservative)
         │                targetPricePaise = MIN of all targets (first achieved level)
         │
         ├─ Trade.find({ type:"SELL", status:{$in:["PENDING_EXECUTION","PROCESSING"]} })
         │   → pendingSellQuantity: avoid triggering on already-selling quantity
         │
         ├─ Trigger conditions:
         │   SL:     currentQuotePaise <= stopLossPaise
         │   Target: currentQuotePaise >= targetPricePaise
         │
         └─ On trigger:
              acquirePreLock(slCooldownKey, ttl=30s)   [Redis NX — debounce per symbol]
              acquirePreLock(lockKey)                   [Redis NX — idempotency per requestId]
              issueDecisionToken({ symbol, productType: holding.tradeType, verdict:"SELL" })
              executeSellTrade(user, { symbol, productType: holding.tradeType, ... })
```

**Gap-down risk:** The monitor polls every 30 seconds. If a stock opens 20% below the configured stop loss (gap down), the system sells at the next poll price — not the configured stop price. This is documented in §18.

---

### 6.8 Auto Square-Off System

```
squareoff.schedule (setInterval: SQUAREOFF_POLL_MS, default 60s)
    │
    ├─ isSquareoffWindowEligible()
    │   ├─ Calendar veto: today is a holiday → false
    │   ├─ Weekend check → false
    │   └─ IST clock >= SQUAREOFF_TIME_IST (default 15:20) → true
    │
    ├─ claimExecution("SQ:YYYY-MM-DD")        [SystemExecutionState — Mongo unique key]
    │   → only ONE process/instance completes squareoff per calendar day
    │
    └─ executeAutoSquareoff()
         │
         ├─ Trade.find({ type:"BUY", productType:"INTRADAY", status:"EXECUTED" })
         │
         ├─ Group by userId:symbol → aggregate quantities
         │
         ├─ marketService.getLivePrices(allSymbols)   [single batch snapshot — Phase 8]
         │   Price captured ONCE for all symbols — prevents price drift between positions
         │
         ├─ p-limit(SQUAREOFF_CONCURRENCY=10)         [parallel with backpressure]
         │
         └─ for each position group:
              Holding.findOne({ userId, symbol, tradeType:"INTRADAY" }) → actual quantity
              acquirePreLock(lockKey)
              issueDecisionToken({ symbol, productType:"INTRADAY", verdict:"SELL" })
              executeSellTrade(user, { productType:"INTRADAY", reason:"AUTO_SQUAREOFF_PROTOCOL" })
              → exitType on the resulting trade: AUTO_SQUAREDOFF
              → reflection: HELD_THROUGH_SQUAREOFF tag
```

---

### 6.9 Reflection Engine

Runs after every `TRADE_CLOSED` outbox event is processed. Maps what happened against what was planned.

```
TRADE_CLOSED outbox event
    │
    outbox.worker → reflection job
    │
    analyzeReflection(closedTrade)
    │
    evaluateExit({
      entryPlan: { entryPricePaise, stopLossPaise, targetPricePaise },
      exitPricePaise,
      entryTime, exitTime
    })
    │
    Exit classification:
    ┌─────────────────────────────────────────────────────────────────────┐
    │  STOP_LOSS_HIT  exit <= stopLoss                → deviationScore=100│
    │  PANIC          holdTime < 10min AND not SL_HIT → score=f(risk%)   │
    │  TARGET_HIT     exit >= target                  → deviationScore=100│
    │  EARLY_EXIT     exited before target/stop reached                   │
    │  LATE_EXIT      held beyond target OR below stop loss               │
    │  NORMAL         default (manual exit within plan bounds)            │
    └─────────────────────────────────────────────────────────────────────┘
    │
    Reflection verdict:
    ┌─────────────────────────────────────────────────────────────────────┐
    │  DISCIPLINED_PROFIT   TARGET_HIT with plan intact                   │
    │  DISCIPLINED_LOSS     STOPPED_OUT — plan followed, capital protected│
    │  POOR_PROCESS         PANIC_EXIT, EARLY_PROFIT_TAKE, HOLDING_LOSERS │
    │  LUCKY_PROFIT         OVERHOLD beyond target (greed, no plan update)│
    │  DISCIPLINED_LOSS     EARLY_CUT — left loss early (proactive)       │
    └─────────────────────────────────────────────────────────────────────┘
    │
    Result stored on Trade.learningOutcome:
    { verdict, executionPattern, deviationScore, insight, improvement, tags[] }
```

**The key insight:** `LUCKY_PROFIT` is not success. A user who held past their target without updating their plan is taught this explicitly — the system does not reinforce accidental profits.

---

### 6.10 Analytics & Behavioral Engine

```
persistUserAnalyticsSnapshot (triggered by TRADE_CLOSED outbox)
    │
    computeUserAnalytics(userId)
    │
    ├─ Trade history (last 100) → normalizeTrade → mapToClosedTrades
    │
    ├─ analyzeBehavior(closedTrades)
    │   Pattern detection (requires ≥ 3 closed trades):
    │   ┌──────────────────────────────────────────────────────────────────┐
    │   │ REVENGE_TRADING   same-symbol re-entry within exponential window │
    │   │                   after loss: base×2^min(consecutiveLosses,2)    │
    │   │                   base=60min → 1 loss:60m, 2:120m, 3+:240m      │
    │   │ OVERTRADING       avg trades/day > limit OR daily burst > cap    │
    │   │ EARLY_EXIT_PATTERN % of closed trades tagged EARLY_EXIT          │
    │   │ HOLDING_LOSERS    avgLossHoldTime > avgWinHoldTime × 1.5        │
    │   │ LOSS_CHASING      re-entry same symbol within 4h of losing exit  │
    │   │ FOMO_ENTRY        intraday entries within 25min of squareoff      │
    │   │ PANIC_EXIT        holdTime < 10min                               │
    │   │ CHASING_PRICE     entry > terminalOpenPrice × 1.02 (2% drift)   │
    │   └──────────────────────────────────────────────────────────────────┘
    │   disciplineScore = 100 - Σ(pattern.confidence / 2)
    │
    ├─ calculateSkillScore(closed, reflections, behavior, progression)
    │   → weighted composite across: win rate, process quality, RR adherence
    │
    ├─ analyzeProgression(closed) → trend: IMPROVING | DECLINING | STABLE
    │
    └─ User.analyticsSnapshot updated:
       { skillScore, disciplineScore, trend, tags[], lastUpdated }
```

---

## 7. Data Model & Contracts

### 7.1 Trade Model

```javascript
{
  _id:              ObjectId,
  user:             ObjectId (ref: User),
  symbol:           String (uppercase, trimmed),
  type:             "BUY" | "SELL",
  productType:      "DELIVERY" | "INTRADAY",
  status:           "PENDING_EXECUTION" | "PROCESSING" | "EXECUTED" |
                    "EXECUTED_PENDING_REFLECTION" | "FAILED" | "COMPLETE",
  reflectionStatus: "PENDING" | "DONE" | "FAILED" | null,

  // Pricing (ALL in paise — integer only, never float)
  quantity:         Int (≥ 1),
  pricePaise:       Int,
  totalValuePaise:  Int,
  stopLossPaise:    Int | null,
  targetPricePaise: Int | null,
  pnlPaise:         Int | null,         // null until SELL executes
  pnlPct:           Float | null,
  rr:               Float | null,
  priceSource:      "REAL" | "CACHE" | "STALE" | "FALLBACK",

  // Immutable entry snapshot (captured at pre-trade evaluation time)
  entryPlan: {
    entryPricePaise, stopLossPaise, targetPricePaise, rr, intent, reasoning
  },

  // Full engine state at decision time (BUY only)
  decisionSnapshot: {
    verdict, score, behaviorFlags, marketContext, setupScore, marketScore,
    behaviorScore, weightedEntry, riskAnalysis
  },

  // Post-execution reflection (written async by reflection engine)
  learningOutcome: {
    verdict:          "DISCIPLINED_PROFIT" | "DISCIPLINED_LOSS" | "POOR_PROCESS" |
                      "LUCKY_PROFIT" | "NEUTRAL",
    executionPattern: "TARGET_HIT" | "STOPPED_OUT" | "PANIC_EXIT" |
                      "EARLY_EXIT" | "OVERHOLD" | "HOLDING_LOSERS" | ...,
    deviationScore:   0–100,
    insight:          String,
    improvement:      String
  },

  behaviorTags:     String[],
  idempotencyKey:   String,             // client UUID
  executionRequestHash: String,         // HMAC of execution body
  postExecutionBalancePaise: Int | null,
  queuedAt:         Date | null,
  executionTime:    Date | null,
  createdAt:        Date,

  // Audit trail
  trace: {
    timeline: [{ stage: String, metadata: Object, ts: Date }]
  }
}
```

**Indexes on Trade:**
- `{ user: 1, createdAt: -1 }` — history queries
- `{ user: 1, symbol: 1, type: 1, status: 1 }` — position lookups
- `{ idempotencyKey: 1 }` — idempotency replay

### 7.2 Holding Model

```javascript
{
  _id:           ObjectId,
  userId:        ObjectId (ref: User),
  symbol:        String (uppercase),
  tradeType:     "DELIVERY" | "INTRADAY",
  quantity:      Int (≥ 0),
  avgPricePaise: Int (weighted average, computed via MongoDB aggregation pipeline),
  updatedAt:     Date
}
// Unique compound index: (userId, symbol, tradeType)
// avgPricePaise update formula (inside Mongo aggregation pipeline):
//   newAvg = round((oldQty × oldAvg + buyQty × buyPrice) / (oldQty + buyQty))
```

### 7.3 Execution Lock

```javascript
{
  _id:                ObjectId,
  requestId:          String,           // = client idempotencyKey
  userId:             ObjectId,
  idempotencyKey:     String (sparse),
  status:             "IN_PROGRESS" | "COMPLETED" | "PENDING",
  requestPayloadHash: String | null,    // HMAC of execution body — mismatch → 400
  pendingTradeId:     ObjectId | null,
  responseData:       Mixed | null,     // stored for replay
  createdAt:          Date
}
// Unique: idempotencyKey (sparse)
// Unique: (userId, requestId)
// TTL: createdAt → expireAfterSeconds (default: 604800 = 7 days)
```

### 7.4 PreTradeToken

```javascript
{
  _id:         ObjectId,
  token:       String (UUID, unique),
  userId:      ObjectId,
  payloadHash: String (HMAC-SHA256),
  verdict:     "BUY" | "SELL" | "WAIT" | "AVOID",
  expiresAt:   Date (2 min from creation),
  state:       "VALID" | "IN_USE" | "CONSUMED"
}
// TTL index: expiresAt (MongoDB auto-expiry)
// Also cached in Redis: pretrade:<token> with EX 120
```

### 7.5 SystemExecutionState

```javascript
{
  key:              String (unique),    // e.g. "SQ:2025-01-15"
  status:           "RUNNING" | "COMPLETED" | "FAILED",
  startedAt:        Date,
  executedAt:       Date | null,
  failedAt:         Date | null,
  lastErrorMessage: String | null (max 500 chars)
}
// Used by squareoff to guarantee once-per-day execution.
// claimExecution: findOneAndUpdate with status=RUNNING, unique key → only one succeeds.
```

### 7.6 MarketCalendar

```javascript
{
  date:      String ("YYYY-MM-DD" IST),
  exchange:  String ("XNSE" | "XBOM"),
  isOpen:    Boolean,
  openTime:  String ("HH:MM"),    // e.g. "09:15"
  closeTime: String ("HH:MM"),    // e.g. "15:30"
  holiday:   String | null        // holiday name if applicable
}
// isMarketOpen() reads from in-memory cache (refreshed every 60s from this collection).
// No cache entry for today → isMarketOpen() returns false (fail-safe).
```

---

## 8. Decision Engine Design

### 8.1 Risk Engine

Located in `src/services/risk.engine.js`. Validates that a trade plan is mathematically sound before any scoring begins.

```
validatePlan({ side, pricePaise, stopLossPaise, targetPricePaise })
    │
    ├─ Side-specific direction checks:
    │   BUY:  stopLoss < price < target  (must be below entry and target above)
    │   SELL: validates exit consistency
    │
    ├─ rr = (target - price) / (price - stopLoss)
    │
    ├─ if rr < MIN_RR (default 1.2) → { isValid: false, errorCode: "INSUFFICIENT_RR" }
    │
    └─ { isValid: true, rr }

getRiskScore({ side, pricePaise, stopLossPaise, targetPricePaise })
    → normalized penalty score (0–100) based on how close rr is to minimum
    → used as setupScore input to entry engine: setupScore = 100 - riskScore
```

### 8.2 Behavior Engine

Located in `src/services/behavior.engine.js`. Pure function — takes an array of closed trade objects, returns a behavioral profile. No DB access. Fully deterministic.

```
analyzeBehavior(closedTrades[])
    │
    Requires: closedTrades.length >= minClosedTradesForProfile (default: 3)
    If below threshold → { success: false, reason: "INSUFFICIENT_BEHAVIOR_HISTORY" }
    │
    Input shape (per trade):
    { symbol, pnlPaise, pnlPct, entryTime, exitTime, holdTime,
      entryPricePaise, exitPricePaise, terminalOpenPricePaise, behaviorTags[] }
    │
    Pattern detection (all from closed trade history):
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ Pattern          │ Detection Logic                                      │
    │──────────────────────────────────────────────────────────────────────── │
    │ REVENGE_TRADING  │ prev.pnlPaise<0 AND prev.symbol===curr.symbol        │
    │                  │ AND curr.entryTime-prev.exitTime < exponentialWindow  │
    │ OVERTRADING      │ avg trades/day > overtradingPerDayLimit (default 5)  │
    │ OVERTRADING_DAILY│ any single IST day > overtradingDailyCap (default 7) │
    │ EARLY_EXIT       │ trade.behaviorTags includes EARLY_EXIT               │
    │ HOLDING_LOSERS   │ avgLossHoldTime > avgWinHoldTime × 1.5x              │
    │ LOSS_CHASING     │ re-entry same symbol within 4h of losing exit        │
    │ FOMO_ENTRY       │ entryMinutes ∈ [squareoff-25min, squareoff)          │
    │ PANIC_EXIT       │ exitTime - entryTime < 10min                         │
    │ CHASING_PRICE    │ entryPricePaise >= terminalOpen × 1.02               │
    └─────────────────────────────────────────────────────────────────────────┘
    │
    disciplineScore = 100 - Σ(pattern.confidence / 2)   [clamped 0–100]
    winRate = wins / total × 100
    dominantMistake = pattern with highest confidence
    │
    → { success, patterns[], disciplineScore, winRate, avgPnlPct, dominantMistake }
```

### 8.3 Entry Engine

Located in `src/engines/entry.engine.js`. The single authority on BUY/CAUTION/AVOID verdicts.

```
evaluateEntryDecision({
  plan:            { side, pricePaise, stopLossPaise, targetPricePaise, productType },
  marketContext:   { consensusVerdict, adaptedRiskLevel, status },
  behaviorContext: { flags[], closedTrades[], status },
  scores:          { setup, market, behavior } | undefined,  // explicit override for tests
  entryTime:       Date | undefined                          // for FOMO window check
})
    │
    Guard rails (evaluated before scoring):
    ├─ hasBehaviorData === false → BLOCK (INSUFFICIENT_DATA)
    ├─ planValidation.isValid === false → BLOCK (plan error code)
    │
    Score computation (when scores not explicitly provided):
    ├─ setupScore  = 100 - getRiskScore(plan)
    ├─ marketScore = aligned:95 | noData:80 | consensusAVOID:30 | HIGH_RISK:-10
    ├─ behaviorScore:
    │   base = disciplineProfile.disciplineScore || 70 (new user default)
    │   REVENGE_TRADING_RISK flag → cap at 35
    │   OVERTRADING_RISK flag    → cap at 40
    │   FOMO_ENTRY flag          → subtract 25
    │   PANIC_EXIT flag          → subtract 20
    │   CHASING_PRICE flag       → subtract 15 (also subtracts 20 from marketScore)
    │   INTRADAY FOMO window     → subtract 25 (real-time check)
    │   REVENGE + AVOID combo    → cap at 15 (double-veto)
    │
    Behavioral veto: behaviorScore < 20 → BLOCK (BEHAVIORAL_VETO) — stops here
    │
    Weighted composite:
    DELIVERY:  0.4×setup + 0.3×market + 0.3×behavior
    INTRADAY:  0.4×setup + 0.2×market + 0.4×behavior
    │
    Verdict boundaries:
    composite < 50  → BLOCK  (maps to "AVOID" in UI)
    composite 50–70 → CAUTION (maps to "WAIT" in UI)
    composite ≥ 70  → ALLOW  (maps to "BUY" in UI)
    │
    Additional: REVENGE flag + consensusAVOID → force BLOCK regardless of composite
    │
    → { verdict, reasons[], riskScore, behaviorFlags, weightedEntry, rr, status }
```

### 8.4 Exit Engine

Located in `src/engines/exit.engine.js`. Classifies how a closed trade deviated from its original plan.

```
evaluateExit({ entryPlan, exitPricePaise, entryTime, exitTime })
    │
    Classification order (priority matters):
    1. STOP_LOSS_HIT   exit <= stopLoss → deviationScore = 100 (followed plan)
    2. PANIC           holdTime < 10min AND not SL_HIT → deviationScore = f(risk%)
    3. LATE_EXIT       profit AND exit > target → held too long
    4. TARGET_HIT      exit >= target → deviationScore = 100 (followed plan)
    5. EARLY_EXIT      profit but exit < target → left money on table
    6. EARLY_EXIT      loss but exit > stopLoss → cut before plan (may be disciplined)
    7. LATE_EXIT       loss AND exit < stopLoss → held beyond stop (capital destruction)
    │
    deviationScore (0–100):
      100 = executed exactly at planned price (SL or target)
        0 = maximally deviated from plan
    │
    → { exitType, deviationScore, notes[], holdDurationMs, isPanic }
```

---

## 9. Market Data System

### 9.1 Price Resolution Pipeline

```
getPrice(symbol) [price.engine.js]
    │
    Tier 1: Redis
    ├─ key: "price:{normalizedSymbol}"
    ├─ value: pricePaise as string
    ├─ validation: isInteger AND > 100 (> ₹1.00)
    └─ hit → { pricePaise, source: "REDIS" }

    Tier 2: Memory cache
    ├─ Map<symbol, { pricePaise, ts }>
    ├─ TTL: quoteCacheTtlMs (default 30s)
    └─ fresh hit → { pricePaise, source: "MEMORY" }

    Tier 3: Yahoo Finance (live fetch)
    ├─ PQueue({ concurrency: 1, intervalCap: 1, interval: 12000 })
    ├─ yahoo-finance2.quote(normalizedSymbol)
    ├─ Guards: currency === "INR", regularMarketPrice != null, pricePaise > 100
    ├─ On success: write memory + Redis
    └─ → { pricePaise, source: "LIVE" }

    Tier 4: Stale memory fallback
    ├─ expired memory entry still present
    ├─ → { pricePaise, source: "STALE" }
    └─ BLOCKED at trade execution: STALE_PRICE_EXECUTION_BLOCKED

    No data: throw AppError("MARKET_DATA_UNAVAILABLE", 503)
```

### 9.2 Caching Strategy

| Cache | Key pattern | TTL | Invalidation |
|---|---|---|---|
| Price (Redis) | `price:{SYMBOL}` | 30s | TTL expiry |
| Price (memory) | Map in-process | 30s | TTL expiry |
| Pre-trade token | `pretrade:{UUID}` | 120s | Deleted on execution |
| Auth user | `auth:uc:{userId}` | 30s | On logout / profile update |
| Trade rate limit | `rl:trade:{userId}` | windowMs (10s) | TTL expiry |

### 9.3 Stale Data Handling

Every price response carries a `source` tag that propagates through to the trade document (`priceSource` field) and is surfaced in the UI. The UI shows a visual indicator when source ≠ LIVE. Execution with a STALE source is blocked at the service layer — not just a UI warning.

```
Price source → Trade document priceSource mapping:
  LIVE   → "REAL"
  REDIS  → "CACHE"
  MEMORY → "CACHE"
  STALE  → blocked (never reaches Trade.create)
```

### 9.4 Data Integrity Guarantees

- `avgCostPaise` is never used as a price proxy for PnL display
- `pnlPaise` is null until the actual sell price is known (UNAVAILABLE state, not 0)
- Client-submitted price is verified against server-fetched price at execution: drift > 0.5% → reject
- All currency arithmetic uses `Math.round()` at multiplication boundaries to prevent paise accumulation errors

---

## 10. Time Authority System

### 10.1 Market Hours Logic

`isMarketOpen()` uses a strict authority chain with a fail-safe default:

```
isMarketOpen(now)
    │
    ├─ Get IST date key for `now`
    │
    ├─ Cache miss (no entry for today) → return FALSE (fail-safe: treat as CLOSED)
    │   This prevents trades on days the calendar hasn't been populated yet.
    │
    ├─ Cache hit, entry.isOpen === false → return FALSE (holiday/weekend confirmed)
    │
    └─ Cache hit, entry.isOpen === true:
        currentMinutes = IST hour×60 + minute
        openMinutes  = parseTimeToMinutes(entry.openTime)  ?? 555  (09:15)
        closeMinutes = parseTimeToMinutes(entry.closeTime) ?? 930  (15:30)
        return currentMinutes >= openMinutes AND currentMinutes <= closeMinutes
```

There is no naive weekday fallback for `isMarketOpen()`. If the calendar worker hasn't populated today's entry, the market is treated as CLOSED. This is a deliberate fail-safe: false negatives (missing a trading day) are preferable to false positives (allowing trades on a holiday).

### 10.2 Holiday & Calendar Integration

The `marketCalendar.worker.js` refreshes the in-memory cache every 60 seconds from the `MarketCalendar` MongoDB collection. The collection is populated via sync with an external trading calendar service (configurable via `TRADING_CALENDAR_URL`).

Exchange is configurable: `CALENDAR_EXCHANGE_MIC=XNSE` (default) or `XBOM`.

### 10.3 Square-Off Timing Authority

`isSquareoffWindowEligible()` uses a different (more permissive) authority model than `isMarketOpen()`:

```
isSquareoffWindowEligible()
    │
    ├─ Calendar says holiday → false (veto — authoritative)
    ├─ Weekend (Sat/Sun) → false (always enforced)
    └─ If IST time >= SQUAREOFF_TIME_IST (default 15:20) → true
       (falls through to clock check even if no calendar entry today)
```

The squareoff function intentionally doesn't fail-safe to false on calendar miss. A calendar miss on a normal trading day would skip square-off entirely, leaving users with unclosed intraday positions overnight — worse than running squareoff on an edge-case day.

---

## 11. Execution Safety & Guarantees

### Transaction Safety

All financial state changes (balance, holdings, trade creation) occur inside `runInTransaction()` which wraps Mongoose's replica-set transactions with automatic retry:

```javascript
runInTransaction(work, retries = 8)
    ├─ Retries on: TransientTransactionError label
    ├─ Retries on: UnknownTransactionCommitResult label
    ├─ Retries on: error.code === 112 (WiredTiger write conflict)
    └─ Non-retriable errors propagate immediately
```

MongoDB Atlas M0 (replica set) is required. A standalone MongoDB deployment silently ignores session options and does not enforce transaction atomicity.

### Idempotency Guarantees

The `ExecutionLock` collection enforces two layers of uniqueness:
1. Sparse unique index on `idempotencyKey` (legacy compatibility)
2. Compound unique index on `(userId, requestId)` — the active guard

The upsert pattern (`$setOnInsert` + `{ upsert: true }`) ensures concurrent requests produce exactly one successful insert. The duplicate key error (code 11000) is caught and handled — not propagated as a 500.

Completed responses are stored in `ExecutionLock.responseData` and replayed for up to 7 days (configurable via `EXECUTION_LOCK_TTL_SECONDS`). Replays refresh `currentBalance` from a live DB read so the client sees the accurate post-replay balance.

### Replay Protection

The `requestPayloadHash` field on `ExecutionLock` ensures that a replayed request must present the same canonical payload that originated the lock. A different payload with the same idempotency key returns 400 `PAYLOAD_MISMATCH` — not the stored response.

### Failure Recovery

**Outbox stuck job recovery:** If an outbox job's processing crashes mid-flight, `recoverStuckProcessingJobs()` finds jobs in `PROCESSING` state older than 60 seconds and resets them to `PENDING` with exponential backoff (`BASE_BACKOFF_MS × 2^(attempts-1)`, capped at 5 minutes).

**Squareoff claim stale reclaim:** If a squareoff process crashes after claiming `SystemExecutionState` but before completing, the claim can be reclaimed after `SQUAREOFF_CLAIM_STALE_MS` (default 30 min). This prevents a failed squareoff from blocking the next day.

**Balance reservation cleanup:** `cleanupStaleReservations()` runs inside every trade transaction to release any `reservedBalancePaise` that has been held for >5 minutes without completing execution. This prevents capital being permanently locked by abandoned orders.

---

## 12. Background Processing & Workers

All workers run in-process via `setInterval` on the same Node.js instance. This is documented as a known scaling constraint (see `docs/BACKGROUND_WORKERS_SCALE.md`).

> **⚠️ Deploy exactly ONE web instance.** Multiple Railway replicas will run duplicate SL monitors and outbox pollers. Redis-based pre-locks mitigate duplicate SL triggers but do not fully prevent duplicate outbox processing.

### Outbox Pattern

```
Trade transaction → Outbox.create([{ type, payload }], { session })
    │               [committed atomically with the trade]
    │
outbox.worker (setInterval: 5s)
    │
    ├─ recoverStuckProcessingJobs() — reset PROCESSING > 60s
    ├─ getQueueDepth() — log CRITICAL if PENDING > 500
    ├─ claimNextPendingJob() — findOneAndUpdate PENDING→PROCESSING
    │
    └─ dispatch by type:
        TRADE_CLOSED → reflection job → BullMQ tradeQueue (if Redis available)
                                     → inline reflection (if Redis unavailable)
        USER_ANALYTICS_SNAPSHOT → persistUserAnalyticsSnapshot(userId)
                                   max retries: 3 (ANALYTICS_SNAPSHOT_MAX_RETRY)
    │
    On success: outbox.status = "COMPLETED"
    On failure: exponential backoff, increment attempts
               if attempts >= max → status = "FAILED" (requires operator attention)
```

### Stop Loss Monitor

`stopLossMonitor.service.js` — `setInterval: 30s`
- Gates: `isMarketOpen()` and `!isSquareoffWindowEligible()`
- Redis pre-lock per `(userId, symbol)` with 30s cooldown: prevents rapid re-trigger on volatile prices
- See §6.7 for full flow

### Square-Off Scheduler

`squareoff.service.js` — `setInterval: SQUAREOFF_POLL_MS` (default 60s)
- MongoDB-backed daily claim prevents duplicate execution across restarts
- p-limit(10) prevents thundering herd on large user bases
- See §6.8 for full flow

### Market Calendar Sync

`marketCalendar.worker.js` — refreshes in-memory cache every 60s from MongoDB. Optionally syncs from an external trading calendar Docker service (`TRADING_CALENDAR_URL`). Starts before market-sensitive services in `server.js` startup sequence to ensure `isMarketOpen()` has a populated cache on first SL monitor tick.

---

## 13. Security Architecture

### Authentication & Authorization

```
Access Token:  JWT { userId, tokenType:"access" }
               Signed with JWT_SECRET
               TTL: 15 min (ACCESS_TOKEN_TTL env)
               Storage: React memory only — never localStorage
               Validation: tokenType field check prevents refresh token misuse as access token

Refresh Token: JWT { userId, tokenType:"refresh", nonce: UUID }
               TTL: 7 days (REFRESH_TOKEN_TTL env)
               Storage: HttpOnly cookie, path=/api/auth, SameSite=Strict
               DB storage: SHA-256 hash only (raw token never persists)
               Invalidation: logout hashes new random token over it; next refresh fails comparison

CSRF Token:    crypto.randomBytes(32).hex()
               Storage: readable JS cookie, path=/api/auth
               Validation: X-CSRF-Token header must match cookie on /refresh endpoint
               (configurable: SKIP_CSRF_DEV=true for automated local tests only)
```

### Payload Integrity (HMAC)

The `buildPayloadHash()` function produces a canonical HMAC of all execution-critical fields:

```javascript
canonical = {
  symbol, productType, pricePaise, quantity, stopLossPaise, targetPricePaise
}
// Keys sorted alphabetically for determinism
// All integers via toInteger() — no float representation differences
hash = HMAC-SHA256(JWT_SECRET, JSON.stringify(canonical, sortedKeys))
```

`JWT_SECRET` is the HMAC key. If `JWT_SECRET` is missing at startup, `preTradeAuthority.store.js` throws immediately — the process does not start. There is no fallback.

### Rate Limiting

| Endpoint group | Window | Max requests | Key |
|---|---|---|---|
| Auth endpoints | 15 min | 20 | per IP |
| Trade execution | 10s (configurable) | 5 (prod) / 10 (test) | per authenticated userId |
| Intelligence endpoints | 60s | 30 | per IP |

Redis-backed rate limiting when available (shared across instances). Falls back to in-memory store (per-instance) when Redis is unavailable.

### Security Headers

Helmet.js applies: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (production), `X-XSS-Protection`.

`express-mongo-sanitize` strips `$` and `.` from request bodies and query strings to prevent NoSQL injection.

CORS is locked to an explicit origin whitelist (`FRONTEND_URL` in production; Vite dev ports in development).

---

## 14. Observability & Monitoring

### Logging Strategy

Pino structured JSON logging. Every log line includes:

```javascript
{
  service:   "trade.service" | "behavior.engine" | ...,
  step:      "TRADE_TXN_ACTIVE" | "SL_TRIGGERED" | ...,
  status:    "INFO" | "SUCCESS" | "WARN" | "FAILURE",
  traceId:   "<UUID>",          // propagated from requestTrace middleware
  userId:    "<ObjectId>",      // merged at auth middleware via traceContext
  timestamp: ISO8601,
  data:      { ... }            // structured context, never raw error stacks in production
}
```

Morgan HTTP access logs are piped through Pino (`logger.info(message.trim())`).

### Trace System

A `Trace` collection records 5 audit points per trade lifecycle:

```
PLAN     — entry parameters captured
ANALYSIS — exit and behavioral assessment
(+ inline timeline events on the Trade document itself)
```

Traces expire automatically after 90 days via MongoDB TTL index. Accessible via `/api/trace/:tradeId`.

### Health Checks

```
GET /health    — simple liveness probe (200 OK always if process is running)
GET /ready     — readiness probe with per-service status
GET /metrics   — internal metrics snapshot
```

`/ready` response shape:
```javascript
{
  status: "READY" | "DEGRADED" | "NOT_READY",
  services: {
    mongodb:                 "UP" | "DOWN",
    redis:                   "UP" | "DOWN",
    bullmqTradeQueue:        "UP" | "DOWN",
    stopLossMonitor:         "UP" | "DOWN",
    outboxWorker:            "UP" | "DOWN",
    sweeper:                 "UP" | "DOWN",
    executionExecutor:       "UP" | "DOWN",
    squareoff:               "UP_BULLMQ" | "UP_INTERVAL" | "DOWN",
    bullmqReflectionWorker:  "UP" | "DOWN",
    bullmqSquareoffWorker:   "UP" | "DOWN"
  }
}
// HTTP 200 if READY or DEGRADED (Redis optional)
// HTTP 503 if NOT_READY (MongoDB down)
```

### Metrics

`prom-client` via `/api/metrics`: trade execution latency histogram (p50/p95/p99), error rate counter, outbox queue depth gauge.

---

## 15. UI/UX System Design

### State → Action → Context Model

Every UI state transition is driven by an explicit state machine, not conditional rendering. The portfolio dashboard shows one of:

- `EMPTY` — zero trades, no holdings → onboarding prompt
- `PARTIAL` — trades exist but behavior profile not yet built (< 3 closed trades)
- `ACTIVE` — full behavioral analysis available

### Decision Visibility

The pre-trade response surface includes:
- Verdict badge: **BUY** (green) / **CAUTION** (amber) / **AVOID** (red)
- Score breakdown: setup, market, behavior (0–100 each)
- Reasons array: human-readable codes explaining the scoring
- AI explanation: plain-English synthesis (or "Analysis unavailable" — never fake output)
- Behavioral interrupt: if `REVENGE_TRADING_RISK` or `FOMO_ENTRY` detected, shown as an interstitial before the user can proceed

### Beginner UX Layer

| Feature | Implementation |
|---|---|
| Language toggle | Stored in user preferences; replaces jargon: "Stop Loss" → "Where am I wrong?", "R:R" → "Is this worth the risk?" |
| Guided wizard | 6-step trade builder instead of flat form |
| Pre-trade checklist | 5 confirmations before execute button activates |
| Risk templates | Conservative (0.5%), Standard (1%), Aggressive (2%): system calculates position size |
| Post-trade lesson cards | One plain-English insight per closed trade from reflection engine |
| Session review | End-of-session summary with one focus area |

### Degraded Mode UX

When market data is unavailable: `UNAVAILABLE` tag displayed, PnL shown as `--`, price-dependent buttons disabled. The system never shows ₹0 PnL as a substitute for unavailable data.

---

## 16. Configuration & Environment

Key environment variables (see `.env.example` for full list):

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | — | JWT signing + HMAC key. Process fails to start if missing. |
| `MONGO_URI` | **Yes** | — | MongoDB replica set URI |
| `NODE_ENV` | **Yes** | — | `development` \| `production` \| `test` |
| `FRONTEND_URL` | Prod only | — | CORS origin whitelist in production |
| `REDIS_URL` | No | — | Redis connection. Omit for degraded sync mode. |
| `SQUAREOFF_TIME_IST` | No | `15:20` | Intraday square-off trigger time (HH:MM) |
| `TRADING_CALENDAR_URL` | No | — | External calendar Docker service URL |
| `CALENDAR_EXCHANGE_MIC` | No | `XNSE` | Exchange: `XNSE` (NSE) or `XBOM` (BSE) |
| `MIN_RR` | No | `1.2` | Minimum risk:reward for trade approval |
| `TRADE_RATE_LIMIT_MAX` | No | `5` (prod) | Max trades per TRADE_RATE_LIMIT_WINDOW_MS |
| `TRADE_RATE_LIMIT_WINDOW_MS` | No | `10000` | Rate limit window in ms |
| `OUTBOX_POLL_MS` | No | `5000` | Outbox worker poll interval |
| `ACCESS_TOKEN_TTL` | No | `15m` | JWT access token lifetime |
| `REFRESH_TOKEN_TTL` | No | `7d` | JWT refresh token lifetime |
| `ALLOW_CLOSED_MARKET_EXECUTION` | Test only | `false` | `true` in test env to bypass market hours |
| `ANTHROPIC_API_KEY` | No | — | Claude API key for AI synthesis |

---

## 17. Testing Strategy

**Stack:** Jest + `mongodb-memory-server` (MongoMemoryReplSet — replica set for transaction support)

```
npm test               # all suites, --runInBand --forceExit
npm run test:unit      # engines, middleware, services
npm run test:integration # full HTTP flows with real DB
npm run test:coverage  # coverage report (thresholds: 75–90% by engine)
```

**Test environment setup (`jest-env-mongo.js`):**
- MongoMemoryReplSet provides a single-node replica set (transactions available)
- `ALLOW_CLOSED_MARKET_EXECUTION=true` bypasses market hours gate
- `JWT_SECRET` sentinel injected if not set (local dev without `.env`)

### Unit Tests

- **Entry engine:** same input → same output (determinism); intraday weights differ from delivery weights; behavioral veto fires below floor 20; REVENGE+AVOID combination forces BLOCK
- **Exit engine:** PANIC classification; SL_HIT precedence over PANIC; LATE_EXIT on overshoot; deviationScore calculation
- **Behavior engine:** REVENGE_TRADING detects within window; not detected after 61min; OVERTRADING daily burst; discipline score penalty accumulation
- **Risk engine:** RR calculation; INSUFFICIENT_RR rejection
- **Reflection engine:** LUCKY_PROFIT vs DISCIPLINED_PROFIT distinction; POOR_PROCESS on panic
- **validateTradePayload:** `preTradeToken` required on execution routes; `symbol` required; unknown fields rejected; header token injection; pre-trade schema allows no token

### Integration Tests

- **Full BUY→SELL lifecycle:** balance deducted, holding created, PnL computed, journal entry written
- **Idempotency guard:** same key twice → same tradeId, no double-execution
- **PAYLOAD_MISMATCH:** same idempotency key + different payload → 400
- **Direct API bypass:** missing preTradeToken → 400 (Zod) before 403 (enforceBuyReview)
- **Insufficient funds:** balance unchanged on rejection
- **PRICE_STALE guard:** client price >0.5% from server price → 422
- **Bad RR:** pre-trade endpoint rejects plan → no token issued
- **Contract snapshot tests:** `/trades`, `/portfolio/summary`, `/analysis/summary` DTO shape locked

### Concurrency Tests

- Concurrent same-key requests: exactly one trade created
- Concurrent different-key requests: both succeed independently
- Write-conflict retry: `runInTransaction` retries on error code 112

### Failure Simulation

- AI unavailable: trade executes, `aiExplanationStatus: PENDING` returned (no 500)
- Redis unavailable: system continues in degraded mode (in-memory fallback)
- MongoDB primary election: `TransientTransactionError` retry succeeds

---

## 18. Limitations & Tradeoffs

| Limitation | Impact | Reason / Tradeoff |
|---|---|---|
| Yahoo Finance market data | Terms of service ambiguity; throttled to 1 req/12s | Free tier constraint; Polygon.io integration planned |
| 30s SL monitor polling | Gap-down stocks can execute far below configured SL | Acceptable for paper trading simulation; real broker would use streaming quotes |
| In-process background workers | Cannot scale horizontally (duplicate execution risk) | Railway single-instance deployment; see `docs/BACKGROUND_WORKERS_SCALE.md` |
| New users bypass behavioral engine | First 3 trades get `behaviorScore=70` (safe default) | Insufficient history for statistical patterns |
| preTradeToken TTL: 2 min | Beginner wizard (6 steps) can expire token | UX vs security tradeoff; reissue flow needed |
| Single Railway region | No failover, no multi-AZ | Cost constraint for paper trading platform |
| MongoDB Atlas M0 | Shared cluster, 500 connections max, limited IOPS | Development/demo tier only |
| No real broker integration | Paper-only simulation | Deliberate design decision; Phase 2 planned |
| AI explanation is best-effort | `UNAVAILABLE` state shown when Claude unreachable | Non-blocking by design; trades never wait on AI |

---

## 19. Future Improvements

**Near-term (high leverage):**
- Replace Yahoo Finance with Polygon.io India endpoint (legitimate vendor, proper rate limits, WebSocket streaming)
- Move background workers to dedicated Railway worker dyno with Redis-distributed locks
- Add JWT blacklist (Redis-based) for immediate access token revocation on logout
- Extend preTradeToken TTL to 10 min with wizard-step heartbeat refresh

**Medium-term:**
- WebSocket streaming prices replacing 30s SL poll
- Multi-user portfolio comparison (anonymized behavioral benchmarks)
- Broker integration: Zerodha Kite Connect / Upstox API (Phase 2)
- Short selling and F&O paper simulation modes

**Architecture:**
- Separate analytics service as a standalone microservice (currently in-process)
- Event sourcing for trade lifecycle (immutable event log vs mutable status field)
- GraphQL subscription for real-time portfolio updates (replaces Socket.io polling)

---

## 20. Deployment Guide

**Railway (current setup):**
```
Web service:    Node.js 20, npm start, PORT=auto
Redis addon:    Managed Redis (USE_REDIS=true, REDIS_URL auto-injected)
MongoDB:        External Atlas M0 (MONGO_URI in Railway env)
Replicas:       1 (required — in-process workers, see §12)
```

**Required environment variables on Railway:**
```
JWT_SECRET         (min 32 chars, random)
JWT_REFRESH_SECRET
MONGO_URI          (Atlas M0 replica set URI)
FRONTEND_URL       (Railway frontend deployment URL)
NODE_ENV=production
```

**Atlas setup:**
- Cluster tier: M0 or M2+ (M0 for demo, M2+ for real load)
- Replica set: enabled by default on Atlas
- Network access: allow Railway egress IPs or `0.0.0.0/0` with connection string auth
- Indexes: Mongoose `syncIndexes` runs on startup (or run `npm run migrate:strict`)

---

## 21. How to Run Locally

### Prerequisites
- Node.js 20+
- MongoDB 6+ replica set OR use `mongodb-memory-server` (auto-used by tests)
- Redis (optional; system degrades gracefully)

### Backend setup
```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET (required), MONGO_URI (optional, tests use in-memory)

npm install
npm run dev          # nodemon src/server.js, hot-reload
```

### Frontend setup
```bash
cd frontend
npm install
npm run dev          # Vite dev server
```

### Running tests (no external services needed)
```bash
cd backend
npm test             # starts MongoMemoryReplSet automatically
```

### Verify environment
```bash
cd backend
node scripts/verify-env.js
```

---

## 22. API Reference

### Authentication

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | None | `{ name, email, password }` | `{ accessToken }` |
| POST | `/api/auth/login` | None | `{ email, password }` | `{ accessToken }` + refresh cookie |
| POST | `/api/auth/refresh` | Cookie + CSRF | — | `{ accessToken }` |
| POST | `/api/auth/logout` | Bearer | — | `{ success: true }` |

### Intelligence (Pre-Trade)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/intelligence/pre-trade` | Bearer | `{ symbol, side, quantity, pricePaise, stopLossPaise, targetPricePaise, userThinking, productType? }` | `{ verdict, scores, reasons, token, aiExplanation }` |
| GET | `/api/intelligence/news` | Bearer | — | `{ signals[], state }` |
| GET | `/api/intelligence/profile` | Bearer | — | `{ behaviorProfile, skillScore }` |

### Trade Execution

All execution routes require:
- `Authorization: Bearer <token>`
- `idempotency-key: <UUID>` header
- `preTradeToken` in body or `pre-trade-token` header

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/trades/buy` | `{ symbol, side:"BUY", quantity, pricePaise, stopLossPaise, targetPricePaise, preTradeToken, productType? }` | `{ tradeId, executionPricePaise, totalValuePaise, updatedBalance, status }` |
| POST | `/api/trades/sell` | `{ symbol, side:"SELL", quantity, pricePaise, preTradeToken, productType? }` | `{ tradeId, pnlPaise, pnlPct, updatedBalance }` |
| GET | `/api/trades` | — | `{ trades[] }` |

### Portfolio

| Method | Path | Response |
|---|---|---|
| GET | `/api/portfolio/summary` | `{ totalInvested, balance, holdings[], behaviorState }` |
| GET | `/api/portfolio/positions` | Open positions with live PnL |

### Analysis

| Method | Path | Response |
|---|---|---|
| GET | `/api/analysis/summary` | `{ skillScore, disciplineScore, patterns[], trend }` |
| GET | `/api/journal/summary` | Closed trade journal with reflection verdicts |

### Observability

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | None | `{ status: "OK" }` |
| GET | `/ready` | None | Per-service health |
| GET | `/metrics` | None | Internal metrics snapshot |
| GET | `/api/trace/:tradeId` | Bearer | Audit trail for a trade |

### Error Response Shape

```javascript
{
  success: false,
  error: {
    code:    "INSUFFICIENT_FUNDS" | "PRICE_STALE" | "PAYLOAD_MISMATCH" | "INVALID_TOKEN" | ...,
    message: String,
    details: Array | null
  },
  meta: {
    traceId: String,
    systemStateVersion: Number
  }
}
```

---

## 23. Project Structure

```
backend/
├── src/
│   ├── app.js                        # Express app (middleware + route registration)
│   ├── server.js                     # Startup: DB → workers → listen
│   │
│   ├── config/
│   │   ├── db.js                     # Mongoose connect + replica set options
│   │   └── system.config.js          # All thresholds from env vars (no hardcoding)
│   │
│   ├── engines/                      # Pure decision engines (deterministic, testable)
│   │   ├── entry.engine.js           # BUY/CAUTION/AVOID verdict
│   │   ├── exit.engine.js            # Exit classification + deviation score
│   │   └── reflection.engine.js     # Post-trade process verdict
│   │
│   ├── services/
│   │   ├── trade.service.js          # Core execution: atomic, idempotent, transactional
│   │   ├── behavior.engine.js        # Behavioral pattern detection (pure function)
│   │   ├── risk.engine.js            # RR validation and scoring
│   │   ├── price.engine.js           # 4-tier price resolution pipeline
│   │   ├── squareoff.service.js      # Auto square-off with p-limit + Mongo claim
│   │   ├── stopLossMonitor.service.js# SL/target polling with Redis locks
│   │   ├── analytics.service.js      # Full portfolio analytics computation
│   │   ├── marketHours.service.js    # Re-exports from marketHours.util.js
│   │   └── intelligence/
│   │       ├── preTradeGuard.service.js  # Pre-trade decision orchestration
│   │       └── preTradeAuthority.store.js # Token issuance + HMAC verification
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js         # JWT verify + Redis user cache
│   │   ├── validateTradePayload.js   # Zod schemas: execution (preTradeToken required)
│   │   │                              #              pre-trade (no token yet)
│   │   ├── requestTrace.js           # traceId injection on every request
│   │   ├── requestMetrics.js         # prom-client instrumentation
│   │   └── error.middleware.js       # Global error handler (AppError → structured response)
│   │
│   ├── models/                       # Mongoose schemas with index definitions
│   │   ├── trade.model.js
│   │   ├── holding.model.js
│   │   ├── executionLock.model.js
│   │   ├── preTradeToken.model.js
│   │   ├── systemExecutionState.model.js
│   │   ├── marketCalendar.model.js
│   │   ├── outbox.model.js
│   │   └── user.model.js
│   │
│   ├── utils/
│   │   ├── transaction.js            # runInTransaction with 8-retry + write conflict handling
│   │   ├── marketHours.util.js       # isMarketOpen (calendar-authoritative), squareoff gate
│   │   ├── paise.js                  # toPaise, enforcePaise — integer currency enforcement
│   │   ├── logger.js                 # Pino structured logger
│   │   ├── AppError.js               # Domain error with HTTP code + error code
│   │   └── systemPreLock.js          # Redis NX lock (acquirePreLock)
│   │
│   ├── workers/
│   │   ├── outbox.worker.js          # Outbox poller: stuck recovery, backoff, dispatch
│   │   └── marketCalendar.worker.js  # Calendar cache refresh + external sync
│   │
│   └── queue/
│       ├── queue.js                  # Bull queue setup (Redis-backed)
│       └── squareoff.schedule.js     # Squareoff scheduler bootstrap
│
├── tests/
│   ├── unit/                         # Engine and service unit tests
│   ├── integration/                  # Full HTTP flow tests
│   ├── concurrency/                  # Race condition and write-conflict tests
│   ├── security/                     # Auth bypass and token security tests
│   ├── global/                       # MongoMemoryReplSet setup/teardown
│   └── setup/                        # Jest per-file setup (market hours, JWT sentinel)
│
├── docs/
│   └── BACKGROUND_WORKERS_SCALE.md   # Scaling guidance for in-process workers
│
└── scripts/
    ├── verify-env.js                 # Pre-flight env check
    └── migrateHoldingTradeType.js    # Holdings schema migration

frontend/
├── src/
│   ├── App.jsx                       # Route definitions
│   ├── queryClient.ts                # React Query configuration
│   └── v2/
│       ├── api/                      # API client functions
│       ├── features/trade/           # Trade terminal, decision panel
│       └── components/               # Shared UI components
```

---

## 24. Key Engineering Decisions

### Paise as canonical currency unit
All currency values are stored and computed as integers in paise (1 INR = 100 paise). This eliminates floating-point rounding errors across the entire system. `enforcePaise()` validates this at every boundary. Multiplication results are `Math.round()`-ed immediately. Division is done only at the presentation layer.

### DB-native idempotency (not application-layer locking)
The `ExecutionLock.updateOne({ $setOnInsert })` pattern delegates conflict detection to MongoDB's unique index enforcement. This is correct for distributed environments — application-layer locks (Redis SETNX, in-memory Map) can fail silently under network partition or process restart. The DB index never fails silently.

### Two-phase execution (PENDING_EXECUTION → EXECUTED)
Separating the "place order" step from the "execute order" step enables queuing orders for market-open execution while still holding a pre-trade token and a balance reservation. The sweeper picks up `PENDING_EXECUTION` orders when the market opens. This handles the "user places order after hours" scenario without losing the token or leaving capital unaccounted.

### Outbox inside the transaction
`Outbox.create([...], { session })` runs inside the same transaction as the trade commit. If the transaction rolls back, the outbox record is also rolled back. This guarantees that downstream async work (reflection, analytics) is triggered exactly once per committed trade — never missed and never doubled.

### Behavioral veto as a hard gate, not a soft score
If `behaviorScore < 20`, the entry engine returns BLOCK regardless of how good the setup or market scores are. This is the thesis made concrete: psychological risk is not just one input to a weighted average — it can override everything else. A technically valid trade with a revenge trading profile is still blocked.

### Fail-safe market hours
`isMarketOpen()` returns `false` when the calendar cache has no entry for today. The system treats an unknown day as closed. This prevents trades from executing on days where the calendar sync has lagged — false negatives (missing a trading day) are better than false positives (allowing trades on a holiday).

### Reflection separates process from outcome
The `LUCKY_PROFIT` classification is the single most important design decision in the system. Without it, a user who breaks every rule but profits by luck gets positive reinforcement — the platform teaches them the wrong lesson. Explicitly tagging lucky outcomes prevents this.

---

## 25. Lessons Learned

**Behavioral gates must be symmetric.** Initially, the pre-trade guard checked for revenge trading across all symbols. A loss on RELIANCE would block a new trade on INFY. This was wrong — the behavioral pattern is symbol-specific (same stock re-entry after a loss, not generic loss aversion). Fix applied in `preTradeGuard.service.js`: symbol normalization before the revenge window check.

**Idempotency key mismatch is a security concern.** The first implementation stored completed responses in the lock but didn't verify the payload hash on replay. An attacker could submit a favorable payload hash first, store the lock, then replay with a different payload claiming the cached response. The `requestPayloadHash` field and PAYLOAD_MISMATCH check were added to close this gap.

**Mongo aggregation pipeline in `findOneAndUpdate` is the correct avgCost pattern.** Application-level average cost computation (read-then-write) has a TOCTOU race: two concurrent buys of the same symbol read the same old average and both write the wrong new average. Using `$let` expressions inside a MongoDB aggregation pipeline update pushes the computation atomically into the DB where both concurrent updates are serialized.

**Token TTL must match the longest user journey.** A 2-minute preTradeToken TTL is too short for a 6-step guided wizard. Beginners taking their time through the checklist hit token expiry and see an opaque error. This is a known UX deficiency (documented in §18).

**The "Winston" comment in `app.js` survived a logger migration.** A single stale code comment (`// Intercept Morgan logs and push them into Winston`) was left when the project migrated from Winston to Pino. This is the kind of discrepancy that erodes trust in code reviews. Comments must be updated at the point of change.

---

## 26. Final Thoughts

This platform exists because execution systems are blind to intent. A revenge trade and a disciplined trade look identical to any standard trading tool. The behavioral layer here is not a feature — it is the core value proposition.

The system is honest about what it is: a paper trading simulation for beginners learning the Indian equity market. It does not claim real-time streaming data, sub-millisecond execution, or production-grade horizontal scale. It does claim behavioral intelligence, financial correctness, atomic execution, and honest feedback.

The most important user experience in this system is not the trade terminal. It is the reflection card shown after a trade closes — the one that tells a user whether they made money through discipline or through luck. That distinction, delivered consistently and honestly, is what changes how a beginner thinks about markets.

---

*This is a paper trading simulation. No real money is at risk. Market data is sourced via yahoo-finance2 (unofficial Yahoo Finance wrapper). This project is not affiliated with any stock exchange or brokerage.*
