const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");

const { db } = require("../../cloudbase");
const { normalizeDoc } = require("../../init-db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const USER_DEFAULT_PASSWORD = process.env.USER_DEFAULT_PASSWORD || "user123";

function response(success, data = null, message = "") {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

function getOpenid(user) {
  return user?.openid || user?.open_id || "";
}

function exposeUser(user) {
  return {
    id: user._id || user.id,
    account: user.username || user.account || user.phone_number || getOpenid(user),
    openid: getOpenid(user),
    nickname: user.nickname || "本地用户",
    avatar_url: user.avatar_url || "",
    role: user.role || "user",
    status: user.status || "active",
    phone_number: user.phone_number || "",
    phone_verified: Boolean(user.phone_verified),
    created_at: user.created_at || null,
    updated_at: user.updated_at || null,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id || user.id,
      openid: getOpenid(user),
      role: user.role || "user",
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

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

function isStaffRole(role) {
  return role === "admin" || role === "customer_service";
}

async function findUserByOpenid(openid) {
  const value = String(openid || "").trim();
  if (!value) {
    return null;
  }

  const result = await db.collection("users").where({ openid: value }).limit(1).get();
  return result.data?.[0] ? normalizeDoc(result.data[0]) : null;
}

async function findUserByAccount(account) {
  const value = String(account || "").trim();
  if (!value) {
    return null;
  }

  const result = await db.collection("users").limit(500).get();
  const users = (result.data || []).map(normalizeDoc);

  return (
    users.find((user) => {
      const candidates = [
        user.username,
        user.account,
        user.phone_number,
        user.openid,
        user.open_id,
        user.id,
        user._id,
      ]
        .filter(Boolean)
        .map((item) => String(item));

      return candidates.includes(value);
    }) || null
  );
}

router.post("/auth/login", async (req, res) => {
  try {
    const account = String(req.body?.account || req.body?.username || req.body?.openid || "").trim();
    const password = String(req.body?.password || "").trim();
    const openid = String(req.body?.openid || "").trim();
    const nickname = String(req.body?.nickname || "").trim();
    const avatarUrl = String(req.body?.avatar_url || "").trim();
    const now = Date.now();

    if (password) {
      if (!account) {
        return res.status(400).json(response(false, null, "账号不能为空"));
      }

      let user = await findUserByAccount(account);

      if (user) {
        if (isStaffRole(user.role)) {
          return res.status(403).json(response(false, null, "该账号请使用后台入口登录"));
        }

        if ((user.status || "active") === "disabled") {
          return res.status(403).json(response(false, null, "当前账号已被禁用"));
        }

        if (user.password_hash && user.password_salt) {
          if (!verifyPassword(password, user)) {
            return res.status(401).json(response(false, null, "账号或密码错误"));
          }
        } else if (password !== USER_DEFAULT_PASSWORD) {
          return res.status(401).json(
            response(false, null, `旧测试账号默认密码为 ${USER_DEFAULT_PASSWORD}`),
          );
        }

        const updates = {
          updated_at: now,
        };

        if (!user.password_hash || !user.password_salt) {
          Object.assign(updates, buildPasswordFields(password));
        }
        if (!user.username) {
          updates.username = account;
        }
        if (!user.account) {
          updates.account = account;
        }
        if (!getOpenid(user)) {
          updates.openid = account;
          updates.open_id = account;
        }
        if (nickname && nickname !== user.nickname) {
          updates.nickname = nickname;
        }
        if (avatarUrl && avatarUrl !== user.avatar_url) {
          updates.avatar_url = avatarUrl;
        }

        if (Object.keys(updates).length > 1) {
          await db.collection("users").doc(user._id).update(updates);
          user = { ...user, ...updates };
        }

        const token = signToken(user);
        return res.json(
          response(true, {
            token,
            expires_in: JWT_EXPIRES_IN,
            user: exposeUser(user),
          }),
        );
      }

      const payload = {
        id: `user-${account}`,
        account,
        username: account,
        openid: account,
        open_id: account,
        nickname: nickname || `用户-${account.slice(-6) || account}`,
        avatar_url: avatarUrl,
        role: "user",
        status: "active",
        login_type: "web_password",
        ...buildPasswordFields(password),
        created_at: now,
        updated_at: now,
      };
      const addResult = await db.collection("users").add(payload);
      const createdUser = normalizeDoc({ ...payload, _id: addResult.id });
      const token = signToken(createdUser);

      return res.json(
        response(true, {
          token,
          expires_in: JWT_EXPIRES_IN,
          user: exposeUser(createdUser),
        }),
      );
    }

    if (!openid) {
      return res.status(400).json(response(false, null, "账号不能为空"));
    }

    let user = await findUserByOpenid(openid);

    if (user) {
      if (isStaffRole(user.role)) {
        return res.status(403).json(response(false, null, "该账号请使用后台入口登录"));
      }

      if ((user.status || "active") === "disabled") {
        return res.status(403).json(response(false, null, "当前账号已被禁用"));
      }

      const updates = {};
      if (!user.username) {
        updates.username = openid;
      }
      if (!user.account) {
        updates.account = openid;
      }
      if (nickname && nickname !== user.nickname) {
        updates.nickname = nickname;
      }
      if (avatarUrl && avatarUrl !== user.avatar_url) {
        updates.avatar_url = avatarUrl;
      }
      if (Object.keys(updates).length) {
        updates.updated_at = now;
        await db.collection("users").doc(user._id).update(updates);
        user = { ...user, ...updates };
      }
    } else {
      const payload = {
        id: `user-${openid}`,
        account: openid,
        username: openid,
        openid,
        open_id: openid,
        nickname: nickname || `用户-${openid.slice(-6)}`,
        avatar_url: avatarUrl,
        role: "user",
        status: "active",
        login_type: "web",
        created_at: now,
        updated_at: now,
      };
      const addResult = await db.collection("users").add(payload);
      user = normalizeDoc({ ...payload, _id: addResult.id });
    }

    const token = signToken(user);
    return res.json(
      response(true, {
        token,
        expires_in: JWT_EXPIRES_IN,
        user: exposeUser(user),
      }),
    );
  } catch (error) {
    console.error("Web auth login failed:", error);
    return res.status(500).json(response(false, null, "登录失败，请稍后重试"));
  }
});

module.exports = {
  router,
};
