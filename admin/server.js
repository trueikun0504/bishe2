/**
 * Admin and customer-service web entry.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const session = require("express-session");
const flash = require("connect-flash");
const morgan = require("morgan");
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");

const { db, env: cloudbaseEnv, hasStaticCredentials } = require("../cloudbase");
const { normalizeDoc } = require("../init-db");
const { router: mpAuthRouter } = require("./routes/mp-auth");
const { router: webAuthRouter } = require("./routes/web-auth");
const { router: webApiRouter } = require("./routes/web-api");
const { initWebSocketServer, WS_PATH } = require("./websocket");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";

// 强制使用环境变量，避免线上默认弱口令
function getSecurePassword(envKey, type) {
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `${type}密码未配置！必须设置环境变量 ${envKey}。\n` +
      `参考 admin/.env.example 配置安全的强密码。`,
    );
  }
  return value;
}

const ADMIN_PASSWORD =
  process.env.NODE_ENV === "production" || process.env.REQUIRE_SECURE_PASSWORD === "true"
    ? getSecurePassword("ADMIN_PASSWORD", "管理员")
    : process.env.ADMIN_PASSWORD || "admin123";

const SERVICE_PASSWORD =
  process.env.NODE_ENV === "production" || process.env.REQUIRE_SECURE_PASSWORD === "true"
    ? getSecurePassword("SERVICE_PASSWORD", "客服")
    : process.env.SERVICE_PASSWORD || "service123";

const STAFF_ROLES = new Set(["admin", "customer_service"]);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");

app.use(expressLayouts);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      (() => {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "SESSION_SECRET 未配置！必须设置一个强的随机密钥。\n" +
            "参考 admin/.env.example 生成安全的 SESSION_SECRET。",
          );
        }
        // 开发模式下生成一个临时的随机密钥
        console.warn(
          "⚠️  警告：使用临时的 SESSION_SECRET（仅供开发）。\n" +
          "请在 .env 中设置 SESSION_SECRET 为强随机字符串。",
        );
        return `temp-${Math.random().toString(36).substring(2, 15)}`;
      })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 线上环境强制HTTPS
    },
  }),
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

function getRoleHome(role) {
  return role === "customer_service" ? "/service/dashboard" : "/admin/listings";
}

function buildSessionUser(user) {
  return {
    id: user.id || user._id,
    openid: user.openid || user.open_id || "",
    nickname: user.nickname || "后台账号",
    role: user.role || "user",
  };
}

async function findStaffUser(identifier) {
  const value = String(identifier || "").trim();
  if (!value) {
    return null;
  }

  const result = await db.collection("users").limit(200).get();
  const users = (result.data || []).map(normalizeDoc);

  return (
    users.find((user) => {
      const candidates = [
        user._id,
        user.id,
        user.openid,
        user.open_id,
        user.username,
      ]
        .filter(Boolean)
        .map((item) => String(item));

      return candidates.includes(value) && STAFF_ROLES.has(user.role);
    }) || null
  );
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash("error", "请先登录后台账号。");
    return res.redirect("/login");
  }

  next();
}

function requireRole(roles) {
  const allowed = new Set(roles);

  return (req, res, next) => {
    if (!req.session.user) {
      req.flash("error", "请先登录后台账号。");
      return res.redirect("/login");
    }

    if (!allowed.has(req.session.user.role)) {
      req.flash("error", "当前账号没有访问该页面的权限。");
      return res.redirect(getRoleHome(req.session.user.role));
    }

    next();
  };
}

app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  return res.redirect(getRoleHome(req.session.user.role));
});

app.get("/login", (req, res) => {
  const allowSwitch = String(req.query.switch || "") === "1";
  if (req.session.user && !allowSwitch) {
    return res.redirect(getRoleHome(req.session.user.role));
  }

  return res.render("login", {
    layout: false,
    title: "后台登录",
  });
});

app.post("/login", async (req, res) => {
  const account = String(req.body.account || req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  // Clear previous auth state before handling a new login request.
  delete req.session.user;

  if (!account || !password) {
    req.flash("error", "请输入账号和密码。");
    return res.redirect("/login");
  }

  try {
    if (account === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = {
        id: "local-admin",
        openid: "",
        nickname: "最高管理员",
        role: "admin",
      };
      req.flash("success", "最高管理员登录成功。");
      return res.redirect("/admin/listings");
    }

    const staffUser = await findStaffUser(account);
    if (!staffUser) {
      req.flash("error", "账号不存在，或当前账号没有后台权限。");
      return res.redirect("/login");
    }

    if (staffUser.status === "disabled") {
      req.flash("error", "当前账号已被禁用。");
      return res.redirect("/login");
    }

    const expectedPassword =
      staffUser.role === "customer_service" ? SERVICE_PASSWORD : ADMIN_PASSWORD;

    if (password !== expectedPassword) {
      req.flash("error", "密码错误。");
      return res.redirect("/login");
    }

    req.session.user = buildSessionUser(staffUser);
    req.flash(
      "success",
      staffUser.role === "customer_service" ? "客服账号登录成功。" : "管理员登录成功。",
    );
    return res.redirect(getRoleHome(staffUser.role));
  } catch (error) {
    console.error("Login failed:", error);
    req.flash("error", "登录失败，请稍后重试。");
    return res.redirect("/login");
  }
});

// API: 微信小程序授权登录（已弃用，请使用 /api/mp/auth/login）
app.post("/user/login-with-weixin", async (req, res) => {
  try {
    const { openid, nickname, avatar_url } = req.body;

    if (!openid) {
      return res.status(400).json({
        success: false,
        message: "缺少 openid。",
      });
    }

    // 查找或创建用户
    const result = await db.collection("users").where({ openid }).get();
    let user = result.data && result.data[0] ? normalizeDoc(result.data[0]) : null;

    if (!user) {
      // 创建新用户
      const newUser = {
        openid,
        nickname: String(nickname || "微信用户").trim(),
        avatar_url: String(avatar_url || "").trim(),
        role: "user",
        status: "active",
        login_type: "weixin",
        created_at: new Date(),
      };
      const addResult = await db.collection("users").add(newUser);
      user = normalizeDoc({
        ...newUser,
        _id: addResult.id,
      });
    }

    res.json({
      success: true,
      user,
      deprecated: true,
      warning: "此 API 已弃用，请使用新的微信授权登录 API：POST /api/mp/auth/login",
      new_endpoint: "/api/mp/auth/login",
    });
  } catch (error) {
    console.error("Weixin login failed:", error);
    res.status(500).json({
      success: false,
      message: "微信登录失败，请稍后重试。",
    });
  }
});

// API: 微信小程序手机号登录（已弃用，请使用 /api/mp/auth/phone）
app.post("/user/login-with-phone", async (req, res) => {
  // 返回弃用错误，提示使用新 API
  return res.status(410).json({
    success: false,
    message: "此 API 已弃用，请使用新的微信授权登录 API：POST /api/mp/auth/login 和 POST /api/mp/auth/phone",
    deprecated: true,
    new_endpoint: "/api/mp/auth/phone",
    documentation: "请参考 API 文档使用新的微信授权流程"
  });
});

app.get("/logout", requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// 微信小程序真实授权登录 API（替换旧的占位实现）
app.use("/api/mp/auth", mpAuthRouter);
app.use("/api/web", webAuthRouter);
app.use("/api/web", webApiRouter);

app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "user-web", "index.html"));
});

app.use("/admin", requireRole(["admin"]), require("./routes/admin"));
app.use(
  "/service",
  requireRole(["admin", "customer_service"]),
  require("./routes/service"),
);

app.use((req, res) => {
  res.status(404).render("404", {
    layout: false,
    title: "页面不存在",
  });
});

app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).render("500", {
    layout: false,
    title: "系统错误",
    error: error.message,
  });
});

initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Admin web running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}${WS_PATH}`);
  console.log(`CloudBase env: ${cloudbaseEnv}`);
  console.log(`Credential mode: ${hasStaticCredentials ? "static" : "runtime"}`);
  console.log(`Admin username: ${ADMIN_USERNAME}`);
  console.log("Customer-service accounts login with their openid and SERVICE_PASSWORD.");
});
