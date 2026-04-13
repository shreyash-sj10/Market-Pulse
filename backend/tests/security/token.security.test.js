const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");

describe("token security enforcement", () => {
  it("rejects request when token is missing", async () => {
    const res = await request(app).get("/api/portfolio/summary");
    expect(res.status).toBe(401);
  });

  it("rejects access route when tokenType is refresh", async () => {
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", tokenType: "refresh" },
      process.env.JWT_SECRET || "provide_a_secure_random_string_here"
    );

    const res = await request(app)
      .get("/api/portfolio/summary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("rejects expired token", async () => {
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", tokenType: "access" },
      process.env.JWT_SECRET || "provide_a_secure_random_string_here",
      { expiresIn: -1 }
    );

    const res = await request(app)
      .get("/api/portfolio/summary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("rejects refresh endpoint when access token is misused as refresh cookie", async () => {
    const accessToken = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", tokenType: "access" },
      process.env.JWT_SECRET || "provide_a_secure_random_string_here",
      { expiresIn: "15m" }
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${accessToken}`, "csrfToken=test-csrf"])
      .set("x-csrf-token", "test-csrf");

    expect(res.status).toBe(401);
  });
});
