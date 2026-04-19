# Background workers and horizontal scale (P1-C)

## Current behavior

These components run **inside the Node web process** on a **`setInterval`** (or equivalent) loop:

| Component | File |
|-----------|------|
| Outbox poller | `src/workers/outbox.worker.js` |
| Stop-loss monitor | `src/services/stopLossMonitor.service.js` |
| Pending execution executor | `src/services/execution.executor.js` |
| Pending-order sweeper | `src/services/order.sweeper.js` (via `sweeper.service.js`) |

Each **Railway / Render web instance** starts its **own** copy of these loops. With **two or more instances** behind a load balancer:

- **Outbox**: both processes poll MongoDB; the same job can be **claimed or competed** by multiple workers. Downstream handlers are expected to stay **idempotent**, but you still pay **duplicate work**, extra DB contention, and noisier logs.
- **Stop-loss monitor**: each instance scans holdings and may hit the same symbols / users in parallel.
- **Execution executor**: each instance may call `executeOrder` for overlapping pending trades (again mitigated by trade-level locking/idempotency where implemented, but still duplicate effort).

This is **acceptable for a single-instance learning deployment**.

## Deploy today (recommended)

- Run **exactly one web dyno / service instance** (e.g. Railway: **1 replica** for the API service).
- Do not scale the web service horizontally until background work is coordinated (below).

## Post-deploy / production scale-out

Choose one (or combine):

1. **Dedicated worker process** — One dyno runs HTTP only; another runs only BullMQ consumers / workers (no duplicate in-process timers on API replicas).
2. **Distributed locks** — e.g. Redis `SET NX` with TTL around each poll cycle or per-job shard (similar spirit to `systemExecutionState` / pre-locks already used elsewhere).
3. **BullMQ-only background processing** — Move outbox (and similar) from `setInterval` to **repeatable BullMQ jobs** with a stable `jobId`, matching the pattern already used for square-off coordination when Redis is enabled.

Document this in interviews: *“Process-local loops are fine for single-instance; multi-instance needs a worker dyno or Redis-backed scheduling so only one runner owns each background concern.”*
