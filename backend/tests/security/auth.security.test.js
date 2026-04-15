const request = require("supertest");
const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });
const app = require("../../src/app");
const User = require("../../src/models/user.model");
jest.setTimeout(30000);
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trading_platform_test";

const extractCookie = (setCookie = [], key) => {
  const row = setCookie.find((c) => c.startsWith(`${key}=`));
  if (!row) return null;
  return row.split(";")[0];
};

describe("Auth Security Hardening", () => {
  const email = "auth-security@pulse.local";
  const password = "securepass";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }
  });

  beforeEach(async () => {
    await User.deleteMany({ email });
  });

  afterAll(async () => {
    await User.deleteMany({ email });
    await mongoose.connection.close();
  });

  it("rejects refresh without x-csrf-token header", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Security User",
      email,
      password,
    });

    expect(registerRes.status).toBe(201);
    const cookies = registerRes.headers["set-cookie"] || [];
    const refreshCookie = extractCookie(cookies, "refreshToken");
    const csrfCookie = extractCookie(cookies, "csrfToken");
    expect(refreshCookie).toBeTruthy();
    expect(csrfCookie).toBeTruthy();

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [refreshCookie, csrfCookie]);

    expect(refreshRes.status).toBe(403);
    expect(refreshRes.body.message).toBe("CSRF_TOKEN_INVALID");
  });

  it("rejects old refresh token replay after rotation", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Security User",
      email,
      password,
    });

    expect(registerRes.status).toBe(201);
    const initialCookies = registerRes.headers["set-cookie"] || [];
    const oldRefreshCookie = extractCookie(initialCookies, "refreshToken");
    const oldCsrfCookie = extractCookie(initialCookies, "csrfToken");
    const oldCsrfToken = oldCsrfCookie?.split("=")[1];

    expect(oldRefreshCookie).toBeTruthy();
    expect(oldCsrfToken).toBeTruthy();

    const rotateRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [oldRefreshCookie, oldCsrfCookie])
      .set("x-csrf-token", oldCsrfToken);

    expect(rotateRes.status).toBe(200);

    const replayRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [oldRefreshCookie, oldCsrfCookie])
      .set("x-csrf-token", oldCsrfToken);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.message).toBe("Invalid refresh token");
  });

  it("logout invalidates refresh token and clears cookies", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Security User",
      email,
      password,
    });

    expect(registerRes.status).toBe(201);
    const accessToken = registerRes.body.token;
    const cookies = registerRes.headers["set-cookie"] || [];
    const refreshCookie = extractCookie(cookies, "refreshToken");
    const csrfCookie = extractCookie(cookies, "csrfToken");
    const csrfToken = csrfCookie?.split("=")[1];

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", [refreshCookie, csrfCookie]);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe("LOGOUT_SUCCESS");

    const user = await User.findOne({ email }).select("+refreshToken");
    expect(user.refreshToken).toBeFalsy();

    const replayRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [refreshCookie, csrfCookie])
      .set("x-csrf-token", csrfToken);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.message).toBe("Invalid refresh token");
  });
});

