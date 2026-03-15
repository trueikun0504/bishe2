/**
 * Web user API routes.
 *
 * Purpose:
 * - Replace mini-program-only user flows with browser-accessible APIs
 * - Provide auth, listing browsing/publishing, and messaging endpoints
 */

const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { app, db } = require("../../cloudbase");
const { normalizeDoc } = require("../../init-db");
const { districts: DISTRICT_SEED } = require("../../data/china-districts.generated");
const { webSocketHub } = require("../websocket");

const router = express.Router();

// 鍥剧墖涓婁紶閰嶇疆
const uploadDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "image-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const extPattern = /\.(jpeg|jpg|jfif|pjp|png|webp|gif)$/i;
  const mimePattern = /(jpeg|jpg|pjpeg|png|webp|gif)/i;
  const extname = extPattern.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimePattern.test(file.mimetype || "");
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("浠呮敮鎸佸浘鐗囨牸寮忥細jpeg, jpg, png, webp, gif"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const USER_DEFAULT_PASSWORD = process.env.USER_DEFAULT_PASSWORD || "user123";
const DISTRICT_BATCH_SIZE = 500;

function response(success, data = null, message = "") {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

function getDocId(doc) {
  return doc?.id || doc?._id || "";
}

function normalizeSingleDoc(maybeDocOrArray) {
  if (Array.isArray(maybeDocOrArray)) {
    if (!maybeDocOrArray[0]) {
      return null;
    }
    return normalizeDoc(maybeDocOrArray[0]);
  }
  if (maybeDocOrArray && typeof maybeDocOrArray === "object") {
    return normalizeDoc(maybeDocOrArray);
  }
  return null;
}

function getOpenid(user) {
  return user?.openid || user?.open_id || "";
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePage(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parsePageSize(value, fallback = 20) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), 100);
}

function normalizeIdList(items = []) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
}

function chunkArray(items = [], size = 100) {
  const list = Array.isArray(items) ? items : [];
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

function isCollectionMissingError(error) {
  const message = String(error?.message || error?.errMsg || "");
  const code = String(error?.code || error?.errCode || "");
  return (
    message.includes("Db or Table not exist") ||
    message.includes("DATABASE_COLLECTION_NOT_EXIST") ||
    code.includes("DATABASE_COLLECTION_NOT_EXIST")
  );
}

function sortDistrictRecords(items = []) {
  return [...items].sort(
    (a, b) =>
      Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
      String(a.code || "").localeCompare(String(b.code || "")),
  );
}

function mergeDistrictsWithSeed(items = []) {
  const merged = new Map(
    DISTRICT_SEED.map((item) => [String(item.code || "").trim(), { ...item }]),
  );

  for (const rawItem of items) {
    const item = normalizeDoc(rawItem);
    const code = String(item?.code || "").trim();
    if (!code) {
      continue;
    }
    if (item.is_active === false) {
      merged.delete(code);
      continue;
    }
    merged.set(code, {
      ...(merged.get(code) || {}),
      ...item,
      code,
    });
  }

  return sortDistrictRecords(
    Array.from(merged.values()).filter((item) => item && item.is_active !== false),
  );
}

async function listAllCollectionDocs(collectionName, batchSize = 100) {
  const items = [];

  for (let skip = 0; ; skip += batchSize) {
    const result = await db.collection(collectionName).skip(skip).limit(batchSize).get();
    const docs = (result.data || []).map(normalizeDoc);
    if (!docs.length) {
      break;
    }
    items.push(...docs);
    if (docs.length < batchSize) {
      break;
    }
  }

  return items;
}

async function listAllDistricts() {
  try {
    const docs = await listAllCollectionDocs("districts", DISTRICT_BATCH_SIZE);
    return mergeDistrictsWithSeed(docs);
  } catch (error) {
    if (isCollectionMissingError(error)) {
      return mergeDistrictsWithSeed([]);
    }
    throw error;
  }
}

function exposeUser(user) {
  return {
    id: user._id || user.id,
    account: user.username || user.account || user.phone_number || getOpenid(user),
    openid: getOpenid(user),
    nickname: user.nickname || "鏈湴鐢ㄦ埛",
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
  const result = await db.collection("users").where({ openid }).limit(1).get();
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

async function findConversationByAnyId(conversationId) {
  const value = String(conversationId || "").trim();
  if (!value) {
    return null;
  }

  const byId = await db.collection("conversations").where({ id: value }).limit(1).get();
  if (byId.data?.[0]) {
    return normalizeDoc(byId.data[0]);
  }

  try {
    const raw = await db.collection("conversations").doc(value).get();
    const parsed = normalizeSingleDoc(raw?.data);
    if (parsed) {
      return parsed;
    }
  } catch (error) {
    // no-op
  }

  return null;
}

async function findListingByAnyId(listingId) {
  const value = String(listingId || "").trim();
  if (!value) {
    return null;
  }

  const byId = await db.collection("listings").where({ id: value }).limit(1).get();
  if (byId.data?.[0]) {
    return normalizeDoc(byId.data[0]);
  }

  try {
    const raw = await db.collection("listings").doc(value).get();
    const parsed = normalizeSingleDoc(raw?.data);
    if (parsed) {
      return parsed;
    }
  } catch (error) {
    // no-op
  }

  return null;
}

async function findOrderByAnyId(orderId) {
  const value = String(orderId || "").trim();
  if (!value) {
    return null;
  }

  const byOrderId = await db.collection("orders").where({ order_id: value }).limit(1).get();
  if (byOrderId.data?.[0]) {
    return normalizeDoc(byOrderId.data[0]);
  }

  try {
    const raw = await db.collection("orders").doc(value).get();
    const parsed = normalizeSingleDoc(raw?.data);
    if (parsed) {
      return parsed;
    }
  } catch (error) {
    // no-op
  }

  return null;
}

async function createOrder(listingId, buyerOpenid, sellerOpenid) {
  try {
    const listing = await findListingByAnyId(listingId);
    if (!listing) {
      throw new Error("鍟嗗搧涓嶅瓨鍦?");
    }

    if (listing.status !== "approved") {
      throw new Error("鍟嗗搧鏈€氳繃瀹℃牳锛屾棤娉曚笅鍗?");
    }

    const orderId = createId("order");
    const now = Date.now();
    const orderPayload = {
      order_id: orderId,
      listing_id: getDocId(listing),
      title: listing.title || "",
      price: Number(listing.price || 0),
      status: "pending", // pending, paid, completed, cancelled
      buyer_openid: buyerOpenid,
      seller_openid: sellerOpenid,
      created_at: now,
      updated_at: now,
    };

    console.log("[createOrder] 鍑嗗娣诲姞璁㈠崟鍒版暟鎹簱:", orderPayload);
    const addResult = await db.collection("orders").add(orderPayload);
    console.log("[createOrder] 璁㈠崟鍒涘缓鎴愬姛锛孖D:", addResult.id);
    return normalizeDoc({ ...orderPayload, _id: addResult.id });
  } catch (error) {
    console.error("[createOrder] 閿欒:", error.message || error);
    throw error;
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json(response(false, null, "未提供有效令牌"));
  }

  const token = authHeader.slice(7);
  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json(response(false, null, "鐧诲綍鐘舵€佹棤鏁堟垨宸茶繃鏈?"));
  }

  const userId = String(payload.sub || "").trim();
  if (!userId) {
    return res.status(401).json(response(false, null, "鐧诲綍鐘舵€佹棤鏁?"));
  }

  let user = null;

  try {
    const raw = await db.collection("users").doc(userId).get();
    const parsed = normalizeSingleDoc(raw?.data);
    if (parsed) {
      user = parsed;
    }
  } catch (error) {
    user = null;
  }

  if (!user) {
    const openid = String(payload.openid || "").trim();
    if (openid) {
      user = await findUserByOpenid(openid);
    }
  }

  if (!user) {
    return res.status(401).json(response(false, null, "鐢ㄦ埛涓嶅瓨鍦ㄦ垨宸插け鏁?"));
  }

  if ((user.status || "active") === "disabled") {
    return res.status(403).json(response(false, null, "璐﹀彿宸茶绂佺敤"));
  }

  req.auth = {
    token,
    payload,
    user,
    userId: user._id || user.id,
    openid: getOpenid(user),
  };
  next();
}

async function readUserFavoriteListingIds(userId) {
  const value = String(userId || "").trim();
  if (!value) {
    return [];
  }

  try {
    const raw = await db.collection("users").doc(value).get();
    const user = normalizeSingleDoc(raw?.data);
    return normalizeIdList(user?.favorite_listing_ids);
  } catch (error) {
    return [];
  }
}

async function writeUserFavoriteListingIds(userId, listingIds = []) {
  const value = String(userId || "").trim();
  if (!value) {
    return;
  }

  try {
    await db.collection("users").doc(value).update({
      favorite_listing_ids: normalizeIdList(listingIds),
      updated_at: Date.now(),
    });
  } catch (error) {
    console.warn("Write user favorite ids failed:", error?.message || error);
  }
}

async function readFavoriteListingIds(openid, userId) {
  const openidValue = String(openid || "").trim();
  if (!openidValue) {
    return [];
  }

  const fallbackIds = await readUserFavoriteListingIds(userId);
  try {
    const result = await db
      .collection("favorites")
      .where({ openid: openidValue })
      .limit(500)
      .get();
    const collectionIds = normalizeIdList(
      (result.data || [])
        .map(normalizeDoc)
        .map((item) => item.listing_id),
    );

    const merged = normalizeIdList([...fallbackIds, ...collectionIds]);
    if (userId) {
      await writeUserFavoriteListingIds(userId, merged);
    }
    return merged;
  } catch (error) {
    if (isCollectionMissingError(error)) {
      return fallbackIds;
    }
    throw error;
  }
}

async function isListingFavorited(openid, userId, listingId) {
  const target = String(listingId || "").trim();
  if (!target) {
    return false;
  }
  const ids = await readFavoriteListingIds(openid, userId);
  return ids.includes(target);
}

async function toggleFavoriteState(openid, userId, listingId) {
  const openidValue = String(openid || "").trim();
  const target = String(listingId || "").trim();
  if (!openidValue || !target) {
    return false;
  }

  const currentIds = await readFavoriteListingIds(openidValue, userId);
  const alreadyFavorited = currentIds.includes(target);
  const nextFavorited = !alreadyFavorited;
  const nextIds = nextFavorited
    ? normalizeIdList([...currentIds, target])
    : currentIds.filter((item) => item !== target);

  await writeUserFavoriteListingIds(userId, nextIds);

  try {
    const existing = await db
      .collection("favorites")
      .where({ openid: openidValue, listing_id: target })
      .limit(1)
      .get();

    if (existing.data?.[0]) {
      if (!nextFavorited) {
        await db.collection("favorites").doc(existing.data[0]._id).remove();
      }
    } else if (nextFavorited) {
      await db.collection("favorites").add({
        data: {
          id: createId("favorite"),
          openid: openidValue,
          listing_id: target,
          created_at: Date.now(),
        },
      });
    }
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      console.warn("Sync favorites collection failed:", error?.message || error);
    }
  }

  return nextFavorited;
}

async function listDistrictMap() {
  const districts = await listAllDistricts();
  return new Map(districts.map((item) => [item.code, item]));
}

function getListingDistrictInfo(listing, districtMap) {
  const districtCode = String(listing?.district_code || "").trim();
  return districtCode ? districtMap.get(districtCode) || null : null;
}

async function listUsersMapByOpenids(openids) {
  const values = Array.from(new Set((openids || []).filter(Boolean)));
  if (!values.length) {
    return new Map();
  }

  const command = db.command;
  const result = await db
    .collection("users")
    .where({ openid: command.in(values) })
    .limit(Math.max(50, values.length * 2))
    .get();
  const users = (result.data || []).map(normalizeDoc);
  return new Map(users.map((item) => [getOpenid(item), item]));
}

async function enrichListing(listing, districtMap, usersMap) {
  const docId = getDocId(listing);
  const openid = getOpenid(listing);
  const district = getListingDistrictInfo(listing, districtMap);
  const seller = usersMap.get(openid);

  let imageUrls = Array.isArray(listing.image_urls) ? listing.image_urls.filter(Boolean) : [];
  if (!imageUrls.length && listing.cover_image_url) {
    imageUrls = [listing.cover_image_url];
  }

  if (!imageUrls.length) {
    const imageResult = await db
      .collection("listing_images")
      .where({ listing_id: docId })
      .limit(20)
      .get();
    imageUrls = (imageResult.data || [])
      .map(normalizeDoc)
      .sort((a, b) => Number(a.order || a.sort_order || 0) - Number(b.order || b.sort_order || 0))
      .map((item) => item.image_url)
      .filter(Boolean);
  }

  return {
    ...listing,
    id: docId,
    listing_type: listing.listing_type === "wanted" ? "wanted" : "sale",
    openid,
    image_urls: imageUrls,
    seller_nickname: seller?.nickname || "鏈湴鍗栧",
    seller_avatar_url: seller?.avatar_url || "",
    district_name: district?.name || listing.district_code || "",
    city_name: district?.city_name || listing.city_name || "",
    city_code: district?.city_code || listing.city_code || "",
    province_name: district?.province_name || listing.province_name || "",
    province_code: district?.province_code || listing.province_code || "",
    district_type: district?.district_type || listing.district_type || "",
    district_type_label: district?.district_type_label || listing.district_type_label || "",
  };
}

function tryParseToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

router.post("/auth/login", async (req, res) => {
  try {
    const openid = String(req.body?.openid || "").trim();
    const account = String(req.body?.account || "").trim();
    const password = String(req.body?.password || "").trim();
    const nickname = String(req.body?.nickname || "").trim();
    const avatarUrl = String(req.body?.avatar_url || "").trim();

    // 瀵嗙爜鐧诲綍妯″紡
    if (password) {
      const loginAccount = account || openid;
      if (!loginAccount) {
        return res.status(400).json(response(false, null, "璐﹀彿涓嶈兘涓虹┖"));
      }

      const user = await findUserByAccount(loginAccount);
      if (!user) {
        return res.status(401).json(response(false, null, "璐﹀彿鎴栧瘑鐮侀敊璇?"));
      }

      if ((user.status || "active") === "disabled") {
        return res.status(403).json(response(false, null, "褰撳墠璐﹀彿宸茶绂佺敤"));
      }

      // 楠岃瘉瀵嗙爜
      const passwordValid = verifyPassword(password, user);
      if (!passwordValid) {
        return res.status(401).json(response(false, null, "璐﹀彿鎴栧瘑鐮侀敊璇?"));
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

    // OpenID 登录模式（原有逻辑）
    if (!openid) {
      return res.status(400).json(response(false, null, "openid 不能为空"));
    }
    let user = await findUserByOpenid(openid);
    const now = Date.now();

    if (user) {
      if ((user.status || "active") === "disabled") {
        return res.status(403).json(response(false, null, "褰撳墠璐﹀彿宸茶绂佺敤"));
      }

      const updates = {};
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
        openid,
        open_id: openid,
        nickname: nickname || `鐢ㄦ埛-${openid.slice(-6)}`,
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
    console.error("Web login failed:", error);
    return res.status(500).json(response(false, null, "鐧诲綍澶辫触锛岃绋嶅悗閲嶈瘯"));
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    const nickname = String(req.body?.nickname || "").trim();
    const avatarUrl = String(req.body?.avatar_url || "").trim();

    if (!username) {
      return res.status(400).json(response(false, null, "鐢ㄦ埛鍚嶄笉鑳戒负绌?"));
    }
    if (!password) {
      return res.status(400).json(response(false, null, "瀵嗙爜涓嶈兘涓虹┖"));
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json(response(false, null, "鐢ㄦ埛鍚嶉暱搴﹂渶鍦?-30瀛楃涔嬮棿"));
    }
    if (password.length < 6) {
      return res.status(400).json(response(false, null, "瀵嗙爜闀垮害鑷冲皯6浣?"));
    }

    // 妫€鏌ョ敤鎴峰悕鏄惁宸插瓨鍦?    const existingUser = await findUserByAccount(username);
    if (existingUser) {
      return res.status(400).json(response(false, null, "鐢ㄦ埛鍚嶅凡琚娇鐢?"));
    }

    const now = Date.now();
    const { password_hash, password_salt } = buildPasswordFields(password);
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      id: userId,
      openid: userId, // 涓哄熀浜庡瘑鐮佺殑鐢ㄦ埛鐢熸垚 openid
      open_id: userId,
      username,
      nickname: nickname || `鐢ㄦ埛${username}`,
      avatar_url: avatarUrl,
      role: "user",
      status: "active",
      login_type: "web",
      password_hash,
      password_salt,
      created_at: now,
      updated_at: now,
    };

    const addResult = await db.collection("users").add(payload);
    const user = normalizeDoc({ ...payload, _id: addResult.id });

    const token = signToken(user);
    return res.json(
      response(true, {
        token,
        expires_in: JWT_EXPIRES_IN,
        user: exposeUser(user),
      }, "娉ㄥ唽鎴愬姛"),
    );
  } catch (error) {
    console.error("Web register failed:", error);
    return res.status(500).json(response(false, null, "娉ㄥ唽澶辫触锛岃绋嶅悗閲嶈瘯"));
  }
});

router.post("/auth/login-with-password", async (req, res) => {
  try {
    const account = String(req.body?.account || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!account) {
      return res.status(400).json(response(false, null, "璐﹀彿涓嶈兘涓虹┖"));
    }
    if (!password) {
      return res.status(400).json(response(false, null, "瀵嗙爜涓嶈兘涓虹┖"));
    }

    const user = await findUserByAccount(account);
    if (!user) {
      return res.status(401).json(response(false, null, "璐﹀彿鎴栧瘑鐮侀敊璇?"));
    }

    if ((user.status || "active") === "disabled") {
      return res.status(403).json(response(false, null, "褰撳墠璐﹀彿宸茶绂佺敤"));
    }

    // 楠岃瘉瀵嗙爜
    const passwordValid = verifyPassword(password, user);
    if (!passwordValid) {
      return res.status(401).json(response(false, null, "璐﹀彿鎴栧瘑鐮侀敊璇?"));
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
    console.error("Password login failed:", error);
    return res.status(500).json(response(false, null, "鐧诲綍澶辫触锛岃绋嶅悗閲嶈瘯"));
  }
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  return res.json(response(true, exposeUser(req.auth.user)));
});

router.get("/districts", async (req, res) => {
  try {
    const items = (await listAllDistricts())
      .map((item) => ({
        code: item.code,
        name: item.name,
        city_code: item.city_code,
        city_name: item.city_name,
        province_code: item.province_code,
        province_name: item.province_name,
        district_type: item.district_type || "",
        district_type_label: item.district_type_label || "",
        full_name: item.full_name || "",
      }));
    return res.json(response(true, items));
  } catch (error) {
    console.error("List districts failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇鍖哄幙澶辫触"));
  }
});

router.get("/categories", async (req, res) => {
  try {
    const result = await db.collection("categories").limit(100).get();
    const items = (result.data || [])
      .map(normalizeDoc)
      .filter((item) => item.is_active !== false)
      .sort(
        (a, b) =>
          Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        icon: item.icon || "",
        parent_id: item.parent_id || "",
        description: item.description || "",
      }));
    return res.json(response(true, items));
  } catch (error) {
    console.error("List categories failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇鍒嗙被澶辫触"));
  }
});

router.get("/listings", async (req, res) => {
  try {
    const provinceCode = String(req.query?.province_code || "").trim();
    const cityCode = String(req.query?.city_code || "").trim();
    const districtCode = String(req.query?.district_code || "").trim();
    const listingType = String(req.query?.listing_type || "all").trim();
    const keyword = String(req.query?.keyword || "").trim().toLowerCase();
    const categoryId = String(req.query?.category_id || "").trim();
    const page = parsePage(req.query?.page, 1);
    const pageSize = parsePageSize(req.query?.page_size, 20);

    const query = { status: "approved" };
    if (districtCode) {
      query.district_code = districtCode;
    }
    if (categoryId) {
      query.category_id = categoryId;
    }

    const result = await db
      .collection("listings")
      .where(query)
      .limit(300)
      .get();

    const districtMap = await listDistrictMap();
    const listings = (result.data || [])
      .map(normalizeDoc)
      .filter((item) => {
        const district = getListingDistrictInfo(item, districtMap);
        if (provinceCode) {
          const itemProvinceCode = String(district?.province_code || item.province_code || "").trim();
          if (itemProvinceCode !== provinceCode) {
            return false;
          }
        }
        if (cityCode) {
          const itemCityCode = String(district?.city_code || item.city_code || "").trim();
          if (itemCityCode !== cityCode) {
            return false;
          }
        }
        return true;
      })
      .filter((item) =>
        listingType === "all" ? true : (item.listing_type || "sale") === listingType,
      )
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        return text.includes(keyword);
      })
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));

    const usersMap = await listUsersMapByOpenids(listings.map(getOpenid));

    const enriched = await Promise.all(
      listings.map((item) => enrichListing(item, districtMap, usersMap)),
    );

    const total = enriched.length;
    const start = (page - 1) * pageSize;
    const items = enriched.slice(start, start + pageSize);

    return res.json(
      response(true, {
        items,
        page,
        page_size: pageSize,
        total,
      }),
    );
  } catch (error) {
    console.error("List listings failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇甯栧瓙澶辫触"));
  }
});

router.get("/listings/:id", async (req, res) => {
  try {
    const listing = await findListingByAnyId(req.params.id);
    if (!listing) {
      return res.status(404).json(response(false, null, "甯栧瓙涓嶅瓨鍦?"));
    }

    const districtMap = await listDistrictMap();
    const usersMap = await listUsersMapByOpenids([getOpenid(listing)]);
    const detail = await enrichListing(listing, districtMap, usersMap);

    // If user is authenticated, include favorited status.
    const tokenPayload = tryParseToken(req);
    if (tokenPayload?.openid) {
      const favoriteUser = await findUserByOpenid(tokenPayload.openid);
      detail.is_favorited = await isListingFavorited(
        tokenPayload.openid,
        favoriteUser?._id || favoriteUser?.id || "",
        getDocId(listing),
      );
    } else {
      detail.is_favorited = false;
    }

    return res.json(response(true, detail));
  } catch (error) {
    console.error("Get listing detail failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇璇︽儏澶辫触"));
  }
});

router.post("/listings", authMiddleware, async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const districtCode = String(req.body?.district_code || "").trim();
    const listingTypeRaw = String(req.body?.listing_type || "sale").trim();
    const listingType = listingTypeRaw === "wanted" ? "wanted" : "sale";
    const price = Number(req.body?.price || 0);
    const categoryId = String(req.body?.category_id || "cat-11").trim(); // 榛樿涓?鍏朵粬"鍒嗙被"
    const imageUrls = Array.isArray(req.body?.image_urls)
      ? req.body.image_urls
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 9)
      : [];

    if (!title || !description || !districtCode) {
      return res.status(400).json(response(false, null, "鏍囬銆佹弿杩般€佸尯鍘夸笉鑳戒负绌?"));
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json(response(false, null, "浠锋牸涓嶅悎娉?"));
    }

    const districtMap = await listDistrictMap();
    const district = districtMap.get(districtCode);
    if (!district) {
      return res.status(400).json(response(false, null, "无效区县"));
    }
    const now = Date.now();
    const listingPayload = {
      id: createId("listing"),
      openid: req.auth.openid,
      open_id: req.auth.openid,
      title,
      description,
      price,
      district_code: districtCode,
      district_name: district.name || "",
      city_code: district.city_code || "",
      city_name: district.city_name || "",
      province_code: district.province_code || "",
      province_name: district.province_name || "",
      district_type: district.district_type || "",
      district_type_label: district.district_type_label || "",
      category_id: categoryId,
      listing_type: listingType,
      status: "approved",
      review_status: "approved",
      reject_reason: "",
      image_urls: imageUrls,
      created_at: now,
      updated_at: now,
    };

    const addResult = await db.collection("listings").add(listingPayload);
    const listing = normalizeDoc({ ...listingPayload, _id: addResult.id });

    if (imageUrls.length) {
      await Promise.all(
        imageUrls.map((imageUrl, index) =>
          db.collection("listing_images").add({
            id: createId("image"),
            listing_id: getDocId(listing),
            image_url: imageUrl,
            order: index + 1,
            created_at: now,
          }),
        ),
      );
    }

    return res.json(
      response(true, {
        id: getDocId(listing),
        status: listing.status,
      }, "宸叉彁浜ゅ鏍?"),
    );
  } catch (error) {
    console.error("Create listing failed:", error);
    return res.status(500).json(response(false, null, "鍙戝竷澶辫触锛岃绋嶅悗閲嶈瘯"));
  }
});

router.get("/me/listings", authMiddleware, async (req, res) => {
  try {
    const result = await db
      .collection("listings")
      .where({ openid: req.auth.openid })
      .limit(300)
      .get();

    const items = (result.data || [])
      .map(normalizeDoc)
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
      .map((item) => ({
        id: getDocId(item),
        title: item.title || "",
        price: Number(item.price || 0),
        status: item.status || "pending_review",
        review_status: item.review_status || item.status || "pending_review",
        listing_type: item.listing_type === "wanted" ? "wanted" : "sale",
        image_urls: Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean).slice(0, 9) : [],
        district_code: item.district_code || "",
        created_at: item.created_at || null,
        updated_at: item.updated_at || item.created_at || null,
      }));

    return res.json(response(true, items));
  } catch (error) {
    console.error("List my listings failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇鎴戠殑甯栧瓙澶辫触"));
  }
});

router.patch("/me/listings/:id/status", authMiddleware, async (req, res) => {
  try {
    const listing = await findListingByAnyId(req.params.id);
    if (!listing) {
      return res.status(404).json(response(false, null, "甯栧瓙涓嶅瓨鍦?"));
    }

    if (getOpenid(listing) !== req.auth.openid) {
      return res.status(403).json(response(false, null, "鏃犳潈鎿嶄綔璇ュ笘瀛?"));
    }

    const nextStatus = String(req.body?.status || "").trim();
    if (!["approved", "off_shelf"].includes(nextStatus)) {
      return res.status(400).json(response(false, null, "浠呮敮鎸佷笂鏋舵垨涓嬫灦鎿嶄綔"));
    }

    const now = Date.now();
    const nextReviewStatus = nextStatus === "off_shelf" ? "off_shelf" : "approved";
    await db.collection("listings").doc(listing._id).update({
      status: nextStatus,
      review_status: nextReviewStatus,
      updated_at: now,
    });

    return res.json(response(true, {
      id: getDocId(listing),
      status: nextStatus,
      review_status: nextReviewStatus,
      updated_at: now,
    }));
  } catch (error) {
    console.error("Update listing status failed:", error);
    return res.status(500).json(response(false, null, "鏇存柊甯栧瓙鐘舵€佸け璐?"));
  }
});

router.post("/favorites/toggle", authMiddleware, async (req, res) => {
  try {
    const listingId = String(req.body?.listing_id || "").trim();
    if (!listingId) {
      return res.status(400).json(response(false, null, "listing_id 涓嶈兘涓虹┖"));
    }

    const listing = await findListingByAnyId(listingId);
    if (!listing) {
      return res.status(404).json(response(false, null, "甯栧瓙涓嶅瓨鍦?"));
    }

    const listingDocId = getDocId(listing);
    const favorited = await toggleFavoriteState(
      req.auth.openid,
      req.auth.userId,
      listingDocId,
    );

    return res.json(response(true, { favorited }));
  } catch (error) {
    console.error("Toggle favorite failed:", error);
    return res.status(500).json(response(false, null, "鏀惰棌澶辫触"));
  }
});

router.get("/favorites", authMiddleware, async (req, res) => {
  try {
    const favorites = await readFavoriteListingIds(
      req.auth.openid,
      req.auth.userId,
    );
    return res.json(response(true, { listing_ids: favorites }));
  } catch (error) {
    console.error("Load favorites failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇鏀惰棌澶辫触"));
  }
});

router.get("/favorites/listings", authMiddleware, async (req, res) => {
  try {
    const page = parsePage(req.query?.page, 1);
    const pageSize = parsePageSize(req.query?.page_size, 20);
    const favoriteIds = await readFavoriteListingIds(
      req.auth.openid,
      req.auth.userId,
    );

    if (!favoriteIds.length) {
      return res.json(
        response(true, {
          items: [],
          total: 0,
          page,
          page_size: pageSize,
          listing_ids: [],
        }),
      );
    }

    const resolvedListings = await Promise.all(
      favoriteIds.map((favoriteId) =>
        findListingByAnyId(favoriteId).catch(() => null),
      ),
    );

    const orderedListings = [];
    const seenListingIds = new Set();
    resolvedListings.forEach((item) => {
      if (!item) {
        return;
      }
      const docId = getDocId(item);
      if (!docId || seenListingIds.has(docId)) {
        return;
      }
      seenListingIds.add(docId);
      orderedListings.push(item);
    });

    const total = orderedListings.length;
    const start = (page - 1) * pageSize;
    const pagedListings = orderedListings.slice(start, start + pageSize);
    const districtMap = await listDistrictMap();
    const usersMap = await listUsersMapByOpenids(pagedListings.map(getOpenid));
    const items = await Promise.all(
      pagedListings.map(async (item) => {
        const enriched = await enrichListing(item, districtMap, usersMap);
        return {
          ...enriched,
          is_favorited: true,
        };
      }),
    );

    return res.json(
      response(true, {
        items,
        total,
        page,
        page_size: pageSize,
        listing_ids: favoriteIds,
      }),
    );
  } catch (error) {
    console.error("Load favorite listings failed:", error);
    return res.status(500).json(response(false, null, "閸旂姾娴囬弨鎯版閸熷棗鎼ф径杈Е"));
  }
});

router.post("/conversations/open", authMiddleware, async (req, res) => {
  try {
    const listingId = String(req.body?.listing_id || "").trim();
    if (!listingId) {
      return res.status(400).json(response(false, null, "listing_id 涓嶈兘涓虹┖"));
    }

    const listing = await findListingByAnyId(listingId);
    if (!listing) {
      return res.status(404).json(response(false, null, "甯栧瓙涓嶅瓨鍦?"));
    }

    const sellerOpenid = getOpenid(listing);
    const buyerOpenid = req.auth.openid;
    if (!sellerOpenid || !buyerOpenid) {
      return res.status(400).json(response(false, null, "甯栧瓙鎴栫敤鎴锋暟鎹紓甯?"));
    }

    if (sellerOpenid === buyerOpenid) {
      return res.status(400).json(response(false, null, "涓嶈兘鍜岃嚜宸卞彂璧蜂細璇?"));
    }

    const existing = await db
      .collection("conversations")
      .where({
        listing_id: getDocId(listing),
        buyer_openid: buyerOpenid,
        seller_openid: sellerOpenid,
      })
      .limit(1)
      .get();

    if (existing.data?.[0]) {
      const conversation = normalizeDoc(existing.data[0]);
      return res.json(
        response(true, {
          id: getDocId(conversation),
        }),
      );
    }

    const now = Date.now();
    const payload = {
      id: createId("conversation"),
      listing_id: getDocId(listing),
      buyer_openid: buyerOpenid,
      seller_openid: sellerOpenid,
      last_message: "",
      unread_count: 0,
      updated_at: now,
      created_at: now,
    };
    const addResult = await db.collection("conversations").add(payload);
    const created = normalizeDoc({ ...payload, _id: addResult.id });

    return res.json(
      response(true, {
        id: getDocId(created),
      }),
    );
  } catch (error) {
    console.error("Open conversation failed:", error);
    return res.status(500).json(response(false, null, "鍒涘缓浼氳瘽澶辫触"));
  }
});

router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const openid = req.auth.openid;
    const [buyerResult, sellerResult] = await Promise.all([
      db.collection("conversations").where({ buyer_openid: openid }).limit(300).get(),
      db.collection("conversations").where({ seller_openid: openid }).limit(300).get(),
    ]);

    const map = new Map();
    [...(buyerResult.data || []), ...(sellerResult.data || [])]
      .map(normalizeDoc)
      .forEach((item) => {
        map.set(getDocId(item), item);
      });

    const conversations = Array.from(map.values()).sort(
      (a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0),
    );

    const listingIds = conversations.map((item) => item.listing_id).filter(Boolean);
    const peerOpenids = conversations
      .map((item) => (item.buyer_openid === openid ? item.seller_openid : item.buyer_openid))
      .filter(Boolean);

    const command = db.command;
    const listingsResult = listingIds.length
      ? await db
          .collection("listings")
          .where({ id: command.in(listingIds) })
          .limit(Math.max(100, listingIds.length * 2))
          .get()
      : { data: [] };
    const listingsMap = new Map(
      (listingsResult.data || [])
        .map(normalizeDoc)
        .map((item) => [getDocId(item), item]),
    );
    const usersMap = await listUsersMapByOpenids(peerOpenids);

    const items = conversations.map((item) => {
      const listing = listingsMap.get(item.listing_id);
      const peerOpenid =
        item.buyer_openid === openid ? item.seller_openid : item.buyer_openid;
      const peer = usersMap.get(peerOpenid);

      return {
        id: getDocId(item),
        listing_id: item.listing_id,
        listing_title: listing?.title || "甯栧瓙宸插垹闄?",
        listing_image: Array.isArray(listing?.image_urls) ? listing.image_urls[0] || "" : "",
        listing_price: Number(listing?.price || 0),
        peer_openid: peerOpenid,
        peer_nickname: peer?.nickname || "瀵规柟",
        last_message: item.last_message || "",
        unread_count: Number(item.unread_count || 0),
        updated_at: item.updated_at || item.created_at || 0,
      };
    });

    return res.json(response(true, items));
  } catch (error) {
    console.error("List conversations failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇浼氳瘽澶辫触"));
  }
});

router.get("/conversations/:id", authMiddleware, async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      return res.status(404).json(response(false, null, "浼氳瘽涓嶅瓨鍦?"));
    }

    const openid = req.auth.openid;
    if (conversation.buyer_openid !== openid && conversation.seller_openid !== openid) {
      return res.status(403).json(response(false, null, "鏃犳潈闄愯闂浼氳瘽"));
    }

    const listing = await findListingByAnyId(conversation.listing_id);
    const peerOpenid =
      conversation.buyer_openid === openid ? conversation.seller_openid : conversation.buyer_openid;
    const peerMap = await listUsersMapByOpenids([peerOpenid]);
    const peer = peerMap.get(peerOpenid);

    return res.json(
      response(true, {
        id: getDocId(conversation),
        listing_id: conversation.listing_id,
        buyer_openid: conversation.buyer_openid,
        seller_openid: conversation.seller_openid,
        peer_openid: peerOpenid,
        peer_nickname: peer?.nickname || "瀵规柟",
        updated_at: conversation.updated_at || 0,
        listing: listing
          ? {
              id: getDocId(listing),
              title: listing.title || "",
              price: Number(listing.price || 0),
              image_urls: Array.isArray(listing.image_urls) ? listing.image_urls : [],
            }
          : null,
      }),
    );
  } catch (error) {
    console.error("Get conversation detail failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇浼氳瘽璇︽儏澶辫触"));
  }
});

router.get("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      return res.status(404).json(response(false, null, "浼氳瘽涓嶅瓨鍦?"));
    }

    const openid = req.auth.openid;
    if (conversation.buyer_openid !== openid && conversation.seller_openid !== openid) {
      return res.status(403).json(response(false, null, "鏃犳潈闄愯闂浼氳瘽"));
    }

    const command = db.command;
    const ids = Array.from(
      new Set([conversation.id, conversation._id, getDocId(conversation)].filter(Boolean)),
    );
    const result = await db
      .collection("messages")
      .where({ conversation_id: command.in(ids) })
      .limit(500)
      .get();

    const items = (result.data || [])
      .map(normalizeDoc)
      .sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0))
      .map((item) => ({
        id: getDocId(item),
        conversation_id: item.conversation_id,
        sender_openid: item.sender_openid,
        content: item.content || "",
        message_type: item.message_type || "text",
        image_url: item.image_url || "",
        payload: item.payload || {},
        status: item.status || "sent",
        created_at: item.created_at || 0,
      }));

    // 将当前用户接收的消息标记为已读（异步执行，不阻塞响应）
    (async () => {
      try {
        const receivedMessages = (result.data || [])
          .map(normalizeDoc)
          .filter(msg => msg.sender_openid !== openid && msg.status !== "read");
        
        if (receivedMessages.length > 0) {
          for (const msg of receivedMessages) {
            await db.collection("messages").doc(getDocId(msg)).update({
              status: "read",
            });
          }
        }
      } catch (error) {
        console.error("[GET /messages] 鏍囪宸茶澶辫触:", error.message);
      }
    })();

    return res.json(response(true, items));
  } catch (error) {
    console.error("List messages failed:", error);
    return res.status(500).json(response(false, null, "鍔犺浇娑堟伅澶辫触"));
  }
});

router.post("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      return res.status(404).json(response(false, null, "浼氳瘽涓嶅瓨鍦?"));
    }

    const openid = req.auth.openid;
    if (conversation.buyer_openid !== openid && conversation.seller_openid !== openid) {
      return res.status(403).json(response(false, null, "鏃犳潈闄愯闂浼氳瘽"));
    }

    const content = String(req.body?.content || "").trim();
    const messageType = String(req.body?.message_type || "text").trim();
    const imageUrl = String(req.body?.image_url || "").trim();
    let payloadData = req.body?.payload || {};

    // 楠岃瘉娑堟伅鍐呭
    if (messageType === "text" && !content) {
      return res.status(400).json(response(false, null, "鏂囨湰娑堟伅鍐呭涓嶈兘涓虹┖"));
    }

    if (messageType === "image" && !content && !imageUrl) {
      return res.status(400).json(response(false, null, "鍥剧墖娑堟伅闇€瑕佸浘鐗嘦RL鎴栧唴瀹?"));
    }

    if (messageType === "order") {
      const required = ["listing_id"];
      const missing = required.filter(field => !payloadData[field]);
      if (missing.length > 0) {
        return res.status(400).json(response(false, null, `璁㈠崟娑堟伅缂哄皯蹇呰瀛楁: ${missing.join(", ")}`));
      }

      try {
        // 鍒涘缓璁㈠崟
        console.log("[POST /messages] 鍑嗗鍒涘缓璁㈠崟锛屾秷鎭彂閫佽€?", openid, "listing_id:", payloadData.listing_id);
        const order = await createOrder(payloadData.listing_id, openid, conversation.buyer_openid === openid ? conversation.seller_openid : conversation.buyer_openid);
        console.log("[POST /messages] 璁㈠崟鍒涘缓鎴愬姛:", order.order_id);
        payloadData = {
          order_id: order.order_id,
          listing_id: order.listing_id,
          title: order.title,
          price: order.price,
          status: order.status,
          buyer_openid: order.buyer_openid,
          seller_openid: order.seller_openid,
          created_at: order.created_at,
        };
      } catch (orderError) {
        console.error("[POST /messages] 璁㈠崟鍒涘缓澶辫触:", orderError.message);
        return res.status(400).json(response(false, null, `璁㈠崟鍒涘缓澶辫触: ${orderError.message}`));
      }
    }

    if (messageType === "location") {
      const required = ["title", "address", "latitude", "longitude", "sender_openid"];
      const missing = required.filter(field => !payloadData[field]);
      if (missing.length > 0) {
        return res.status(400).json(response(false, null, `浣嶇疆娑堟伅缂哄皯蹇呰瀛楁: ${missing.join(", ")}`));
      }
    }

    const now = Date.now();
    const conversationId = getDocId(conversation);
    const payload = {
      id: createId("message"),
      conversation_id: conversationId,
      sender_openid: openid,
      content: messageType === "image" && imageUrl ? imageUrl : content,
      message_type: messageType,
      status: "sent",
      created_at: now,
    };

    // 娣诲姞鍥剧墖URL
    if (imageUrl && messageType === "image") {
      payload.image_url = imageUrl;
    }

    // 添加 payload 数据（如有）
    if (Object.keys(payloadData).length > 0) {
      payload.payload = payloadData;
    }

    const addResult = await db.collection("messages").add(payload);
    await db.collection("conversations").doc(conversation._id).update({
      last_message: messageType === "image" ? "[鍥剧墖]" : messageType === "order" ? "[璁㈠崟]" : messageType === "location" ? "[浣嶇疆]" : content,
      unread_count: Number(conversation.unread_count || 0) + 1,
      updated_at: now,
    });

    const createdMessage = {
      id: addResult.id,
      ...payload,
    };

    webSocketHub.notifyConversationParticipants(conversation, {
      type: "message:new",
      data: {
        conversation_id: conversationId,
        message: createdMessage,
      },
    });

    return res.json(response(true, createdMessage));
  } catch (error) {
    console.error("[POST /messages] 鍙戦€佹秷鎭け璐?", {
      messageType,
      error: error.message || error,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json(response(false, null, `鍙戦€佸け璐? ${error.message || "鏈煡閿欒"}`));
  }
});

router.post("/conversations/:id/read", authMiddleware, async (req, res) => {
  try {
    const conversation = await findConversationByAnyId(req.params.id);
    if (!conversation) {
      return res.status(404).json(response(false, null, "浼氳瘽涓嶅瓨鍦?"));
    }

    const openid = req.auth.openid;
    if (conversation.buyer_openid !== openid && conversation.seller_openid !== openid) {
      return res.status(403).json(response(false, null, "鏃犳潈闄愯闂浼氳瘽"));
    }

    await db.collection("conversations").doc(conversation._id).update({
      unread_count: 0,
      updated_at: Date.now(),
    });
    webSocketHub.notifyConversationParticipants(conversation, {
      type: "conversation:read",
      data: {
        conversation_id: getDocId(conversation),
        reader_openid: openid,
        read_at: Date.now(),
      },
    });
    return res.json(response(true, { id: getDocId(conversation) }));
  } catch (error) {
    console.error("Mark conversation read failed:", error);
    return res.status(500).json(response(false, null, "鏇存柊宸茶鐘舵€佸け璐?"));
  }
});

// 鑱婂ぉ鍥剧墖涓婁紶鎺ュ彛
router.post("/uploads/chat", authMiddleware, (req, res) => {
  const uploadSingle = upload.single("image");

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json(response(false, null, "鏂囦欢澶у皬涓嶈兘瓒呰繃10MB"));
        }
        return res.status(400).json(response(false, null, "涓婁紶澶辫触: " + err.message));
      }
      return res.status(400).json(response(false, null, err.message));
    }

    if (!req.file) {
      return res.status(400).json(response(false, null, "璇烽€夋嫨鍥剧墖鏂囦欢"));
    }

    // 鏋勫缓鍙闂殑URL璺緞
    const fileUrl = `/uploads/${req.file.filename}`;

    return res.json(response(true, {
      url: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    }));
  });
});

router.post("/uploads/listing", authMiddleware, (req, res) => {
  const uploadSingle = upload.single("image");

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json(response(false, null, "鏂囦欢澶у皬涓嶈兘瓒呰繃10MB"));
        }
        return res.status(400).json(response(false, null, "涓婁紶澶辫触: " + err.message));
      }
      return res.status(400).json(response(false, null, err.message));
    }

    if (!req.file) {
      return res.status(400).json(response(false, null, "璇烽€夋嫨鍥剧墖鏂囦欢"));
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    return res.json(response(true, {
      url: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    }));
  });
});

module.exports = {
  router,
  authMiddleware,
};


