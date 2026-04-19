/**
 * k6: 70% BUY / 30% SELL (pre-trade + execute). Default 50 VUs × 5 minutes.
 *
 * Set TRADE_RATE_LIMIT_MAX on the API (e.g. 200) for this scenario; default is 5 / 10s per IP.
 *
 *   k6 run scripts/k6/trade-mix.js \
 *     -e API_BASE=https://your-api.up.railway.app \
 *     -e K6_EMAIL=load@example.com \
 *     -e K6_PASSWORD=secret \
 *     -e K6_SYMBOL=RELIANCE.NS \
 *     -e K6_PRICE_PAISE=2500000 \
 *     -e K6_SL_PAISE=2450000 \
 *     -e K6_TP_PAISE=2600000
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const sellExecuteMs = new Trend("sell_execute_ms");
const buyExecuteMs = new Trend("buy_execute_ms");

const API = __ENV.API_BASE || "http://localhost:5001";
const symbol = __ENV.K6_SYMBOL || "RELIANCE.NS";
const pricePaise = Number(__ENV.K6_PRICE_PAISE || 2500000);
const stopLossPaise = Number(__ENV.K6_SL_PAISE || 2450000);
const targetPricePaise = Number(__ENV.K6_TP_PAISE || 2600000);
const bootstrap = (__ENV.K6_BOOTSTRAP_BUY || "1") !== "0";
const vus = Number(__ENV.K6_VUS || 50);

export const options = {
  scenarios: {
    trade_mix: {
      executor: "constant-vus",
      vus,
      duration: "5m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.08"],
    sell_execute_ms: ["p(95)<200"],
    buy_execute_ms: ["p(95)<3000"],
  },
};

function login() {
  const email = __ENV.K6_EMAIL;
  const password = __ENV.K6_PASSWORD;
  if (!email || !password) {
    return null;
  }
  const res = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "LOGIN" } }
  );
  if (res.status !== 200) {
    return null;
  }
  let body;
  try {
    body = res.json();
  } catch {
    return null;
  }
  return body.token || null;
}

function preTrade(token, payload, tag) {
  return http.post(`${API}/api/intelligence/pre-trade`, JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { name: tag },
  });
}

function extractPreTradeToken(res) {
  let body;
  try {
    body = res.json();
  } catch {
    return null;
  }
  return body.data?.token ?? body.data?.authority?.token ?? null;
}

export function setup() {
  const token = login();
  if (!token || !bootstrap) {
    return { token };
  }
  const pre = preTrade(
    token,
    {
      symbol,
      side: "BUY",
      quantity: 50,
      pricePaise,
      stopLossPaise,
      targetPricePaise,
      userThinking: "k6 bootstrap position for SELL mix.",
    },
    "BOOT_PRETRADE"
  );
  const buyTok = extractPreTradeToken(pre);
  if (!buyTok) {
    return { token };
  }
  http.post(
    `${API}/api/trades/buy`,
    JSON.stringify({
      symbol,
      side: "BUY",
      quantity: 50,
      pricePaise,
      stopLossPaise,
      targetPricePaise,
      preTradeToken: buyTok,
      decisionContext: { stage: "LOAD_TEST" },
      userThinking: "k6 bootstrap buy.",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "idempotency-key": `k6-bootstrap-${randomString(24)}`,
        "pre-trade-token": buyTok,
      },
      tags: { name: "BOOT_BUY" },
    }
  );
  return { token };
}

export default function (data) {
  const token = data.token;
  if (!token) {
    http.get(`${API}/health`, { tags: { name: "HEALTH_ONLY" } });
    sleep(1);
    return;
  }

  const mix = Math.random();
  if (mix < 0.7) {
    const pre = preTrade(
      token,
      {
        symbol,
        side: "BUY",
        quantity: 1,
        pricePaise,
        stopLossPaise,
        targetPricePaise,
        userThinking: "k6 BUY leg.",
      },
      "BUY_PRETRADE"
    );
    check(pre, { "buy pre-trade 200": (r) => r.status === 200 });
    const buyTok = extractPreTradeToken(pre);
    if (!buyTok) {
      sleep(0.3);
      return;
    }
    const buy = http.post(
      `${API}/api/trades/buy`,
      JSON.stringify({
        symbol,
        side: "BUY",
        quantity: 1,
        pricePaise,
        stopLossPaise,
        targetPricePaise,
        preTradeToken: buyTok,
        decisionContext: { stage: "LOAD_TEST" },
        userThinking: "k6 BUY execute.",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "idempotency-key": randomString(32),
          "pre-trade-token": buyTok,
        },
        tags: { name: "BUY_EXECUTE" },
      }
    );
    const buyOk = check(buy, { "buy 201": (r) => r.status === 201 });
    if (buyOk) buyExecuteMs.add(buy.timings.duration);
  } else {
    const pre = preTrade(
      token,
      {
        symbol,
        side: "SELL",
        quantity: 1,
        pricePaise,
        userThinking: "k6 SELL leg.",
      },
      "SELL_PRETRADE"
    );
    check(pre, { "sell pre-trade 200": (r) => r.status === 200 });
    const sellTok = extractPreTradeToken(pre);
    if (!sellTok) {
      sleep(0.3);
      return;
    }
    const sell = http.post(
      `${API}/api/trades/sell`,
      JSON.stringify({
        symbol,
        side: "SELL",
        quantity: 1,
        pricePaise,
        preTradeToken: sellTok,
        decisionContext: { stage: "LOAD_TEST" },
        userThinking: "k6 SELL execute.",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "idempotency-key": randomString(32),
          "pre-trade-token": sellTok,
        },
        tags: { name: "SELL_EXECUTE" },
      }
    );
    const sellOk = check(sell, { "sell 201": (r) => r.status === 201 });
    if (sellOk) sellExecuteMs.add(sell.timings.duration);
  }
  sleep(0.2);
}
