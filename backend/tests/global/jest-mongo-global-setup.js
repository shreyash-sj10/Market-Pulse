/**
 * Starts a one-node replica set (required for Mongoose multi-document transactions).
 * Skips when USE_EXTERNAL_MONGO=true (tests use MONGO_URI from your .env).
 */
const fs = require("fs");
const path = require("path");

const uriFile = path.join(__dirname, "..", ".mongo-jest-uri");

module.exports = async () => {
  if (process.env.USE_EXTERNAL_MONGO === "true") {
    if (fs.existsSync(uriFile)) fs.unlinkSync(uriFile);
    return;
  }

  process.env.MONGOMS_DOWNLOAD_TIMEOUT =
    process.env.MONGOMS_DOWNLOAD_TIMEOUT || String(120 * 1000);

  const { MongoMemoryReplSet } = require("mongodb-memory-server");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: "jest-rs" },
  });
  fs.writeFileSync(uriFile, replSet.getUri(), "utf8");
};
