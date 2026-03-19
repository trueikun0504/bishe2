const crypto = require("crypto");

const USER_DEFAULT_PASSWORD = process.env.USER_DEFAULT_PASSWORD || "user123";

function createPasswordSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 100000, 64, "sha512").toString("hex");
}

function buildPasswordFields(password) {
  const password_salt = createPasswordSalt();
  return {
    password_salt,
    password_hash: hashPassword(password, password_salt),
  };
}

function verifyPassword(password, user) {
  const passwordHash = String(user?.password_hash || "");
  const passwordSalt = String(user?.password_salt || "");
  if (!passwordHash || !passwordSalt) {
    return false;
  }

  const inputHash = hashPassword(password, passwordSalt);
  if (inputHash.length !== passwordHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(passwordHash, "hex"));
}

function verifyPasswordOrDefault(password, user, legacyPassword = USER_DEFAULT_PASSWORD) {
  if (user?.password_hash && user?.password_salt) {
    return verifyPassword(password, user);
  }

  return String(password || "") === String(legacyPassword || "");
}

module.exports = {
  USER_DEFAULT_PASSWORD,
  createPasswordSalt,
  hashPassword,
  buildPasswordFields,
  verifyPassword,
  verifyPasswordOrDefault,
};
