jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

jest.mock("../../models/user.model", () => ({
  findById: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const User = require("../../models/user.model");
const protect = require("../auth.middleware");

const buildRes = () => ({});
const buildNext = () => jest.fn();

describe("auth.middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = { headers: { authorization: "Bearer tkn" } };
    const next = buildNext();

    await protect(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next without error when token and user are valid", async () => {
    jwt.verify.mockReturnValue({ userId: "u1", tokenType: "access" });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "u1" }) });
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
});
