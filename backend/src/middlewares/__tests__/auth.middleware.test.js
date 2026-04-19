jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const mockRedis = {
  status: "not-ready",
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

jest.mock("../../utils/redisClient", () => mockRedis);

jest.mock("../../models/user.model", () => ({
  findById: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const User = require("../../models/user.model");
const logger = require("../../utils/logger");
const protect = require("../auth.middleware");
const { cacheUser, invalidateUserCache } = protect;

const buildRes = () => ({});
const buildNext = () => jest.fn();

describe("auth.middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.status = "not-ready";
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.del.mockReset();
  });

  it("rejects missing token", async () => {
    const req = { headers: {} };
    const next = buildNext();
    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("rejects invalid token type", async () => {
    jwt.verify.mockReturnValue({ userId: "u1", tokenType: "refresh" });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("rejects when user not found", async () => {
    jwt.verify.mockReturnValue({ userId: "u1", tokenType: "access" });
    // Chain: findById().select().lean() → null (user not in DB)
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next without error when token and user are valid", async () => {
    jwt.verify.mockReturnValue({ userId: "u1", tokenType: "access" });
    // Chain: findById().select().lean() → plain user object
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "u1", email: "a@b.c" }),
      }),
    });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(expect.objectContaining({ _id: "u1" }));
  });

  it("rejects when jwt verification throws", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("bad token");
    });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("returns early from cache when Redis has a valid user snapshot", async () => {
    mockRedis.status = "ready";
    mockRedis.get.mockResolvedValue(JSON.stringify({ _id: "cached-user", email: "c@d.e" }));
    jwt.verify.mockReturnValue({ userId: "cached-user", tokenType: "access" });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(expect.objectContaining({ _id: "cached-user" }));
    expect(User.findById).not.toHaveBeenCalled();
  });

  it("warms cache after DB fetch", async () => {
    mockRedis.status = "ready";
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    jwt.verify.mockReturnValue({ userId: "u1", tokenType: "access" });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "u1", email: "a@b.c" }),
      }),
    });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it("cacheUser swallows Redis set errors", async () => {
    mockRedis.status = "ready";
    mockRedis.set.mockRejectedValueOnce(new Error("redis down"));
    await cacheUser("u1", { _id: "u1", email: "a@b.c" });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "AUTH_CACHE_WRITE_FAIL" })
    );
  });

  it("getCachedUser returns null on parse errors", async () => {
    mockRedis.status = "ready";
    mockRedis.get.mockResolvedValue("{not-json");
    jwt.verify.mockReturnValue({ userId: "u1", tokenType: "access" });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "u1" }),
      }),
    });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();
    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTH_CACHE_READ_FAIL" }));
  });

  it("invalidateUserCache deletes key when Redis is ready", async () => {
    mockRedis.status = "ready";
    mockRedis.del.mockResolvedValue(1);
    await invalidateUserCache("u1");
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it("invalidateUserCache swallows del errors", async () => {
    mockRedis.status = "ready";
    mockRedis.del.mockRejectedValueOnce(new Error("no"));
    await invalidateUserCache("u1");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "AUTH_CACHE_INVALIDATE_FAIL" })
    );
  });
});
