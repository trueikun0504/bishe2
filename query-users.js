/**
 * Query CloudBase users and print the current admin-ready accounts.
 */

const { db, env, hasStaticCredentials } = require("./cloudbase");
const { normalizeDoc } = require("./init-db");

function getOpenId(user) {
  return user.openid || user.open_id || "(missing)";
}

async function queryUsers() {
  try {
    console.log(`Connecting to CloudBase env: ${env}`);
    console.log(`Credential mode: ${hasStaticCredentials ? "static" : "runtime"}`);

    const result = await db.collection("users").limit(100).get();
    const users = (result.data || []).map(normalizeDoc);

    if (users.length === 0) {
      console.log("No records found in the users collection.");
      return;
    }

    console.log(`Found ${users.length} users:\n`);

    users.forEach((user, index) => {
      console.log(`--- User ${index + 1} ---`);
      console.log(`OpenID: ${getOpenId(user)}`);
      console.log(`Nickname: ${user.nickname || "(missing)"}`);
      console.log(`Role: ${user.role || "user"}`);
      console.log(`Status: ${user.status || "(missing)"}`);
      console.log(`ID: ${user._id}`);
      console.log();
    });

    console.log("Use a users document with role=admin to log into the admin panel.");
  } catch (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
}

queryUsers();
