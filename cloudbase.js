const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const cloudbase = require("@cloudbase/node-sdk");

const env = process.env.CLOUDBASE_ENV;
const secretId = process.env.TENCENT_SECRET_ID || process.env.SECRET_ID || "";
const secretKey = process.env.TENCENT_SECRET_KEY || process.env.SECRET_KEY || "";

if (!env) {
  throw new Error("Missing CLOUDBASE_ENV");
}

const initConfig = { env };

if (secretId && secretKey) {
  initConfig.secretId = secretId;
  initConfig.secretKey = secretKey;
}

const app = cloudbase.init(initConfig);
const db = app.database();

module.exports = {
  app,
  db,
  env,
  hasStaticCredentials: Boolean(secretId && secretKey),
};
