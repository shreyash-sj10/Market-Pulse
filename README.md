# Antigravity Fin - Intelligent Trading Platform

A premium, algorithmic stock trading simulator with real-time technical analysis, AI-driven risk scoring, and a high-fidelity Mark-to-Market dashboard.

## 🚀 Deployment Guide (Production Ready)

This platform is architected for instant deployment to cloud providers (e.g., Heroku, Vercel, Render).

### 1. Backend Setup
1.  Navigate to `/backend`.
2.  Copy `.env.example` to `.env`.
3.  Provide your **Production MongoDB URI** and a secure **JWT Secret**.
4.  Set `FRONTEND_URL` to your production frontend domain to enable CORS.
5.  Run `npm install` and then `npm start`.

### 2. Frontend Setup
1.  Navigate to `/frontend`.
2.  Copy `.env.example` to `.env`.
3.  Set `VITE_API_BASE_URL` to your deployed backend URL.
4.  Provide your **Finnhub API Key**.
5.  Run `npm install` and then `npm run build`.
6.  Deploy the `/dist` folder to any static site host (Vercel, Netlify, S3).

## 🧠 Key Features
- **Intelligent Market Explorer**: Real-time RSI, EMA, and Volume surge signals.
- **Mark-to-Market Dashboard**: Live equity tracking and AUM trajectory charts.
- **AI Execution Engine**: Instant risk analysis and mistake detection (Overtrading, Revenge Trading, etc.).
- **Global Awareness**: Integrated Market News and Tick-by-Tick price syncing.

## 🛠 Tech Stack
- **Frontend**: React (Vite), Framer Motion, Recharts, Lucide, React Query.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Winston (Logging), Zod (Validation).
- **Security**: JWT-based silent token refresh, Production-grade error masking.

---

> [!IMPORTANT]
> **Production Identity**: The platform is now fully personalized. Register with your real name to see it reflected in the Navbar and Performance Terminal.

> [!TIP]
> Use `NODE_ENV=production` on your server to enable security hardening and optimized response times.
