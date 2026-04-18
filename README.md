# Stock Trading Platform

An intelligent trading simulator with a decision-centric UI, real-time market context, portfolio tracking, journaling, and traceability for pre-trade and post-trade analysis.

## Project overview

The repository is a **full-stack** application:

- **Frontend** (`/frontend`): React (Vite) SPA—the v2 surface focuses on **decisions** (attention, trade, journal, markets, portfolio, profile, trace).
- **Backend** (`/backend`): Node.js (Express) API with MongoDB, background workers (when Redis is enabled), and intelligence/risk flows around trade execution.

Documentation for architecture, migration notes, and UI rebuild guidance lives in **`/docs`**.

## Architecture (short)

- **HTTP**: Express routes → controllers → services → engines / models.
- **Data**: Mongoose models for users, trades, holdings, journal, trace, etc.
- **Cross-cutting**: middleware (auth, validation, errors), adapters for API shaping, contracts/validation for payloads where applicable.
- **Frontend**: React Query for server state; v2 modules under `frontend/src/v2` (layout, pages, hooks, API client under `v2/api`).

See `docs/ARCHITECTURE_WHITEPAPER_v1.md` and `docs/ARCHITECTURE_MAPPING.md` for deeper detail.

## Tech stack

| Area | Stack |
|------|--------|
| Frontend | React 19, Vite, React Query, CSS modules / tokens (v2) |
| Backend | Node.js, Express, Mongoose, Zod, Winston |
| Data | MongoDB |
| Optional | Redis (queues, degraded mode without it) |
| Auth | JWT + httpOnly refresh / CSRF patterns (see backend `.env.example`) |

## Setup

### Prerequisites

- Node.js 20+ (LTS recommended)
- MongoDB (local URI or Atlas)
- Optional: Redis for full background job behavior

### Backend

```bash
cd backend
cp .env.example .env
# Set MONGODB_URI, JWT_SECRET, FRONTEND_URL, etc.
npm install
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_API_BASE_URL to match backend host:port (see backend/.env `PORT`, e.g. http://localhost:5001)
npm install
```

## How to run

### Development

**Terminal 1 — API**

```bash
cd backend
npm run dev
```

API port is **`PORT` in `backend/.env`** (example in `.env.example` is **5001**; falls back to **8080** if unset).

**Terminal 2 — Web**

```bash
cd frontend
npm run dev
```

Vite dev server (see `frontend/vite.config.js`, often port **5180**).

### Production build

**Frontend**

```bash
cd frontend
npm run build
```

Output: `frontend/dist/` — deploy as a static site; point `VITE_API_BASE_URL` at your API.

**Backend**

```bash
cd backend
npm start
```

Use `NODE_ENV=production` for hardened error handling and typical production settings.

## Key features (decision system)

- **Pre-trade intelligence**: Risk and authority checks before execution; structured responses for the trade UI.
- **Attention & decisions**: Surfaces actionable items across home, markets, portfolio, journal, and profile.
- **Trace**: Audit-style visibility into decision and request flow (where enabled).
- **Journal & reflection**: Ties outcomes and learning surfaces to trades.

## Screens & flow (optional)

Typical user path: **Login** → **Home / Dashboard** → **Markets** → **Trade** (with pre-trade token / validation) → **Portfolio** → **Journal** → **Profile** → **Trace** for verification.

## Documentation

| Doc | Purpose |
|-----|---------|
| `docs/ARCHITECTURE_WHITEPAPER_v1.md` | High-level architecture |
| `docs/ARCHITECTURE_MAPPING.md` | Component / route mapping |
| `docs/guideforuirebuild.md` | UI rebuild guide |
| `docs/MIGRATION_TRACKER.md` | Migration notes |
| `docs/TRADE_CONTRACT_v1.md` | Trade domain contract notes |
| `docs/FinalSystemArchitecture.md` | System architecture snapshot |
| `docs/SYSTEM_DESIGN.md` | Design notes |

## Scripts (backend)

Database migrations and one-off scripts live under **`backend/scripts`**. Use npm scripts in `backend/package.json` (e.g. `migrate:strict`, `migrate:holdings`).

---

For deployment, configure CORS via `FRONTEND_URL`, secure cookies in production, and never commit `.env` files.
