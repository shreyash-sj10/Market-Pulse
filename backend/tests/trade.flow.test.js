const request = require("supertest");
process.env.NODE_ENV = "test";

// --- MOCK MARKET DATA SERVICE (MUST BE BEFORE APP) ---
const marketDataService = require("../src/services/marketData.service");
jest.mock("../src/services/marketData.service", () => ({
    validateSymbol: jest.fn().mockResolvedValue({ isValid: true, pricePaise: 200000 }),
    getLivePrices: jest.fn().mockResolvedValue({}),
    getLivePrice: jest.fn().mockResolvedValue(200000)
}));

const app = require("../src/app");
const mongoose = require("mongoose");
const Trade = require("../src/models/trade.model");
const ExecutionLock = require("../src/models/executionLock.model");
const User = require("../src/models/user.model");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

require("dotenv").config();
const connectDB = require("../src/config/db");

describe("Institutional Trade Integrity Suite (Full Hardening Audit)", () => {
    let userToken;
    let userId;

    beforeAll(async () => {
        await connectDB();
        // Use an existing test user or create one
        let user = await User.findOne({ email: "institutional-tester@marketpulse.ai" });

        if (!user) {
            user = await User.create({
                name: "Institutional Tester",
                email: "institutional-tester@marketpulse.ai",
                password: "password123",
                balance: 100000000, 
                realizedPnL: 0
            });
        } else {
            user.balance = 100000000;
            await user.save();
        }

        userId = user._id;
        userToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "default_secret");
    }, 30000);

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test("1. Full Lifecycle: BUY -> SELL -> Snapshot -> Reflection Integrity", async () => {
        const idempotencyBuy = randomUUID();
        const symbol = "NIFTY_HARDENED";

        const preTradeRes = await request(app)
            .post("/api/intelligence/pre-trade")
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                symbol, pricePaise: 2200000, quantity: 10, stopLossPaise: 2180000, targetPricePaise: 2250000,
                userThinking: "Analyzing demand zone. Momentum Breakout.",
                reason: "Protocol execution."
            });

        expect(preTradeRes.status).toBe(200);
        const token = preTradeRes.body.data.token;

        const buyRes = await request(app)
            .post("/api/trades/buy")
            .set("Authorization", `Bearer ${userToken}`)
            .set("idempotency-key", idempotencyBuy)
            .send({
                symbol, quantity: 10, pricePaise: 2200000, stopLossPaise: 2180000, targetPricePaise: 2250000,
                preTradeToken: token,
                decisionContext: { stage: "FINAL_EXECUTION" },
                userThinking: "Momentum Breakout confirmed."
            });

        expect(buyRes.status).toBe(201);
        
        const idempotencySell = randomUUID();
        const sellRes = await request(app)
            .post("/api/trades/sell")
            .set("Authorization", `Bearer ${userToken}`)
            .set("idempotency-key", idempotencySell)
            .send({
                symbol, quantity: 10, pricePaise: 2260000,
                decisionContext: { stage: "EXIT_PROTOCOL" },
                userThinking: "Target reached."
            });

        expect(sellRes.status).toBe(201);
        const sellTrade = sellRes.body.trade;
        expect(sellTrade.pnlPaise).toBeDefined();
        // Since we mocked 200000 (2000 INR) but sent 2200000 in Step B, and 2260000 in Step C.
        // P&L is (2260000 - 2200000) * 10 = 600000
        expect(sellTrade.pnlPaise).toBe(600000);
    });

    test("2. System Enforcement: Reject Invalid Trade (Bad RR)", async () => {
        const symbol = "NIFTY_RR_FAIL";
        const preTradeRes = await request(app)
            .post("/api/intelligence/pre-trade")
            .set("Authorization", `Bearer ${userToken}`)
            .send({ 
                symbol, pricePaise: 2200000, quantity: 10, stopLossPaise: 2195000, targetPricePaise: 2202000,
                userThinking: "Testing bad RR." 
            });

        const token = preTradeRes.body.data.token;
        const badRrRes = await request(app).post("/api/trades/buy").set("Authorization", `Bearer ${userToken}`)
            .send({
                symbol, quantity: 10, pricePaise: 2200000, stopLossPaise: 2195000, targetPricePaise: 2202000,
                preTradeToken: token, decisionContext: { stage: "CHECK" }
            });
        expect(badRrRes.status).toBe(403);
    });

    test("3. Security Enforcement: Reject direct API call", async () => {
        const bypassRes = await request(app).post("/api/trades/buy").set("Authorization", `Bearer ${userToken}`)
            .send({ symbol: "BYPASS", quantity: 1, pricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000, decisionContext: { stage: "B" } });
        expect(bypassRes.status).toBe(403);
    });

    test("4. Idempotency Guard", async () => {
        const idempotencyKey = randomUUID();
        const symbol = "IDEM_TEST";
        const tokenRes = await request(app).post("/api/intelligence/pre-trade").set("Authorization", `Bearer ${userToken}`)
            .send({ symbol, pricePaise: 1000, quantity: 1, stopLossPaise: 800, targetPricePaise: 1500, userThinking: "T" });
        const token = tokenRes.body.data.token;
        const payload = { symbol, quantity: 1, pricePaise: 1000, stopLossPaise: 800, targetPricePaise: 1500, preTradeToken: token, decisionContext: { stage: "T" } };

        const res1 = await request(app).post("/api/trades/buy").set("Authorization", `Bearer ${userToken}`).set("idempotency-key", idempotencyKey).send(payload);
        expect(res1.status).toBe(201);
        const res2 = await request(app).post("/api/trades/buy").set("Authorization", `Bearer ${userToken}`).set("idempotency-key", idempotencyKey).send(payload);
        expect(res2.status).toBe(201);
        expect(res2.body.trade.id).toBe(res1.body.trade.id);
    });

    test("5. FIFO Mapping", async () => {
       const symbol = "FIFO_TEST";
       // Direct DB create to bypass complex setup
       await Trade.create({
           user: userId, symbol, type: "BUY", quantity: 10, pricePaise: 10000, totalValuePaise: 100000,
           stopLossPaise: 9000, targetPricePaise: 12000, rrRatio: 2,
           entryPlan: { entryPricePaise: 10000, stopLossPaise: 9000, targetPricePaise: 12000, rr: 2, intent: "L", reasoning: "T" },
           decisionSnapshot: { verdict: "BUY", score: 80, pillars: {} }
       });
       
       const sellRes = await request(app).post("/api/trades/sell").set("Authorization", `Bearer ${userToken}`).set("idempotency-key", randomUUID())
           .send({ symbol, quantity: 5, pricePaise: 12000, decisionContext: { stage: "F" } });

       expect(sellRes.status).toBe(201);
       const journalRes = await request(app).get("/api/journal/summary").set("Authorization", `Bearer ${userToken}`);
       const cards = journalRes.body.data.cards.filter(c => c.symbol === symbol);
       expect(cards.length).toBe(1);
       expect(cards[0].quantity).toBe(5);
    });

    test("6. Rate Limiting", async () => {
        const tasks = [];
        for (let i = 0; i < 15; i++) {
            tasks.push(request(app).post("/api/trades/buy").set("Authorization", `Bearer ${userToken}`).send({ symbol: "SPAM", decisionContext: { stage: "S" } }));
        }
        const results = await Promise.all(tasks);
        expect(results.some(r => r.status === 429)).toBe(true);
    });
});
