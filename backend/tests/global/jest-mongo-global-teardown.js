/**
 * Shuts down the Jest replica set (graceful shutdown, then port cleanup fallback).
 */
const fs = require("fs");
const path = require("path");

const uriFile = path.join(__dirname, "..", ".mongo-jest-uri");

module.exports = async () => {
  if (process.env.USE_EXTERNAL_MONGO === "true") return;
  if (!fs.existsSync(uriFile)) return;

  const uri = fs.readFileSync(uriFile, "utf8").trim();

  try {
    const { MongoClient } = require("mongodb");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    try {
      await client.db("admin").command({ shutdown: 1, force: true });
    } catch {
      /* already shutting down */
    }
    await client.close().catch(() => {});
  } catch {
    /* ignore */
  }

  const m = uri.match(/127\.0\.0\.1:(\d+)/) || uri.match(/localhost:(\d+)/);
  if (m) {
    try {
      const killPort = require("kill-port");
      await killPort(Number(m[1]), "tcp");
    } catch {
      /* ignore */
    }
  }

  try {
    fs.unlinkSync(uriFile);
  } catch {
    /* ignore */
  }
};
