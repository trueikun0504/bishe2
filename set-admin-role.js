/**
 * Promote an existing user to admin by openid/open_id or _id.
 *
 * Usage:
 *   node set-admin-role.js --open-id <openId>
 *   node set-admin-role.js --user-id <userId>
 */

const { db, env, hasStaticCredentials } = require("./cloudbase");
const { normalizeDoc } = require("./init-db");

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}

function getOpenId(user) {
  return user.openid || user.open_id || "";
}

async function findUser({ openId, userId }) {
  if (userId) {
    const result = await db.collection("users").doc(userId).get();
    const docs = Array.isArray(result.data) ? result.data : [result.data];
    return docs.map(normalizeDoc).find(Boolean) || null;
  }

  const result = await db.collection("users").limit(100).get();
  const users = (result.data || []).map(normalizeDoc);
  return users.find((user) => getOpenId(user) === openId) || null;
}

async function main() {
  const openId = readArg("--open-id");
  const userId = readArg("--user-id");

  if (!openId && !userId) {
    console.error("Usage: node set-admin-role.js --open-id <openId>");
    console.error("   or: node set-admin-role.js --user-id <userId>");
    process.exit(1);
  }

  console.log(`Connecting to CloudBase env: ${env}`);
  console.log(`Credential mode: ${hasStaticCredentials ? "static" : "runtime"}`);

  const user = await findUser({ openId, userId });

  if (!user) {
    console.error("Target user not found.");
    process.exit(1);
  }

  await db.collection("users").doc(user._id).update({
    role: "admin",
    status: user.status || "active",
    updated_at: new Date(),
  });

  console.log(`User promoted to admin: ${user._id}`);
  console.log(`OpenID: ${getOpenId(user) || "(missing)"}`);
}

main().catch((error) => {
  console.error("Promote failed:", error);
  process.exit(1);
});
