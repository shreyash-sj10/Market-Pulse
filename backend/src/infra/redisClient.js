const { Redis } = require("@upstash/redis");
const logger = require("../utils/logger");
const { setRedisDown, setRedisUp } = require("./redisHealth");

const FALLBACK_MODE = "DEGRADED_SYNC_FALLBACK";
const USE_REDIS = String(process.env.USE_REDIS || "").toLowerCase() === "true";

let singleton = null;
let initialized = false;
let initPromise = null;

const parseSetOptions = (args) => {
  if (!args || args.length === 0) return null;
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
    return args[0];
  }
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = String(args[i] || "").toUpperCase();
    if (token === "NX") options.nx = true;
    else if (token === "XX") options.xx = true;
    else if (token === "EX") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v)) options.ex = v;
      i += 1;
    } else if (token === "PX") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v)) options.px = v;
      i += 1;
    }
  }
  return Object.keys(options).length > 0 ? options : null;
};

const buildClientFacade = (raw) => ({
  status: "ready",
  mode: "upstash-rest",
  supportsBullMQ: false,
  supportsRateLimitStore: false,
  async get(key) {
    return raw.get(key);
  },
  async del(...keys) {
    return raw.del(...keys);
  },
  async incr(key) {
    return raw.incr(key);
  },
  async expire(key, seconds) {
    return raw.expire(key, seconds);
  },
  async ping() {
    return raw.ping();
  },
  async set(key, value, ...args) {
    const options = parseSetOptions(args);
    if (!options) {
      return raw.set(key, value);
    }
    return raw.set(key, value, options);
  },
  /**
   * Compatibility hook for rate-limit-redis. Upstash REST does not guarantee
   * full command parity for script-heavy stores, so this is intentionally best-effort.
   */
  async call(command, ...args) {
    const cmd = String(command || "").toUpperCase();
    if (cmd === "PING") return raw.ping();
    if (cmd === "GET") return raw.get(args[0]);
    if (cmd === "DEL") return raw.del(...args);
    if (cmd === "INCR") return raw.incr(args[0]);
    if (cmd === "EXPIRE") return raw.expire(args[0], Number(args[1]));
    if (cmd === "SET") {
      const [key, value, ...rest] = args;
      return this.set(key, value, ...rest);
    }
    throw new Error(`REDIS_COMMAND_UNSUPPORTED:${cmd}`);
  },
});

const runHealthCheck = async (client) => {
  const testKey = `health:redis:${Date.now()}`;
  try {
    await client.set(testKey, "1", "EX", 10);
    const val = await client.get(testKey);
    await client.del(testKey);
    if (String(val) !== "1") {
      throw new Error("HEALTHCHECK_VALUE_MISMATCH");
    }
    setRedisUp();
    logger.info("Redis connected successfully (Upstash REST).");
    return true;
  } catch (error) {
    setRedisDown();
    logger.warn(
      `Redis health check failed (${error?.message || "UNKNOWN"}). Fallback mode=${FALLBACK_MODE}`
    );
    return false;
  }
};

const initialize = async () => {
  if (initialized) return singleton;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!USE_REDIS) {
      setRedisDown();
      logger.info(`Redis disabled via USE_REDIS=false — Fallback mode=${FALLBACK_MODE}.`);
      singleton = null;
      return singleton;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      setRedisDown();
      logger.warn(
        `Redis credentials missing (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Fallback mode=${FALLBACK_MODE}`
      );
      singleton = null;
      return singleton;
    }

    try {
      const raw = new Redis({ url, token, automaticDeserialization: false });
      const facade = buildClientFacade(raw);
      const ok = await runHealthCheck(facade);
      singleton = ok ? facade : null;
    } catch (error) {
      setRedisDown();
      logger.warn(
        `Redis initialization failed (${error?.message || "UNKNOWN"}). Fallback mode=${FALLBACK_MODE}`
      );
      singleton = null;
    }

    return singleton;
  })();

  try {
    return await initPromise;
  } finally {
    initialized = true;
    initPromise = null;
  }
};

const redisClient = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "status") {
        return singleton ? "ready" : "down";
      }
      if (prop === "supportsBullMQ") {
        return Boolean(singleton && singleton.supportsBullMQ);
      }
      if (prop === "supportsRateLimitStore") {
        return Boolean(singleton && singleton.supportsRateLimitStore);
      }
      if (prop === "init") {
        return initialize;
      }
      if (!singleton) return undefined;
      const value = singleton[prop];
      return typeof value === "function" ? value.bind(singleton) : value;
    },
  }
);

setRedisDown();

initialize().catch(() => {
  setRedisDown();
  singleton = null;
});

module.exports = redisClient;
