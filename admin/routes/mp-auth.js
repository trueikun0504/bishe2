/**
 * 微信小程序授权登录 API 路由
 *
 * 实现真实的微信登录，不再依赖前端传 openid
 */

const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { db } = require("../../cloudbase");
const { normalizeDoc } = require("../../init-db");

const router = express.Router();

// 从环境变量获取配置
const WECHAT_APPID = process.env.WECHAT_APPID;
const WECHAT_APPSECRET = process.env.WECHAT_APPSECRET;
const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"; // 默认7天

// 微信 API 配置
const WECHAT_API_BASE = "https://api.weixin.qq.com";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// 统一响应格式
function createResponse(success, data = null, message = "") {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

// 统一错误码
const ERROR_CODES = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  WECHAT_API_ERROR: 1001,
  USER_NOT_FOUND: 1002,
  PHONE_CODE_REQUIRED: 1003,
  INVALID_PHONE_CODE: 1004
};

// JWT 验证中间件
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(ERROR_CODES.UNAUTHORIZED).json(
      createResponse(false, null, "未提供有效的认证令牌")
    );
  }

  const token = authHeader.substring(7); // 去掉 "Bearer " 前缀

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT 验证失败:", error);
    return res.status(ERROR_CODES.UNAUTHORIZED).json(
      createResponse(false, null, "认证令牌无效或已过期")
    );
  }
};

// 调用微信 jscode2session API
function createMockSession(prefix = "mock") {
  return {
    openid: `${prefix}_openid_${Math.random().toString(36).slice(2, 10)}`,
    unionid: null,
    sessionKey: `${prefix}_session_key_${Math.random().toString(36).slice(2, 10)}`
  };
}

async function code2Session(code, options = {}) {
  console.log('WECHAT_APPID:', WECHAT_APPID, 'WECHAT_APPSECRET:', !!WECHAT_APPSECRET);
  const clientPlatform = String(options.clientPlatform || "").trim().toLowerCase();
  const allowDevtoolsMock = !IS_PRODUCTION && clientPlatform === "devtools";

  // 如果传入特殊测试 code，则直接返回模拟数据（方便本地开发）
  if (code === 'test_code_123' || code === 'mock_code') {
    console.log('使用测试 code 模拟微信登录');
    return createMockSession("mock");
  }

  // 如果没有配置微信密钥，使用模拟数据
  if (!WECHAT_APPID || !WECHAT_APPSECRET || WECHAT_APPID.includes('test') || WECHAT_APPSECRET.includes('test')) {
    console.log('使用模拟微信登录数据（未配置真实 AppID/Secret）');
    return createMockSession("mock");
  }

  try {
    const url = `${WECHAT_API_BASE}/sns/jscode2session`;
    const response = await axios.get(url, {
      params: {
        appid: WECHAT_APPID,
        secret: WECHAT_APPSECRET,
        js_code: code,
        grant_type: "authorization_code"
      },
      timeout: 10000 // 10秒超时
    });

    const data = response.data;

    if (data.errcode && data.errcode !== 0) {
      if (data.errcode === 40029 && allowDevtoolsMock) {
        console.warn("devtools wx.login code rejected by WeChat, fallback to local mock session");
        return createMockSession("devtools");
      }
      throw new Error(`微信 API 错误: ${data.errmsg || "未知错误"} (errcode: ${data.errcode})`);
    }

    return {
      openid: data.openid,
      unionid: data.unionid || null,
      sessionKey: data.session_key
    };
  } catch (error) {
    console.error("调用微信 jscode2session 失败:", error.message);
    throw new Error(`微信登录失败: ${error.message}`);
  }
}

// 解密 encryptedData (微信传统方式)
function decryptEncryptedData(sessionKey, encryptedData, iv) {
  try {
    // Base64 解码
    const sessionKeyBuffer = Buffer.from(sessionKey, 'base64')
    const encryptedDataBuffer = Buffer.from(encryptedData, 'base64')
    const ivBuffer = Buffer.from(iv, 'base64')

    // 创建解密器
    const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer)
    decipher.setAutoPadding(true)

    // 解密
    let decrypted = decipher.update(encryptedDataBuffer, 'binary', 'utf8')
    decrypted += decipher.final('utf8')

    // 解析 JSON
    const decryptedData = JSON.parse(decrypted)
    return decryptedData
  } catch (error) {
    console.error('解密 encryptedData 失败:', error)
    throw new Error(`解密用户数据失败: ${error.message}`)
  }
}

// 调用微信 getPhoneNumber API
async function getPhoneNumber(accessToken, code) {
  try {
    const url = `${WECHAT_API_BASE}/wxa/business/getuserphonenumber`;
    const response = await axios.post(url, {
      code
    }, {
      params: {
        access_token: accessToken
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.errcode && data.errcode !== 0) {
      throw new Error(`微信 API 错误: ${data.errmsg || "未知错误"} (errcode: ${data.errcode})`);
    }

    const phoneInfo = data.phone_info;
    return {
      phoneNumber: phoneInfo.phoneNumber,
      purePhoneNumber: phoneInfo.purePhoneNumber,
      countryCode: phoneInfo.countryCode,
      watermark: phoneInfo.watermark
    };
  } catch (error) {
    console.error("调用微信 getPhoneNumber 失败:", error.message);
    throw new Error(`获取手机号失败: ${error.message}`);
  }
}

// 获取微信 access_token
async function getAccessToken() {
  try {
    const url = `${WECHAT_API_BASE}/cgi-bin/token`;
    const response = await axios.get(url, {
      params: {
        grant_type: "client_credential",
        appid: WECHAT_APPID,
        secret: WECHAT_APPSECRET
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.errcode && data.errcode !== 0) {
      throw new Error(`微信 API 错误: ${data.errmsg || "未知错误"} (errcode: ${data.errcode})`);
    }

    return data.access_token;
  } catch (error) {
    console.error("获取微信 access_token 失败:", error.message);
    throw new Error(`获取 access_token 失败: ${error.message}`);
  }
}

// 查找或创建用户
async function findOrCreateUser(wechatInfo, additionalData = {}) {
  const { openid, unionid } = wechatInfo;

  if (!openid) {
    throw new Error("缺少 openid");
  }

  // 查找用户（按 openid）
  const result = await db.collection("users").where({ openid }).get();
  let user = result.data && result.data[0] ? normalizeDoc(result.data[0]) : null;

  if (user) {
    // 更新用户信息（如果 unionid 存在且用户没有 unionid）
    const updates = {};
    let needsUpdate = false;

    if (unionid && !user.unionid) {
      updates.unionid = unionid;
      needsUpdate = true;
    }

    // 更新其他字段
    for (const [key, value] of Object.entries(additionalData)) {
      if (value !== undefined && value !== null && user[key] !== value) {
        updates[key] = value;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updates.updated_at = new Date();
      await db.collection("users").doc(user._id).update(updates);
      user = { ...user, ...updates };
    }
  } else {
    // 创建新用户
    const newUser = {
      openid,
      unionid: unionid || null,
      ...additionalData,
      role: "user",
      status: "active",
      login_type: "weixin",
      created_at: new Date(),
      updated_at: new Date()
    };

    const addResult = await db.collection("users").add(newUser);
    user = normalizeDoc({
      ...newUser,
      _id: addResult.id
    });
  }

  return user;
}

// 生成 JWT token
function generateToken(user) {
  const payload = {
    sub: user._id,
    openid: user.openid,
    role: user.role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * POST /api/mp/auth/login
 * 微信登录：接收 wx.login code，服务端调用 jscode2session
 */
router.post("/login", async (req, res) => {
  console.log('收到登录请求:', req.body);
  try {
    const {
      code,
      spread_spid,
      avatar,
      nickName,
      city,
      country,
      province,
      sex,
      type,
      client_platform
    } = req.body;

    if (!code) {
      return res.status(ERROR_CODES.INVALID_REQUEST).json(
        createResponse(false, null, "缺少 code 参数")
      );
    }

    // 1. 调用微信 jscode2session 获取 openid
    const wechatInfo = await code2Session(code, {
      clientPlatform: client_platform
    });

    // 2. 查找或创建用户
    const additionalData = {};
    if (nickName) additionalData.nickname = String(nickName).trim();
    if (avatar) additionalData.avatar_url = String(avatar).trim();
    if (city) additionalData.city = String(city).trim();
    if (country) additionalData.country = String(country).trim();
    if (province) additionalData.province = String(province).trim();
    if (sex !== undefined) additionalData.gender = parseInt(sex) || 0;
    if (type) additionalData.login_type = String(type).trim();
    if (spread_spid) additionalData.spread_spid = parseInt(spread_spid) || 0;

    const user = await findOrCreateUser(wechatInfo, additionalData);

    // 3. 生成 JWT token
    const token = generateToken(user);

    // 4. 确定是登录还是注册
    const isNewUser = !user.created_at || (new Date() - new Date(user.created_at) < 5000); // 如果用户刚创建，则认为是注册
    const loginType = isNewUser ? 'register' : 'login';

    // 5. 返回响应（不返回 session_key）
    const userResponse = {
      id: user._id,
      openid: user.openid,
      unionid: user.unionid,
      nickname: user.nickname || "微信用户",
      avatar_url: user.avatar_url || "",
      role: user.role,
      status: user.status,
      created_at: user.created_at
    };

    res.json(createResponse(true, {
      user: userResponse,
      token,
      type: loginType, // 添加 type 字段：'login' 或 'register'
      expires_in: JWT_EXPIRES_IN
    }));

  } catch (error) {
    console.error("微信登录失败:", error);
    res.status(ERROR_CODES.INTERNAL_ERROR).json(
      createResponse(false, null, error.message)
    );
  }
});

/**
 * POST /api/mp/auth/phone
 * 绑定手机号：接收 getPhoneNumber code
 */
router.post("/phone", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.sub;

    if (!code) {
      return res.status(ERROR_CODES.PHONE_CODE_REQUIRED).json(
        createResponse(false, null, "缺少手机号授权 code")
      );
    }

    // 1. 获取微信 access_token
    const accessToken = await getAccessToken();

    // 2. 调用微信 getPhoneNumber API
    const phoneInfo = await getPhoneNumber(accessToken, code);

    // 3. 更新用户手机号信息
    const updates = {
      phone_number: phoneInfo.phoneNumber,
      pure_phone_number: phoneInfo.purePhoneNumber,
      country_code: phoneInfo.countryCode,
      phone_verified: true,
      phone_verified_at: new Date(),
      updated_at: new Date()
    };

    await db.collection("users").doc(userId).update(updates);

    // 4. 获取更新后的用户信息
    const userResult = await db.collection("users").doc(userId).get();
    const user = userResult.data ? normalizeDoc(userResult.data) : null;

    if (!user) {
      return res.status(ERROR_CODES.USER_NOT_FOUND).json(
        createResponse(false, null, "用户不存在")
      );
    }

    // 5. 返回响应
    const userResponse = {
      id: user._id,
      openid: user.openid,
      phone_number: user.phone_number,
      phone_verified: user.phone_verified,
      phone_verified_at: user.phone_verified_at
    };

    res.json(createResponse(true, {
      user: userResponse,
      phone_info: {
        phoneNumber: phoneInfo.phoneNumber,
        purePhoneNumber: phoneInfo.purePhoneNumber,
        countryCode: phoneInfo.countryCode
      }
    }));

  } catch (error) {
    console.error("绑定手机号失败:", error);

    const statusCode = error.message.includes("微信 API")
      ? ERROR_CODES.WECHAT_API_ERROR
      : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json(
      createResponse(false, null, error.message)
    );
  }
});

/**
 * POST /api/mp/auth/login-with-phone (传统方式)
 * 手机号快捷登录：接收 code、encryptedData、iv
 * 使用 session_key 解密获取手机号和用户信息
 */
router.post("/login-with-phone", async (req, res) => {
  try {
    const { code, encryptedData, iv } = req.body;

    if (!code || !encryptedData || !iv) {
      return res.status(ERROR_CODES.INVALID_REQUEST).json(
        createResponse(false, null, "缺少必要参数：code、encryptedData 或 iv")
      );
    }

    // 1. 调用 code2Session 获取 openid 和 session_key
    const wechatInfo = await code2Session(code);
    const { openid, sessionKey } = wechatInfo;

    // 2. 解密 encryptedData 获取手机号
    const decryptedData = decryptEncryptedData(sessionKey, encryptedData, iv);
    console.log('解密后的数据:', decryptedData);

    // 验证解密数据
    if (!decryptedData.phoneNumber) {
      throw new Error("解密数据中未找到手机号");
    }

    // 3. 查找或创建用户（使用手机号）
    // 先按 openid 查找用户
    const result = await db.collection("users").where({ openid }).get();
    let user = result.data && result.data[0] ? normalizeDoc(result.data[0]) : null;

    if (user) {
      // 更新用户手机号信息
      const updates = {
        phone_number: decryptedData.phoneNumber,
        pure_phone_number: decryptedData.purePhoneNumber || decryptedData.phoneNumber,
        country_code: decryptedData.countryCode || "86",
        phone_verified: true,
        phone_verified_at: new Date(),
        updated_at: new Date()
      };

      await db.collection("users").doc(user._id).update(updates);
      user = { ...user, ...updates };
    } else {
      // 创建新用户
      const newUser = {
        openid,
        phone_number: decryptedData.phoneNumber,
        pure_phone_number: decryptedData.purePhoneNumber || decryptedData.phoneNumber,
        country_code: decryptedData.countryCode || "86",
        nickname: `用户${decryptedData.phoneNumber.slice(-4)}`,
        avatar_url: "",
        phone_verified: true,
        phone_verified_at: new Date(),
        role: "user",
        status: "active",
        login_type: "phone",
        created_at: new Date(),
        updated_at: new Date()
      };

      const addResult = await db.collection("users").add(newUser);
      user = normalizeDoc({
        ...newUser,
        _id: addResult.id
      });
    }

    // 4. 生成 JWT token
    const token = generateToken(user);

    // 5. 返回响应
    const userResponse = {
      id: user._id,
      openid: user.openid,
      phone_number: user.phone_number,
      phone_verified: user.phone_verified,
      phone_verified_at: user.phone_verified_at,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      role: user.role,
      status: user.status,
      created_at: user.created_at
    };

    res.json(createResponse(true, {
      user: userResponse,
      token,
      expires_in: JWT_EXPIRES_IN
    }));

  } catch (error) {
    console.error("手机号快捷登录失败:", error);
    res.status(ERROR_CODES.INTERNAL_ERROR).json(
      createResponse(false, null, error.message)
    );
  }
});

/**
 * GET /api/mp/auth/me
 * 获取当前用户信息
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;

    const userResult = await db.collection("users").doc(userId).get();
    const user = userResult.data ? normalizeDoc(userResult.data) : null;

    if (!user) {
      return res.status(ERROR_CODES.USER_NOT_FOUND).json(
        createResponse(false, null, "用户不存在")
      );
    }

    // 过滤敏感信息
    const userResponse = {
      id: user._id,
      openid: user.openid,
      unionid: user.unionid,
      nickname: user.nickname || "微信用户",
      avatar_url: user.avatar_url || "",
      phone_number: user.phone_number || "",
      phone_verified: user.phone_verified || false,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    res.json(createResponse(true, userResponse));

  } catch (error) {
    console.error("获取用户信息失败:", error);
    res.status(ERROR_CODES.INTERNAL_ERROR).json(
      createResponse(false, null, "获取用户信息失败")
    );
  }
});

module.exports = {
  router,
  authMiddleware,
  ERROR_CODES
};
