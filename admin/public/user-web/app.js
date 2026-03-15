const { createApp, reactive, ref, computed, onMounted, onBeforeUnmount, watch, nextTick } = window.Vue;
const { createRouter, createWebHashHistory, useRoute, useRouter } = window.VueRouter;

const STORAGE_TOKEN_KEY = "LOCAL_TRADER_WEB_TOKEN";
const STORAGE_USER_KEY = "LOCAL_TRADER_WEB_USER";

const FALLBACK_CATEGORIES = [
  { id: "cat-1", name: "手机数码", icon: "📱", description: "手机、平板、数码配件" },
  { id: "cat-2", name: "电脑办公", icon: "💻", description: "笔记本、显示器、办公设备" },
  { id: "cat-3", name: "家用电器", icon: "🏠", description: "小家电、家电整机、租房电器" },
  { id: "cat-4", name: "服饰鞋包", icon: "👟", description: "衣服、鞋靴、箱包配饰" },
  { id: "cat-5", name: "美妆个护", icon: "💄", description: "彩妆、护肤、个人护理" },
  { id: "cat-6", name: "母婴用品", icon: "🍼", description: "母婴、儿童成长用品" },
  { id: "cat-7", name: "家居日用", icon: "🧺", description: "日用百货、收纳清洁、家居杂货" },
  { id: "cat-8", name: "运动户外", icon: "🚴", description: "露营、骑行、运动器材" },
  { id: "cat-9", name: "图书文玩", icon: "📚", description: "图书、乐器、文创周边" },
  { id: "cat-10", name: "车品骑行", icon: "🚗", description: "电动车、自行车、车品配件" },
  { id: "cat-11", name: "其他闲置", icon: "📦", description: "本地社区其他闲置" },
];

const HERO_BANNERS = [
  {
    eyebrow: "区县社区二手",
    title: "先看本区县，再决定聊不聊、见不见",
    text: "区县筛选、分类浏览、图片发布、即时聊天和审核流都保留。",
  },
  {
    eyebrow: "求购也能发",
    title: "出售帖和求购帖共用一套交易入口",
    text: "首页、分类、发布、消息和个人中心统一成一套社区 Web 体验。",
  },
  {
    eyebrow: "区县分类已接入",
    title: "全国区县按省份、城市、区县三级联动筛选",
    text: "先选省市，再选区县，浏览和发布都走同一套区县分类。",
  },
];
const appState = reactive({
  token: String(localStorage.getItem(STORAGE_TOKEN_KEY) || ""),
  user: loadStoredJson(STORAGE_USER_KEY, null),
  districts: [],
  categories: [],
  loadingDistricts: false,
  loadingCategories: false,
});
let districtsPromise = null;
let categoriesPromise = null;
let favoritesPromise = null;
let favoriteListingIdsCache = null;
const districtOptionCache = new WeakMap();

function loadStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveAuth(token, user) {
  appState.token = String(token || "");
  appState.user = user ? { ...user } : null;

  if (appState.token) {
    localStorage.setItem(STORAGE_TOKEN_KEY, appState.token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  }

  if (appState.user) {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(appState.user));
  } else {
    localStorage.removeItem(STORAGE_USER_KEY);
  }
}

function clearAuth() {
  saveAuth("", null);
  favoriteListingIdsCache = null;
  favoritesPromise = null;
}

function formatPrice(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return "¥0";
  }
  return Number.isInteger(number) ? `¥${number}` : `¥${number.toFixed(2)}`;
}
function formatCompactNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) {
    return "0";
  }
  if (number >= 10000) {
    const compact = number / 10000;
    return `${Number.isInteger(compact) ? compact : compact.toFixed(1)}万`;
  }
  return String(number);
}

function formatListingType(value) {
  return value === "wanted" ? "求购" : "在售";
}

function formatReviewStatus(value) {
  const map = {
    off_shelf: "已下架",
    pending_review: "待审核",
    approved: "已通过",
    rejected: "已驳回",
    sold: "已售出",
  };
  return map[value] || value || "--";
}

function formatDateTime(value) {
  const number = Number(value || 0);
  if (!number) {
    return "--";
  }
  const date = new Date(number);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function formatRelativeTime(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) {
    return "--";
  }
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) {
    return "刚刚";
  }
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
  }
  return formatDateTime(timestamp);
}
function getUserDisplayName(user) {
  return user?.nickname || user?.account || user?.openid || "未登录";
}

function getAvatarText(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 2) : "闲置";
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeCategories(items) {
  const iconMap = new Map(FALLBACK_CATEGORIES.map((item) => [item.id, item]));
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item) => {
      const fallback = iconMap.get(item.id) || {};
      return {
        id: String(item.id || fallback.id || ""),
        name: String(item.name || fallback.name || "鍏朵粬"),
        icon: String(item.icon || fallback.icon || "馃З"),
        description: String(item.description || fallback.description || ""),
      };
    })
    .filter((item) => item.id);
}

function normalizeDistricts(items) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item) => {
      const code = String(item.code || "").trim();
      const name = String(item.name || "").trim();
      const cityName = String(item.city_name || "").trim();
      const provinceName = String(item.province_name || "").trim();
      return {
        code,
        name,
        city_code: String(item.city_code || "").trim(),
        city_name: cityName,
        province_code: String(item.province_code || "").trim(),
        province_name: provinceName,
        district_type: String(item.district_type || "").trim(),
        district_type_label: String(item.district_type_label || "").trim(),
        full_name:
          String(item.full_name || "").trim() ||
          [provinceName, cityName, name].filter(Boolean).join(" "),
      };
    })
    .filter((item) => item.code && item.name)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

function findDistrictByCode(code) {
  const value = String(code || "").trim();
  if (!value) {
    return null;
  }
  return appState.districts.find((item) => item.code === value) || null;
}

function getProvinceOptions(districts) {
  const source = Array.isArray(districts) ? districts : [];
  const cached = districtOptionCache.get(source);
  if (cached?.provinces) {
    return cached.provinces;
  }
  const map = new Map();
  for (const item of source) {
    if (!item?.province_code || map.has(item.province_code)) {
      continue;
    }
    map.set(item.province_code, {
      code: item.province_code,
      name: item.province_name || item.province_code,
    });
  }
  const provinces = Array.from(map.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  districtOptionCache.set(source, {
    ...(cached || {}),
    provinces,
  });
  return provinces;
}

function getCityOptions(districts, provinceCode = "") {
  const source = Array.isArray(districts) ? districts : [];
  const provinceValue = String(provinceCode || "").trim();
  const cached = districtOptionCache.get(source);
  if (cached?.cities?.has(provinceValue)) {
    return cached.cities.get(provinceValue);
  }
  const map = new Map();
  for (const item of source) {
    if (provinceValue && item.province_code !== provinceValue) {
      continue;
    }
    if (!item?.city_code || map.has(item.city_code)) {
      continue;
    }
    map.set(item.city_code, {
      code: item.city_code,
      name: item.city_name || item.city_code,
      province_code: item.province_code || "",
      province_name: item.province_name || "",
    });
  }
  const cities = Array.from(map.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const cityCache = cached?.cities || new Map();
  cityCache.set(provinceValue, cities);
  districtOptionCache.set(source, {
    ...(cached || {}),
    cities: cityCache,
  });
  return cities;
}

function getDistrictOptions(districts, scope = {}) {
  const source = Array.isArray(districts) ? districts : [];
  const provinceCode = String(scope.province_code || "").trim();
  const cityCode = String(scope.city_code || "").trim();
  const cacheKey = `${provinceCode}|${cityCode}`;
  const cached = districtOptionCache.get(source);
  if (cached?.districts?.has(cacheKey)) {
    return cached.districts.get(cacheKey);
  }
  const options = source
    .filter((item) => (provinceCode ? item.province_code === provinceCode : true))
    .filter((item) => (cityCode ? item.city_code === cityCode : true))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const districtCache = cached?.districts || new Map();
  districtCache.set(cacheKey, options);
  districtOptionCache.set(source, {
    ...(cached || {}),
    districts: districtCache,
  });
  return options;
}

function syncDistrictScope(scope, districtCode, districts) {
  const district = (districts || []).find((item) => item.code === districtCode);
  if (!district) {
    return false;
  }
  scope.province_code = district.province_code || "";
  scope.city_code = district.city_code || "";
  return true;
}

function getDistrictScopeLabel(scope, districts) {
  const district = findDistrictByCode(scope?.district_code);
  if (district) {
    return district.name;
  }

  const cityCode = String(scope?.city_code || "").trim();
  if (cityCode) {
    const city = getCityOptions(districts, scope?.province_code).find((item) => item.code === cityCode);
    if (city) {
      return `${city.name} · 全部区县`;
    }
  }

  const provinceCode = String(scope?.province_code || "").trim();
  if (provinceCode) {
    const province = getProvinceOptions(districts).find((item) => item.code === provinceCode);
    if (province) {
      return `${province.name} · 全部区县`;
    }
  }

  return "全部区县";
}

function getDistrictPathLabel(districtCode) {
  const district = findDistrictByCode(districtCode);
  if (!district) {
    return "未选择区县";
  }
  return [district.province_name, district.city_name, district.name].filter(Boolean).join(" / ");
}

function findCategory(categoryId) {
  return (
    appState.categories.find((item) => item.id === categoryId) ||
    FALLBACK_CATEGORIES.find((item) => item.id === categoryId) ||
    null
  );
}

function collectListingImages(listing) {
  if (!listing || typeof listing !== "object") {
    return [];
  }
  const raw = [];
  if (Array.isArray(listing.image_urls)) {
    raw.push(...listing.image_urls);
  }
  if (Array.isArray(listing.images)) {
    raw.push(...listing.images);
  }
  raw.push(listing.image_url, listing.cover_image_url, listing.cover);
  return Array.from(
    new Set(
      raw
        .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : entry))
        .map((entry) => String(entry || "").trim())
        .filter(Boolean),
    ),
  );
}

async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (options.auth !== false && appState.token) {
    headers.Authorization = `Bearer ${appState.token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    credentials: "same-origin",
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const rawText = await response.text();
  const payload = (() => {
    try {
      return rawText ? JSON.parse(rawText) : { success: true, data: null };
    } catch (error) {
      const contentType = response.headers.get("content-type") || "";
      return {
        success: false,
        message: `服务返回了无法解析的数据（${response.status} ${contentType || "unknown"}）。`,
      };
    }
  })();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `请求失败，状态码 ${response.status}`);
  }

  return payload.data;
}

async function ensureDistricts() {
  if (appState.districts.length) {
    return appState.districts;
  }
  if (districtsPromise) {
    return districtsPromise;
  }
  appState.loadingDistricts = true;
  districtsPromise = (async () => {
    try {
      const data = await apiRequest("/api/web/districts", { auth: false });
      appState.districts = normalizeDistricts(data);
      return appState.districts;
    } finally {
      appState.loadingDistricts = false;
      districtsPromise = null;
    }
  })();
  return districtsPromise;
}

async function ensureCategories() {
  if (appState.categories.length) {
    return appState.categories;
  }
  if (categoriesPromise) {
    return categoriesPromise;
  }
  appState.loadingCategories = true;
  categoriesPromise = (async () => {
    try {
      const data = await apiRequest("/api/web/categories", { auth: false });
      const normalized = normalizeCategories(data);
      appState.categories = normalized.length ? normalized : [...FALLBACK_CATEGORIES];
      return appState.categories;
    } catch (error) {
      appState.categories = [...FALLBACK_CATEGORIES];
      return appState.categories;
    } finally {
      appState.loadingCategories = false;
      categoriesPromise = null;
    }
  })();
  return categoriesPromise;
}

async function ensureFavoriteListingIds() {
  if (!appState.token) {
    favoriteListingIdsCache = null;
    return [];
  }
  if (Array.isArray(favoriteListingIdsCache)) {
    return favoriteListingIdsCache;
  }
  if (favoritesPromise) {
    return favoritesPromise;
  }
  favoritesPromise = (async () => {
    try {
      const favoriteData = await apiRequest("/api/web/favorites");
      favoriteListingIdsCache = Array.isArray(favoriteData?.listing_ids) ? favoriteData.listing_ids : [];
      return favoriteListingIdsCache;
    } finally {
      favoritesPromise = null;
    }
  })();
  return favoritesPromise;
}

function syncFavoriteListingCache(listingId, favorited) {
  const normalizedId = String(listingId || "").trim();
  if (!normalizedId || !Array.isArray(favoriteListingIdsCache)) {
    return;
  }
  const next = new Set(favoriteListingIdsCache);
  if (favorited) {
    next.add(normalizedId);
  } else {
    next.delete(normalizedId);
  }
  favoriteListingIdsCache = Array.from(next);
}

function setupPointerSparkles() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (prefersReducedMotion || coarsePointer) {
    return;
  }

  const layer = document.createElement("div");
  layer.className = "pointer-sparkle-layer";
  document.body.appendChild(layer);

  let lastTrailAt = 0;

  function spawnSparkle(x, y, mode = "trail", index = 0, total = 1) {
    const sparkle = document.createElement("span");
    sparkle.className = `pointer-sparkle ${mode}`;
    sparkle.textContent = "✦";

    const angle = total > 1 ? (Math.PI * 2 * index) / total : 0;
    const distance = mode === "burst" ? 24 + Math.random() * 40 : 8 + Math.random() * 18;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rotate = -18 + Math.random() * 36;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.setProperty("--sparkle-dx", `${dx.toFixed(1)}px`);
    sparkle.style.setProperty("--sparkle-dy", `${dy.toFixed(1)}px`);
    sparkle.style.setProperty("--sparkle-rotate", `${rotate.toFixed(1)}deg`);
    sparkle.style.setProperty("--sparkle-scale", mode === "burst" ? (1 + Math.random() * 0.5).toFixed(2) : (0.8 + Math.random() * 0.5).toFixed(2));
    sparkle.style.animationDuration = mode === "burst" ? `${760 + Math.random() * 220}ms` : `${620 + Math.random() * 180}ms`;

    layer.appendChild(sparkle);
    window.setTimeout(() => sparkle.remove(), 1100);
  }

  function handlePointerMove(event) {
    const now = Date.now();
    if (now - lastTrailAt < 48) {
      return;
    }
    lastTrailAt = now;
    spawnSparkle(event.clientX, event.clientY, "trail");
  }

  function handlePointerDown(event) {
    for (let index = 0; index < 8; index += 1) {
      spawnSparkle(event.clientX, event.clientY, "burst", index, 8);
    }
  }

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
}

async function refreshMe() {
  if (!appState.token) {
    return null;
  }
  try {
    const user = await apiRequest("/api/web/auth/me");
    saveAuth(appState.token, user);
    return user;
  } catch (error) {
    clearAuth();
    return null;
  }
}

const LoginPage = {
  setup() {
    const router = useRouter();
    const route = useRoute();
    const form = reactive({ account: "", password: "" });
    const submitting = ref(false);
    const errorText = ref("");

    function fillDemoAccount(account) {
      form.account = account;
      form.password = "user123";
    }

    async function submit() {
      errorText.value = "";
      if (!form.account.trim() || !form.password.trim()) {
        errorText.value = "请输入账号和密码。";
        return;
      }

      submitting.value = true;
      try {
        const data = await apiRequest("/api/web/auth/login", {
          method: "POST",
          auth: false,
          body: { account: form.account.trim(), password: form.password },
        });
        saveAuth(data.token, data.user);
        const redirect = String(route.query.redirect || "").trim();
        router.replace(redirect || "/me");
      } catch (error) {
        errorText.value = error.message || "登录失败，请重试。";
      } finally {
        submitting.value = false;
      }
    }

    return { form, submitting, errorText, fillDemoAccount, submit };
  },
  template: `
    <section class="auth-shell">
      <div class="auth-card card">
        <div class="auth-brand">
          <div class="auth-badge">账号登录</div>
          <h1>进入本地闲置</h1>
          <p>登录后即可发布帖子、发起聊天和管理我的内容。</p>
        </div>
        <div class="field">
          <label>账号</label>
          <input class="input" v-model.trim="form.account" placeholder="例如 seller-002 或 buyer-demo-001" />
        </div>
        <div class="field">
          <label>密码</label>
          <input class="input" type="password" v-model="form.password" placeholder="请输入密码" />
        </div>
        <div class="actions auth-fill-actions">
          <button class="btn btn-ghost" type="button" @click="fillDemoAccount('seller-002')">填充 seller-002</button>
          <button class="btn btn-ghost" type="button" @click="fillDemoAccount('buyer-demo-001')">填充 buyer-demo-001</button>
        </div>
        <button class="btn btn-primary auth-submit" :disabled="submitting" @click="submit">
          {{ submitting ? '登录中...' : '登录' }}
        </button>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <p class="auth-footnote">没有账号？<router-link to="/register">去注册</router-link></p>
      </div>
    </section>
  `,
};
const RegisterPage = {
  setup() {
    const router = useRouter();
    const form = reactive({
      username: "",
      nickname: "",
      password: "",
      confirmPassword: "",
      avatar_url: "",
    });
    const submitting = ref(false);
    const errorText = ref("");

    async function submit() {
      errorText.value = "";
      if (!form.username.trim()) {
        errorText.value = "请输入用户名。";
        return;
      }
      if (!form.password) {
        errorText.value = "请输入密码。";
        return;
      }
      if (form.password.length < 6) {
        errorText.value = "密码长度至少 6 位。";
        return;
      }
      if (form.password !== form.confirmPassword) {
        errorText.value = "两次输入的密码不一致。";
        return;
      }
      if (form.avatar_url && !isValidUrl(form.avatar_url)) {
        errorText.value = "头像链接必须是 http 或 https 地址。";
        return;
      }

      submitting.value = true;
      try {
        const data = await apiRequest("/api/web/auth/register", {
          method: "POST",
          auth: false,
          body: {
            username: form.username.trim(),
            nickname: form.nickname.trim(),
            password: form.password,
            avatar_url: form.avatar_url.trim(),
          },
        });
        saveAuth(data.token, data.user);
        router.replace("/me");
      } catch (error) {
        errorText.value = error.message || "注册失败，请重试。";
      } finally {
        submitting.value = false;
      }
    }

    return { form, submitting, errorText, submit };
  },
  template: `
    <section class="auth-shell">
      <div class="auth-card card">
        <div class="auth-brand">
          <div class="auth-badge">新用户注册</div>
          <h1>创建本地闲置账号</h1>
          <p>注册后即可发布出售帖、求购帖，并发起聊天会话。</p>
        </div>
        <div class="field">
          <label>用户名</label>
          <input class="input" v-model.trim="form.username" placeholder="3-30 位字母、数字或短横线" />
        </div>
        <div class="field">
          <label>昵称</label>
          <input class="input" v-model.trim="form.nickname" placeholder="留空则自动生成昵称" />
        </div>
        <div class="field">
          <label>头像链接</label>
          <input class="input" v-model.trim="form.avatar_url" placeholder="可选，http(s) 图片地址" />
        </div>
        <div class="field">
          <label>密码</label>
          <input class="input" type="password" v-model="form.password" placeholder="至少 6 位" />
        </div>
        <div class="field">
          <label>确认密码</label>
          <input class="input" type="password" v-model="form.confirmPassword" placeholder="再次输入密码" />
        </div>
        <button class="btn btn-primary auth-submit" :disabled="submitting" @click="submit">
          {{ submitting ? '注册中...' : '注册并登录' }}
        </button>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <p class="auth-footnote">已有账号？<router-link to="/login">返回登录</router-link></p>
      </div>
    </section>
  `,
};
const HomePage = {
  setup() {
    const router = useRouter();
    const filters = reactive({
      province_code: "",
      city_code: "",
      district_code: "",
      listing_type: "all",
      keyword: "",
      category_id: "",
    });
    const listings = ref([]);
    const loading = ref(false);
    const errorText = ref("");
    const bannerIndex = ref(0);
    let bannerTimer = null;

    const activeBanner = computed(() => HERO_BANNERS[bannerIndex.value % HERO_BANNERS.length]);
    const featuredCategories = computed(() => appState.categories.slice(0, 7));
    const provinceOptions = computed(() => getProvinceOptions(appState.districts));
    const cityOptions = computed(() => getCityOptions(appState.districts, filters.province_code));
    const districtOptions = computed(() =>
      getDistrictOptions(appState.districts, {
        province_code: filters.province_code,
        city_code: filters.city_code,
      }),
    );
    const selectedDistrict = computed(() => findDistrictByCode(filters.district_code));
    const selectedScopeLabel = computed(() =>
      getDistrictScopeLabel(
        {
          province_code: filters.province_code,
          city_code: filters.city_code,
          district_code: filters.district_code,
        },
        appState.districts,
      ),
    );

    async function loadListings() {
      loading.value = true;
      errorText.value = "";
      try {
        const query = new URLSearchParams();
        if (filters.province_code) query.set("province_code", filters.province_code);
        if (filters.city_code) query.set("city_code", filters.city_code);
        if (filters.district_code) query.set("district_code", filters.district_code);
        if (filters.listing_type !== "all") query.set("listing_type", filters.listing_type);
        if (filters.keyword) query.set("keyword", filters.keyword);
        if (filters.category_id) query.set("category_id", filters.category_id);
        query.set("page", "1");
        query.set("page_size", "50");

        const data = await apiRequest(`/api/web/listings?${query.toString()}`, { auth: false });
        listings.value = Array.isArray(data.items) ? data.items : [];
      } catch (error) {
        errorText.value = error.message || "加载帖子失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function setListingType(type) {
      filters.listing_type = type;
      loadListings();
    }

    function setCategory(categoryId) {
      filters.category_id = filters.category_id === categoryId ? "" : categoryId;
      loadListings();
    }

    function handleProvinceChange() {
      if (!cityOptions.value.some((item) => item.code === filters.city_code)) {
        filters.city_code = "";
      }
      if (!districtOptions.value.some((item) => item.code === filters.district_code)) {
        filters.district_code = "";
      }
      loadListings();
    }

    function handleCityChange() {
      if (!districtOptions.value.some((item) => item.code === filters.district_code)) {
        filters.district_code = "";
      }
      loadListings();
    }

    function handleDistrictChange() {
      if (filters.district_code) {
        syncDistrictScope(filters, filters.district_code, appState.districts);
      }
      loadListings();
    }

    function openListing(item) {
      router.push(`/listing/${encodeURIComponent(item.id)}`);
    }

    async function openChat(item) {
      if (!appState.token) {
        router.push(`/login?redirect=${encodeURIComponent(`/listing/${item.id}`)}`);
        return;
      }
      try {
        const data = await apiRequest("/api/web/conversations/open", {
          method: "POST",
          body: { listing_id: item.id },
        });
        router.push(`/messages/${encodeURIComponent(data.id)}`);
      } catch (error) {
        window.alert(error.message || "发起聊天失败，请稍后重试。");
      }
    }

    function categoryNameOf(item) {
      return findCategory(item.category_id)?.name || "其他闲置";
    }

    onMounted(async () => {
      await Promise.all([ensureDistricts(), ensureCategories()]);
      await loadListings();
      bannerTimer = window.setInterval(() => {
        bannerIndex.value = (bannerIndex.value + 1) % HERO_BANNERS.length;
      }, 5000);
    });

    onBeforeUnmount(() => {
      if (bannerTimer) {
        window.clearInterval(bannerTimer);
        bannerTimer = null;
      }
    });

    return {
      appState,
      filters,
      listings,
      loading,
      errorText,
      activeBanner,
      featuredCategories,
      provinceOptions,
      cityOptions,
      districtOptions,
      selectedDistrict,
      selectedScopeLabel,
      loadListings,
      setListingType,
      setCategory,
      handleProvinceChange,
      handleCityChange,
      handleDistrictChange,
      openListing,
      openChat,
      categoryNameOf,
      formatPrice,
      formatCompactNumber,
      formatRelativeTime,
      formatListingType,
      getAvatarText,
    };
  },
  template: `
    <section class="home-hero card">
      <div class="home-hero-copy">
        <div class="home-hero-eyebrow">{{ activeBanner.eyebrow }}</div>
        <h1>{{ activeBanner.title }}</h1>
        <p>{{ activeBanner.text }}</p>
      </div>
      <div class="home-hero-panel">
        <div class="hero-metric"><strong>{{ selectedScopeLabel }}</strong><span>当前社区</span></div>
        <div class="hero-metric"><strong>{{ listings.length }}</strong><span>条可见帖子</span></div>
        <div class="hero-metric"><strong>{{ appState.categories.length || 11 }}</strong><span>个闲置分类</span></div>
      </div>
    </section>

    <section class="card section search-section">
      <div class="row wrap search-row">
        <select class="select search-district" v-model="filters.district_code" @change="handleDistrictChange">
          <option value="">全部区县</option>
          <option v-for="item in districtOptions" :key="item.code" :value="item.code">{{ item.name }}{{ item.city_name ? ' · ' + item.city_name : '' }}</option>
        </select>
        <input class="input search-input" v-model.trim="filters.keyword" placeholder="搜手机、书桌、自行车、求购需求..." @keydown.enter="loadListings" />
        <button class="btn btn-dark search-button" @click="loadListings">搜索</button>
      </div>
      <div class="district-scope-row">
        <select class="select district-scope-select" v-model="filters.province_code" @change="handleProvinceChange">
          <option value="">全部省份</option>
          <option v-for="item in provinceOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
        </select>
        <select class="select district-scope-select" v-model="filters.city_code" @change="handleCityChange">
          <option value="">全部城市</option>
          <option v-for="item in cityOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
        </select>
        <div class="district-scope-hint">已按省 / 市 / 区县三级分类，当前有 {{ districtOptions.length }} 个可选区县</div>
      </div>
      <div class="home-category-strip">
        <button v-for="category in featuredCategories" :key="category.id" type="button" class="category-pill" :class="{ active: filters.category_id === category.id }" @click="setCategory(category.id)">
          <span class="category-pill-icon">{{ category.icon }}</span>
          <span>{{ category.name }}</span>
        </button>
        <router-link class="category-pill more" to="/categories">全部分类</router-link>
      </div>
    </section>

    <section class="card section section-compact">
      <div class="segment-tabs">
        <button class="segment-tab" :class="{ active: filters.listing_type === 'all' }" @click="setListingType('all')">全部</button>
        <button class="segment-tab" :class="{ active: filters.listing_type === 'sale' }" @click="setListingType('sale')">在售</button>
        <button class="segment-tab" :class="{ active: filters.listing_type === 'wanted' }" @click="setListingType('wanted')">求购</button>
      </div>
      <div class="section-caption">当前社区：{{ selectedScopeLabel }} <span>· {{ listings.length }} 条结果</span></div>
    </section>

    <section v-if="loading" class="card section muted">正在加载帖子...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else class="listing-grid listing-grid-home">
      <article v-for="item in listings" :key="item.id" class="card listing-item listing-item-clickable" @click="openListing(item)">
        <img v-if="item.image_urls && item.image_urls[0]" class="listing-cover" :src="item.image_urls[0]" alt="" />
        <div v-else class="listing-cover listing-cover-empty">暂无图片</div>
        <div class="listing-body">
          <div class="listing-headline">
            <span class="badge" :class="item.listing_type">{{ formatListingType(item.listing_type) }}</span>
            <span class="badge subtle">{{ categoryNameOf(item) }}</span>
          </div>
          <div class="listing-title">{{ item.title }}</div>
          <div class="listing-meta"><span>{{ item.district_name || '未设置区县' }}</span><span>{{ formatRelativeTime(item.created_at) }}</span></div>
          <div class="listing-price-row"><div class="price">{{ formatPrice(item.price) }}</div><div class="listing-stats">{{ formatCompactNumber(item.view_count || 0) }} 浏览</div></div>
          <div class="listing-seller-row">
            <div class="seller-mini"><span class="seller-mini-avatar">{{ getAvatarText(item.seller_nickname) }}</span><span>{{ item.seller_nickname || '本地卖家' }}</span></div>
            <button class="btn btn-primary btn-mini" @click.stop="openChat(item)">聊一聊</button>
          </div>
        </div>
      </article>

      <div v-if="!listings.length" class="card empty-state">
        <h3>这个分类区域暂时没有匹配帖子</h3>
        <p>你可以切换省份、城市、区县或分类筛选，也可以自己先发一个新帖。</p>
        <router-link class="btn btn-primary" to="/publish">去发布</router-link>
      </div>
    </section>
  `,
};
const CategoryPage = {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const listings = ref([]);
    const activeCategoryId = ref("");

    const activeCategory = computed(
      () => findCategory(activeCategoryId.value) || appState.categories[0] || FALLBACK_CATEGORIES[0],
    );

    async function loadListings() {
      if (!activeCategoryId.value) {
        listings.value = [];
        return;
      }
      loading.value = true;
      errorText.value = "";
      try {
        const query = new URLSearchParams({
          category_id: activeCategoryId.value,
          page: "1",
          page_size: "50",
        });
        const data = await apiRequest(`/api/web/listings?${query.toString()}`, { auth: false });
        listings.value = Array.isArray(data.items) ? data.items : [];
      } catch (error) {
        errorText.value = error.message || "加载分类内容失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function syncActiveCategory() {
      const routeCategory = String(route.query.category || "").trim();
      activeCategoryId.value = routeCategory || appState.categories[0]?.id || FALLBACK_CATEGORIES[0].id;
    }

    function chooseCategory(category) {
      router.replace({ path: "/categories", query: { category: category.id } });
    }

    function openListing(item) {
      router.push(`/listing/${encodeURIComponent(item.id)}`);
    }

    onMounted(async () => {
      await ensureCategories();
      syncActiveCategory();
      await loadListings();
    });

    watch(
      () => route.query.category,
      async () => {
        syncActiveCategory();
        await loadListings();
      },
    );

    return {
      appState,
      loading,
      errorText,
      listings,
      activeCategoryId,
      activeCategory,
      chooseCategory,
      openListing,
      formatPrice,
      formatRelativeTime,
    };
  },
  template: `
    <section class="category-layout">
      <aside class="card category-sidebar">
        <div class="category-sidebar-title">全部分类</div>
        <button v-for="category in appState.categories" :key="category.id" type="button" class="category-menu-item" :class="{ active: category.id === activeCategoryId }" @click="chooseCategory(category)">
          <span class="category-menu-icon">{{ category.icon }}</span>
          <span>{{ category.name }}</span>
        </button>
      </aside>

      <section class="card category-content">
        <div class="category-hero">
          <div class="category-hero-icon">{{ activeCategory.icon }}</div>
          <div>
            <h2>{{ activeCategory.name }}</h2>
            <p>{{ activeCategory.description || '本地社区里与该分类相关的闲置和求购帖子。' }}</p>
          </div>
        </div>

        <div v-if="loading" class="category-placeholder muted">正在加载分类帖子...</div>
        <div v-else-if="errorText" class="category-placeholder error">{{ errorText }}</div>
        <div v-else-if="!listings.length" class="category-placeholder">
          <h3>这个分类还没有帖子</h3>
          <p>可以先去发一条，也可以切换其他分类看看。</p>
          <router-link class="btn btn-primary" to="/publish">去发布</router-link>
        </div>
        <div v-else class="listing-grid category-listing-grid">
          <article v-for="item in listings" :key="item.id" class="card listing-item listing-item-clickable" @click="openListing(item)">
            <img v-if="item.image_urls && item.image_urls[0]" class="listing-cover" :src="item.image_urls[0]" alt="" />
            <div v-else class="listing-cover listing-cover-empty">暂无图片</div>
            <div class="listing-body">
              <div class="listing-title">{{ item.title }}</div>
              <div class="listing-meta"><span>{{ item.district_name || '未设置区县' }}</span><span>{{ formatRelativeTime(item.created_at) }}</span></div>
              <div class="listing-price-row"><div class="price">{{ formatPrice(item.price) }}</div></div>
            </div>
          </article>
        </div>
      </section>
    </section>
  `,
};
const ListingDetailPage = {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const detail = ref(null);
    const selectedImage = ref("");
    const descriptionExpanded = ref(false);
    const isFavorited = ref(false);
    let galleryTimer = null;

    const galleryImages = computed(() => collectListingImages(detail.value));
    const previewImage = computed(
      () => selectedImage.value || galleryImages.value[0] || "",
    );

    const categoryInfo = computed(() => findCategory(detail.value?.category_id));
    const selectedImageIndex = computed(() => {
      if (!galleryImages.value.length) {
        return 0;
      }
      const index = galleryImages.value.indexOf(selectedImage.value);
      return index >= 0 ? index : 0;
    });

    const visibleDescription = computed(() => {
      const text = String(detail.value?.description || "").trim();
      if (!text) return "发布者暂未补充更详细的描述。";
      if (descriptionExpanded.value || text.length <= 180) return text;
      return `${text.slice(0, 180)}...`;
    });

    async function loadDetail() {
      loading.value = true;
      errorText.value = "";
      try {
        const data = await apiRequest(`/api/web/listings/${encodeURIComponent(route.params.id)}`);
        detail.value = data;
        const images = collectListingImages(data);
        selectedImage.value = images[0] || "";

        let favorited = Boolean(data?.is_favorited);
        const listingId = String(data?.id || "").trim();
        if (appState.token && listingId && !favorited) {
          try {
            const favoriteIds = await ensureFavoriteListingIds();
            favorited = favoriteIds.includes(listingId);
          } catch (error) {
            // ignore favorite lookup failure
          }
        }
        isFavorited.value = favorited;
      } catch (error) {
        errorText.value = error.message || "加载详情失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function selectImage(url) {
      selectedImage.value = url;
      restartAutoPlay();
    }

    function showPrevImage() {
      if (!galleryImages.value.length) {
        return;
      }
      const prevIndex =
        (selectedImageIndex.value - 1 + galleryImages.value.length) % galleryImages.value.length;
      selectedImage.value = galleryImages.value[prevIndex];
      restartAutoPlay();
    }

    function showNextImage() {
      if (!galleryImages.value.length) {
        return;
      }
      const nextIndex = (selectedImageIndex.value + 1) % galleryImages.value.length;
      selectedImage.value = galleryImages.value[nextIndex];
      restartAutoPlay();
    }

    function stopAutoPlay() {
      if (galleryTimer) {
        window.clearInterval(galleryTimer);
        galleryTimer = null;
      }
    }

    function startAutoPlay() {
      stopAutoPlay();
      if (galleryImages.value.length <= 1) {
        return;
      }
      galleryTimer = window.setInterval(() => {
        const nextIndex = (selectedImageIndex.value + 1) % galleryImages.value.length;
        selectedImage.value = galleryImages.value[nextIndex];
      }, 3200);
    }

    function restartAutoPlay() {
      startAutoPlay();
    }

    async function openChat() {
      if (!detail.value) return;
      if (!appState.token) {
        router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
        return;
      }
      try {
        const data = await apiRequest("/api/web/conversations/open", {
          method: "POST",
          body: { listing_id: detail.value.id },
        });
        router.push(`/messages/${encodeURIComponent(data.id)}`);
      } catch (error) {
        window.alert(error.message || "发起聊天失败，请稍后重试。");
      }
    }

    function placeOrder() {
      window.alert("担保支付入口已预留，当前版本先保留购买按钮位置。");
    }

    async function toggleFavorite() {
      if (!appState.token) {
        router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
        return;
      }

      if (!detail.value?.id) {
        return;
      }

      try {
        const data = await apiRequest("/api/web/favorites/toggle", {
          method: "POST",
          body: { listing_id: detail.value.id },
        });
        isFavorited.value = Boolean(data?.favorited);
        syncFavoriteListingCache(detail.value.id, isFavorited.value);
      } catch (error) {
        window.alert(error.message || "收藏失败，请稍后再试。");
      }
    }

    onMounted(async () => {
      await ensureCategories();
      await loadDetail();
      startAutoPlay();
    });

    onBeforeUnmount(() => {
      stopAutoPlay();
    });

    watch(galleryImages, () => {
      if (!galleryImages.value.length) {
        selectedImage.value = "";
      } else if (!galleryImages.value.includes(selectedImage.value)) {
        selectedImage.value = galleryImages.value[0];
      }
      startAutoPlay();
    });

    return {
      loading,
      errorText,
      detail,
      selectedImage,
      galleryImages,
      previewImage,
      selectedImageIndex,
      categoryInfo,
      visibleDescription,
      descriptionExpanded,
      isFavorited,
      selectImage,
      showPrevImage,
      showNextImage,
      openChat,
      placeOrder,
      toggleFavorite,
      formatPrice,
      formatCompactNumber,
      formatRelativeTime,
      formatListingType,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">正在加载详情...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="detail-shell">
      <div class="detail-main-grid">
        <div class="card detail-gallery-card">
          <div class="detail-gallery-wrap">
            <div class="detail-thumbs" v-if="galleryImages.length || previewImage">
              <button v-for="imageUrl in (galleryImages.length ? galleryImages : [previewImage])" :key="imageUrl" type="button" class="detail-thumb" :class="{ active: previewImage === imageUrl }" @click="selectImage(imageUrl)">
                <img :src="imageUrl" alt="" />
              </button>
            </div>
            <div class="detail-main-preview" :class="{ 'single-image': galleryImages.length <= 1 }">
              <button v-if="galleryImages.length > 1" type="button" class="detail-main-nav prev" @click="showPrevImage">‹</button>
              <img v-if="previewImage" :src="previewImage" alt="" />
              <button v-if="galleryImages.length > 1" type="button" class="detail-main-nav next" @click="showNextImage">›</button>
              <div v-if="galleryImages.length" class="detail-gallery-counter">{{ selectedImageIndex + 1 }} / {{ galleryImages.length }}</div>
              <div v-if="previewImage" class="detail-zoom-tip">{{ galleryImages.length > 1 ? '商品图自动轮播中，可左右切换' : '当前仅 1 张商品图，左侧可预览' }}</div>
              <div v-else class="detail-preview-empty">暂无图片</div>
            </div>
          </div>
          <div class="detail-trust-strip"><span>担保交易</span><span>区县见面</span><span>先聊后买</span></div>
        </div>

        <div class="card detail-summary-card">
          <div class="detail-meta-line">
            <div class="detail-price-group"><span class="detail-price">{{ formatPrice(detail.price) }}</span><span class="detail-price-note">{{ detail.listing_type === 'wanted' ? '预算' : '可聊' }}</span></div>
            <div class="detail-stats"><span>{{ formatCompactNumber(detail.contact_count || 0) }} 人联系</span><span>{{ formatCompactNumber(detail.view_count || 0) }} 浏览</span></div>
          </div>
          <div class="detail-service-strip"><span>区县社区 · {{ detail.district_name || '未设置区县' }}</span><span>类型 · {{ formatListingType(detail.listing_type) }}</span></div>
          <div class="detail-title-row">
            <span class="badge" :class="detail.listing_type">{{ formatListingType(detail.listing_type) }}</span>
            <span class="badge subtle" v-if="categoryInfo">{{ categoryInfo.icon }} {{ categoryInfo.name }}</span>
          </div>
          <h1 class="detail-title">{{ detail.title }}</h1>
          <div class="detail-seller-card">
            <div class="detail-seller-avatar">{{ detail.seller_nickname ? detail.seller_nickname.slice(0, 2) : '卖家' }}</div>
            <div>
              <div class="detail-seller-name">{{ detail.seller_nickname || '本地卖家' }}</div>
              <div class="detail-seller-subline">{{ detail.city_name || '本地城市' }} · {{ formatRelativeTime(detail.updated_at || detail.created_at) }} 更新</div>
            </div>
          </div>
          <div class="detail-description">
            <p>{{ visibleDescription }}</p>
            <button v-if="detail.description && detail.description.length > 180" type="button" class="detail-expand" @click="descriptionExpanded = !descriptionExpanded">{{ descriptionExpanded ? '收起' : '展开' }}</button>
          </div>
          <div class="detail-action-bar">
            <button class="detail-chat-btn" @click="openChat">聊一聊</button>
            <button class="detail-buy-btn" @click="placeOrder">立即购买</button>
            <button class="detail-fav-btn" :class="{ active: isFavorited }" @click="toggleFavorite">{{ isFavorited ? '已收藏' : '收藏' }}</button>
          </div>
        </div>
      </div>
    </section>
  `,
};
const PublishPage = {
  setup() {
    const router = useRouter();
    const form = reactive({
      listing_type: "sale",
      title: "",
      description: "",
      price: "",
      district_code: "",
      category_id: "cat-11",
      image_input: "",
      image_urls: [],
    });
    const submitting = ref(false);
    const errorText = ref("");
    const successText = ref("");

    function addImage() {
      const imageUrl = String(form.image_input || "").trim();
      if (!imageUrl) {
        errorText.value = "璇峰厛杈撳叆鍥剧墖閾炬帴銆?;"
        return;
      }
      if (!isValidUrl(imageUrl)) {
        errorText.value = "鍥剧墖閾炬帴蹇呴』鏄?http 鎴?https 鍦板潃銆?;"
        return;
      }
      if (form.image_urls.includes(imageUrl)) {
        errorText.value = "杩欏紶鍥剧墖宸茬粡娣诲姞杩囦簡銆?;"
        return;
      }
      if (form.image_urls.length >= 6) {
        errorText.value = "鏈€澶氫笂浼?6 寮犲浘鐗囥€?;"
        return;
      }
      form.image_urls.push(imageUrl);
      form.image_input = "";
      errorText.value = "";
    }

    function removeImage(index) {
      form.image_urls.splice(index, 1);
    }

    async function submit() {
      errorText.value = "";
      successText.value = "";
      if (!form.title.trim() || !form.description.trim() || !form.district_code) {
        errorText.value = "鏍囬銆佹弿杩板拰鍖哄幙涓嶈兘涓虹┖銆?;"
        return;
      }
      if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
        errorText.value = "璇疯緭鍏ュ悎娉曚环鏍笺€?;"
        return;
      }

      submitting.value = true;
      try {
        const result = await apiRequest("/api/web/listings", {
          method: "POST",
          body: {
            listing_type: form.listing_type,
            title: form.title.trim(),
            description: form.description.trim(),
            price: Number(form.price || 0),
            district_code: form.district_code,
            category_id: form.category_id || "cat-11",
            image_urls: [...form.image_urls],
          },
        });
        successText.value = `鍙戝竷鎴愬姛锛屽綋鍓嶇姸鎬侊細${formatReviewStatus(result.status)}`;
        form.title = "";
        form.description = "";
        form.price = "";
        form.district_code = "";
        form.category_id = "cat-11";
        form.image_input = "";
        form.image_urls = [];
        window.setTimeout(() => router.push("/me"), 1200);
      } catch (error) {
        errorText.value = error.message || "鍙戝竷澶辫触锛岃绋嶅悗閲嶈瘯銆?;"
      } finally {
        submitting.value = false;
      }
    }

    onMounted(async () => {
      await Promise.all([ensureDistricts(), ensureCategories()]);
    });

    return {
      appState,
      form,
      submitting,
      errorText,
      successText,
      addImage,
      removeImage,
      submit,
    };
  },
  template: `
    <section class="publish-shell">
      <div class="card publish-card">
        <div class="publish-header">
          <div>
            <div class="publish-eyebrow">鍙戝竷甯栧瓙</div>
            <h1>鍙傝€冧豢闂查奔鐨勫彂甯栨祦绋嬶紝鏀规垚绀惧尯 Web 琛ㄥ崟</h1>
          </div>
          <div class="publish-switch">
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'sale' }" @click="form.listing_type = 'sale'">鍑哄敭</button>
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'wanted' }" @click="form.listing_type = 'wanted'">姹傝喘</button>
          </div>
        </div>
        <div class="publish-grid">
          <div class="publish-main">
            <div class="field"><label>鏍囬</label><input class="input" v-model.trim="form.title" placeholder="渚嬪锛氫節鎴愭柊鏄剧ず鍣ㄣ€佹湰鍦版眰璐効绔ュ骇妞? /></div>
            <div class="field">
              <label>鎻忚堪</label>
              <textarea class="textarea publish-textarea" v-model.trim="form.description" placeholder="鍐欐竻妤氭垚鑹层€佷娇鐢ㄦ儏鍐点€佽闈㈣寖鍥淬€佹槸鍚︽敮鎸佸悓鍩庢垨閭瘎銆?></textarea>
              <div class="field-tip">鍓╀綑 {{ 800 - form.description.length }} 瀛?/div>
            </div>
            <div class="field">
              <label>鍥剧墖閾炬帴锛堟渶澶?6 寮狅級</label>
              <div class="publish-image-input"><input class="input" v-model.trim="form.image_input" placeholder="绮樿创涓€寮犲浘鐗囧湴鍧€鍚庣偣鍑绘坊鍔? /><button class="btn btn-dark" type="button" @click="addImage">娣诲姞</button></div>
              <div class="publish-image-grid">
                <div class="publish-image-card publish-image-empty" v-if="!form.image_urls.length">杩樻病鏈夊浘鐗囷紝鍙互鍏堝彂绾枃瀛楀笘銆?/div>
                <div class="publish-image-card" v-for="(imageUrl, index) in form.image_urls" :key="imageUrl">
                  <img :src="imageUrl" alt="" />
                  <button type="button" class="publish-image-remove" @click="removeImage(index)">鍒犻櫎</button>
                </div>
              </div>
            </div>
          </div>
          <div class="publish-side">
            <div class="field"><label>浠锋牸</label><input class="input" type="number" min="0" v-model="form.price" placeholder="0.00" /></div>
            <div class="field">
              <label>鍖哄幙绀惧尯</label>
              <select class="select" v-model="form.district_code">
                <option value="">璇烽€夋嫨鍖哄幙</option>
                <option v-for="item in appState.districts" :key="item.code" :value="item.code">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>鍒嗙被</label>
              <select class="select" v-model="form.category_id">
                <option v-for="item in appState.categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.name }}</option>
              </select>
            </div>
            <div class="publish-tip-card">
              <h3>鍙戝竷寤鸿</h3>
              <p>鍑哄敭甯栦紭鍏堟斁瀹炴媿鍥撅紝姹傝喘甯栧彲浠ユ斁鍙傝€冨浘銆佽亰澶╂埅鍥炬垨鍨嬪彿鍥俱€?/p>
              <p>濡傛灉鏄悓鍩庨潰瀵归潰浜ゆ槗锛屽缓璁湪鎻忚堪閲屽啓娓呮鍖哄幙銆佹椂闂村拰瑙侀潰鏂瑰紡銆?/p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary publish-submit" :disabled="submitting" @click="submit">{{ submitting ? '鎻愪氦涓?..' : '鎻愪氦瀹℃牳' }}</button>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <div class="success" v-if="successText">{{ successText }}</div>
      </div>
    </section>
  `,
};

const EnhancedPublishPage = {
  setup() {
    const router = useRouter();
    const form = reactive({
      listing_type: "sale",
      title: "",
      description: "",
      price: "",
      province_code: "",
      city_code: "",
      district_code: "",
      category_id: "cat-11",
      image_urls: [],
    });
    const submitting = ref(false);
    const errorText = ref("");
    const successText = ref("");
    const uploadInputRef = ref(null);
    const selectedImages = ref([]);
    const canAddMoreImages = computed(() => selectedImages.value.length < 9);
    const provinceOptions = computed(() => getProvinceOptions(appState.districts));
    const cityOptions = computed(() => getCityOptions(appState.districts, form.province_code));
    const districtOptions = computed(() =>
      getDistrictOptions(appState.districts, {
        province_code: form.province_code,
        city_code: form.city_code,
      }),
    );
    const selectedDistrictPath = computed(() => getDistrictPathLabel(form.district_code));

    function normalizePublishImageFile(file) {
      if (!file) return null;
      const lowerName = String(file.name || "").toLowerCase();
      const normalizedType = file.type || (
        lowerName.endsWith(".png")
          ? "image/png"
          : lowerName.endsWith(".webp")
            ? "image/webp"
            : lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".jfif") ||
                lowerName.endsWith(".pjp")
              ? "image/jpeg"
              : ""
      );

      if (!normalizedType || normalizedType === file.type) {
        return file;
      }

      return new File([file], file.name || `publish-${Date.now()}`, {
        type: normalizedType,
        lastModified: file.lastModified || Date.now(),
      });
    }

    function validatePublishImageFile(file) {
      if (!file) {
        throw new Error("请选择图片后再上传。");
      }
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/pjpeg",
        "image/png",
        "image/webp",
      ];
      const lowerName = String(file.name || "").toLowerCase();
      const allowedByExtension =
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".jfif") ||
        lowerName.endsWith(".pjp") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".webp");

      if (!allowedTypes.includes(file.type) && !allowedByExtension) {
        throw new Error("仅支持 jpg、png、webp 图片。");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("图片不能超过 10MB。");
      }
    }

    function revokePublishPreview(url) {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }

    function clearSelectedImages() {
      selectedImages.value.forEach((item) => revokePublishPreview(item.preview_url));
      selectedImages.value = [];
    }

    function buildPublishImageItem(file) {
      return {
        id: `publish-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview_url: URL.createObjectURL(file),
        status: "ready",
        error: "",
      };
    }

    function queuePublishFiles(fileList, source = "picker") {
      const files = Array.from(fileList || [])
        .map((file) => normalizePublishImageFile(file))
        .filter(Boolean);

      if (!files.length) {
        return;
      }

      errorText.value = "";
      successText.value = "";
      const remain = 9 - selectedImages.value.length;
      if (remain <= 0) {
        errorText.value = "最多上传 9 张图片。";
        return;
      }

      const acceptedFiles = files.slice(0, remain);
      if (acceptedFiles.length < files.length) {
        errorText.value = "最多上传 9 张图片，多余图片已忽略。";
      }

      try {
        acceptedFiles.forEach((file) => {
          validatePublishImageFile(file);
          const duplicate = selectedImages.value.some(
            (item) =>
              item.file.name === file.name &&
              item.file.size === file.size &&
              item.file.lastModified === file.lastModified,
          );
          if (!duplicate) {
            selectedImages.value.push(buildPublishImageItem(file));
          }
        });
        if (source === "paste" && selectedImages.value.length) {
          successText.value = "图片已粘贴，提交时会统一上传。";
        }
      } catch (error) {
        errorText.value = error.message || "图片添加失败，请重试。";
      }
    }

    function openImagePicker() {
      if (!canAddMoreImages.value) {
        errorText.value = "最多上传 9 张图片。";
        return;
      }
      if (uploadInputRef.value) {
        uploadInputRef.value.value = "";
        uploadInputRef.value.click();
      }
    }

    function handleImageSelection(event) {
      queuePublishFiles(event?.target?.files || [], "picker");
      if (event?.target) {
        event.target.value = "";
      }
    }

    function handlePaste(event) {
      const clipboardItems = Array.from(event?.clipboardData?.items || []);
      const imageItems = clipboardItems.filter((item) => item.type && item.type.startsWith("image/"));
      if (!imageItems.length) {
        return;
      }
      event.preventDefault();
      queuePublishFiles(imageItems.map((item) => item.getAsFile()).filter(Boolean), "paste");
    }

    function removeImage(index) {
      const [removed] = selectedImages.value.splice(index, 1);
      revokePublishPreview(removed?.preview_url);
    }

    function handleProvinceChange() {
      if (!cityOptions.value.some((item) => item.code === form.city_code)) {
        form.city_code = "";
      }
      if (!districtOptions.value.some((item) => item.code === form.district_code)) {
        form.district_code = "";
      }
    }

    function handleCityChange() {
      if (!districtOptions.value.some((item) => item.code === form.district_code)) {
        form.district_code = "";
      }
    }

    function handleDistrictChange() {
      if (form.district_code) {
        syncDistrictScope(form, form.district_code, appState.districts);
      }
    }

    async function uploadListingImage(file) {
      const endpoints = ["/api/web/uploads/listing", "/api/web/uploads/chat"];
      let lastError = null;

      for (const endpoint of endpoints) {
        const formData = new FormData();
        formData.append("image", file, file.name || `listing-${Date.now()}.png`);
        try {
          return await apiRequest(endpoint, {
            method: "POST",
            body: formData,
          });
        } catch (error) {
          lastError = error;
          const message = String(error?.message || "");
          const canFallback =
            endpoint === "/api/web/uploads/listing" &&
            (message.includes("404") || message.includes("无法解析") || message.includes("页面不存在"));
          if (!canFallback) {
            throw error;
          }
        }
      }

      throw lastError || new Error("图片上传失败，请稍后重试。");
    }

    async function submit() {
      errorText.value = "";
      successText.value = "";
      if (!form.title.trim() || !form.description.trim() || !form.district_code) {
        errorText.value = "标题、描述和区县不能为空。";
        return;
      }
      if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
        errorText.value = "请输入合法价格。";
        return;
      }

      submitting.value = true;
      try {
        const uploadedImageUrls = [];
        for (let index = 0; index < selectedImages.value.length; index += 1) {
          const imageItem = selectedImages.value[index];
          selectedImages.value.splice(index, 1, {
            ...imageItem,
            status: "uploading",
            error: "",
          });
          try {
            const uploaded = await uploadListingImage(imageItem.file);
            uploadedImageUrls.push(String(uploaded?.url || "").trim());
            selectedImages.value.splice(index, 1, {
              ...selectedImages.value[index],
              status: "uploaded",
              error: "",
            });
          } catch (error) {
            selectedImages.value.splice(index, 1, {
              ...selectedImages.value[index],
              status: "failed",
              error: error.message || "上传失败",
            });
            throw error;
          }
        }

        const result = await apiRequest("/api/web/listings", {
          method: "POST",
          body: {
            listing_type: form.listing_type,
            title: form.title.trim(),
            description: form.description.trim(),
            price: Number(form.price || 0),
            district_code: form.district_code,
            category_id: form.category_id || "cat-11",
            image_urls: uploadedImageUrls,
          },
        });
        successText.value = `发布成功，当前状态：${formatReviewStatus(result.status)}`;
        form.title = "";
        form.description = "";
        form.price = "";
        form.province_code = "";
        form.city_code = "";
        form.district_code = "";
        form.category_id = "cat-11";
        form.image_urls = [];
        clearSelectedImages();
        window.setTimeout(() => router.push("/me"), 1200);
      } catch (error) {
        errorText.value = error.message || "发布失败，请稍后重试。";
      } finally {
        submitting.value = false;
      }
    }

    onMounted(async () => {
      await Promise.all([ensureDistricts(), ensureCategories()]);
      document.addEventListener("paste", handlePaste);
    });

    onBeforeUnmount(() => {
      document.removeEventListener("paste", handlePaste);
      clearSelectedImages();
    });

    return {
      appState,
      canAddMoreImages,
      cityOptions,
      districtOptions,
      errorText,
      form,
      handleImageSelection,
      handleProvinceChange,
      handleCityChange,
      handleDistrictChange,
      openImagePicker,
      provinceOptions,
      removeImage,
      selectedImages,
      selectedDistrictPath,
      submit,
      submitting,
      successText,
      uploadInputRef,
    };
  },
  template: `
    <section class="publish-shell">
      <div class="card publish-card">
        <div class="publish-header">
          <div>
            <div class="publish-eyebrow">发布帖子</div>
            <h1>参考仿闲鱼的发帖流程，改成社区 Web 表单</h1>
          </div>
          <div class="publish-switch">
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'sale' }" @click="form.listing_type = 'sale'">出售</button>
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'wanted' }" @click="form.listing_type = 'wanted'">求购</button>
          </div>
        </div>
        <div class="publish-grid">
          <div class="publish-main">
            <div class="field"><label>标题</label><input class="input" v-model.trim="form.title" placeholder="例如：九成新显示器、本地求购儿童座椅" /></div>
            <div class="field">
              <label>描述</label>
              <textarea class="textarea publish-textarea" v-model.trim="form.description" placeholder="写清成色、使用情况、见面范围、是否支持同城或邮寄。"></textarea>
              <div class="field-tip">剩余 {{ 800 - form.description.length }} 字</div>
            </div>
            <div class="field">
              <label>图片（最多 9 张，第一张作为首页封面）</label>
              <div class="publish-image-input">
                <div class="publish-image-count">已选 {{ selectedImages.length }}/9 张，可一次多选，也可以继续添加</div>
                <button class="btn btn-dark" type="button" :disabled="submitting || !canAddMoreImages" @click="openImagePicker">选择图片</button>
                <div class="muted">支持 jpg/png/webp，也支持 Ctrl+V 粘贴图片</div>
                <input
                  ref="uploadInputRef"
                  class="publish-upload-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/pjpeg,image/png,image/webp,.jpg,.jpeg,.jfif,.pjp,.png,.webp"
                  multiple
                  @change="handleImageSelection"
                />
              </div>
              <div v-if="selectedImages.length" class="publish-image-toolbar">
                <div class="publish-image-summary">已选 {{ selectedImages.length }} 张，第一张会作为首页封面</div>
                <button type="button" class="btn btn-ghost publish-image-more" :disabled="submitting || !canAddMoreImages" @click="openImagePicker">
                  {{ canAddMoreImages ? '继续添加' : '已达上限' }}
                </button>
              </div>
              <div class="publish-image-grid publish-image-grid-nine">
                <div class="publish-image-card publish-image-empty" v-if="!selectedImages.length">还没有图片，可以先发纯文字帖，也可以直接 Ctrl+V 粘贴截图。</div>
                <div class="publish-image-card" v-for="(imageItem, index) in selectedImages" :key="imageItem.id">
                  <img :src="imageItem.preview_url" alt="" />
                  <div class="publish-image-badge" v-if="index === 0">首页封面</div>
                  <div class="publish-image-status" :class="imageItem.status">{{ imageItem.status === 'uploading' ? '上传中' : imageItem.status === 'uploaded' ? '已上传' : imageItem.status === 'failed' ? '失败' : '待上传' }}</div>
                  <div class="publish-image-error" v-if="imageItem.error">{{ imageItem.error }}</div>
                  <button type="button" class="publish-image-remove" @click="removeImage(index)">删除</button>
                </div>
              </div>
            </div>
          </div>
          <div class="publish-side">
            <div class="field"><label>价格</label><input class="input" type="number" min="0" v-model="form.price" placeholder="0.00" /></div>
            <div class="field">
              <label>省份分类</label>
              <select class="select" v-model="form.province_code" @change="handleProvinceChange">
                <option value="">请选择省份</option>
                <option v-for="item in provinceOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>城市分类</label>
              <select class="select" v-model="form.city_code" @change="handleCityChange">
                <option value="">请选择城市</option>
                <option v-for="item in cityOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>区县社区</label>
              <select class="select" v-model="form.district_code" @change="handleDistrictChange">
                <option value="">请选择区县</option>
                <option v-for="item in districtOptions" :key="item.code" :value="item.code">{{ item.name }}{{ item.city_name ? ' · ' + item.city_name : '' }}</option>
              </select>
              <div class="publish-district-summary">{{ selectedDistrictPath }}</div>
            </div>
            <div class="field">
              <label>分类</label>
              <select class="select" v-model="form.category_id">
                <option v-for="item in appState.categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.name }}</option>
              </select>
            </div>
            <div class="publish-tip-card">
              <h3>发布建议</h3>
              <p>区县已经按省份和城市分组，先选省市，再选区县，录入会更快。</p>
              <p>出售帖优先放实拍图，求购帖可以放参考图、聊天截图或型号图。</p>
              <p>如果是同城面交，建议在描述里写清楚区县、时间和见面方式。</p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary publish-submit" :disabled="submitting" @click="submit">{{ submitting ? '提交中...' : '提交审核' }}</button>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <div class="success" v-if="successText">{{ successText }}</div>
      </div>
    </section>
  `,
};
const MessagesPage = {
  setup() {
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const items = ref([]);

    async function loadConversations() {
      loading.value = true;
      errorText.value = "";
      try {
        const data = await apiRequest("/api/web/conversations");
        items.value = Array.isArray(data) ? data : [];
      } catch (error) {
        errorText.value = error.message || "加载会话失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function openDetail(item) {
      router.push(`/messages/${encodeURIComponent(item.id)}`);
    }

    onMounted(loadConversations);

    return {
      loading,
      errorText,
      items,
      openDetail,
      formatPrice,
      formatRelativeTime,
      getAvatarText,
    };
  },
  template: `
    <section class="message-index">
      <div class="message-warning card">如遇到明显低价、要求站外沟通、要求直接打款等情况，请谨慎交易。</div>

      <section v-if="loading" class="card section muted">正在加载会话...</section>
      <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
      <section v-else class="message-list">
        <article v-for="item in items" :key="item.id" class="card message-item" @click="openDetail(item)">
          <div class="message-avatar">{{ getAvatarText(item.peer_nickname) }}</div>
          <div class="message-main">
            <div class="message-row"><strong>{{ item.peer_nickname || '对方' }}</strong><span class="muted">{{ formatRelativeTime(item.updated_at) }}</span></div>
            <div class="message-subline">{{ item.listing_title }}</div>
            <div class="message-row"><span class="muted">{{ item.last_message || '还没有消息，先聊聊细节吧。' }}</span><span class="message-unread" v-if="item.unread_count">{{ item.unread_count }}</span></div>
          </div>
          <img v-if="item.listing_image" class="message-thumb" :src="item.listing_image" alt="" />
          <div v-else class="message-thumb message-thumb-empty">{{ formatPrice(item.listing_price) }}</div>
        </article>

        <div v-if="!items.length" class="card empty-state">
          <h3>还没有会话</h3>
          <p>从商品详情点一下“聊一聊”，会话就会出现在这里。</p>
          <router-link class="btn btn-primary" to="/">去逛首页</router-link>
        </div>
      </section>
    </section>
  `,
};
const MessageDetailPage = {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const detail = ref(null);
    const messages = ref([]);
    const inputText = ref("");
    const sending = ref(false);
    const panelRef = ref(null);

    const myName = computed(() => getUserDisplayName(appState.user));
    const peerName = computed(() => detail.value?.peer_nickname || "瀵规柟");

    async function scrollToBottom() {
      await nextTick();
      if (panelRef.value) {
        panelRef.value.scrollTop = panelRef.value.scrollHeight;
      }
    }

    async function loadData() {
      loading.value = true;
      errorText.value = "";
      try {
        const conversationId = encodeURIComponent(route.params.id);
        const [conversation, list] = await Promise.all([
          apiRequest(`/api/web/conversations/${conversationId}`),
          apiRequest(`/api/web/conversations/${conversationId}/messages`),
        ]);
        detail.value = conversation;
        messages.value = Array.isArray(list) ? list : [];
        await markConversationRead();
        connectSocket();
        await scrollToBottom();
      } catch (error) {
        errorText.value = error.message || "鍔犺浇鑱婂ぉ璇︽儏澶辫触銆?;"
      } finally {
        loading.value = false;
      }
    }

    function isMine(message) {
      return message.sender_openid === appState.user?.openid;
    }

    async function sendMessage() {
      const content = String(inputText.value || "").trim();
      if (!content || !detail.value || sending.value) {
        return;
      }

      sending.value = true;
      try {
        const created = await apiRequest(`/api/web/conversations/${encodeURIComponent(detail.value.id)}/messages`, {
          method: "POST",
          body: { content },
        });
        messages.value.push(created);
        inputText.value = "";
        await scrollToBottom();
      } catch (error) {
        window.alert(error.message || "鍙戦€佸け璐ャ€?");
      } finally {
        sending.value = false;
      }
    }

    function openListing() {
      if (detail.value?.listing?.id) {
        router.push(`/listing/${encodeURIComponent(detail.value.listing.id)}`);
      }
    }

    function placeOrder() {
      window.alert("鎷呬繚鏀粯鍏ュ彛宸查鐣欙紝褰撳墠鐗堟湰鍏堜繚鐣欒喘涔版寜閽綅缃€?");
    }

    function useTool(label) {
      window.alert(`${label} 鍔熻兘宸查鐣欙紝涓嬩竴姝ュ彲浠ョ户缁帴鍥剧墖銆佷綅缃垨璁㈠崟鍗＄墖銆俙`);
    }

    function handleImageSelection(event) {
      queueComposerFiles(event?.target?.files || [], "picker");
      if (event?.target) {
        event.target.value = "";
      }
    }

    async function captureScreenshot() {
      if (sending.value) return;

      if (!navigator.mediaDevices?.getDisplayMedia) {
        setComposerMessage("褰撳墠娴忚鍣ㄤ笉鏀寔鎴浘鎺堟潈锛岃鐩存帴 Ctrl+V 绮樿创鎴浘銆?。", "error");
        return;
      }

      let stream;
      try {
        setComposerMessage("璇峰湪娴忚鍣ㄦ巿鏉冨悗閫夋嫨瑕佹埅鍙栫殑绐楀彛鎴栧睆骞?..");
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("娌℃湁鑾峰彇鍒板睆骞曠敾闈€?");
        }

        let blob = null;
        if (typeof ImageCapture !== "undefined") {
          const imageCapture = new ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        } else {
          const video = document.createElement("video");
          video.srcObject = stream;
          video.muted = true;
          await video.play();
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d");
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
          video.pause();
          video.srcObject = null;
        }

        if (!blob) {
          throw new Error("鎴浘鐢熸垚澶辫触锛岃閲嶈瘯銆?");
        }

        const file = new File([blob], `screencapture-${Date.now()}.png`, { type: "image/png" });
        queueComposerFiles([file], "capture");
      } catch (error) {
        const isAbort = error?.name === "NotAllowedError" || error?.name === "AbortError";
        setComposerMessage(
          isAbort
            ? "鎴浘鏈巿鏉冿紝浣犱篃鍙互鐩存帴 Ctrl+V 绮樿创鎴浘鍙戦€併€?"
            : error.message || "鎴浘澶辫触锛岃鏀圭敤绮樿创鍥剧墖銆?",
          "error",
        );
      } finally {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    }

    async function handlePaste(event) {
      const clipboardItems = Array.from(event?.clipboardData?.items || []);
      const imageItems = clipboardItems.filter((item) => item.type && item.type.startsWith("image/"));
      if (!imageItems.length) return;

      event.preventDefault();
      try {
        const files = imageItems.map((item) => normalizeImageFile(item.getAsFile())).filter(Boolean);
        if (!files.length) {
          throw new Error("鍓创鏉垮浘鐗囪鍙栧け璐ワ紝璇烽噸璇曘€?");
        }
        queueComposerFiles(files, "paste");
      } catch (error) {
        setComposerMessage(error.message || "绮樿创鍥剧墖澶辫触锛岃閲嶈瘯銆?。", "error");
      }
    }

    function handleEnterSend(event) {
      if (event && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)) {
        return;
      }
      if (pendingComposerImages.value.length) {
        event?.preventDefault();
        return;
      }
      requestSend("enter");
    }

    onMounted(loadData);

    return {
      loading,
      errorText,
      detail,
      messages,
      inputText,
      sending,
      panelRef,
      myName,
      peerName,
      isMine,
      sendMessage,
      openListing,
      placeOrder,
      useTool,
      formatPrice,
      formatDateTime,
      getAvatarText,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">姝ｅ湪鍔犺浇鑱婂ぉ...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="chat-shell">
      <header class="chat-topbar card">
        <div class="chat-peer">
          <div class="chat-peer-avatar">{{ getAvatarText(peerName) }}</div>
          <div><h1>{{ peerName }}</h1><p>{{ detail.peer_openid || '鏈湴绀惧尯鐢ㄦ埛' }}</p></div>
        </div>
        <button class="btn btn-ghost" @click="placeOrder">绔嬪嵆璐拱</button>
      </header>

      <section class="chat-product-bar card">
        <div class="chat-product-info" @click="openListing">
          <img v-if="detail.listing && detail.listing.image_urls && detail.listing.image_urls[0]" class="chat-product-image" :src="detail.listing.image_urls[0]" alt="" />
          <div v-else class="chat-product-image chat-product-image-empty">鏃犲浘</div>
          <div>
            <div class="chat-product-title">{{ detail.listing?.title || '鍟嗗搧宸蹭笅鏋? }}</div>
            <div class="chat-product-price">{{ formatPrice(detail.listing?.price || 0) }}</div>
            <div class="chat-product-note">浜ゆ槗鍓嶅厛鑱婁竴鑱婏紝纭鍖哄幙涓庨潰浜ゆ柟寮忋€?/div>
          </div>
        </div>
      </section>

      <section ref="panelRef" class="chat-panel card">
        <div class="chat-history">
          <div v-for="message in messages" :key="message.id" class="chat-message-block">
            <div class="chat-message-time">{{ formatDateTime(message.created_at) }}</div>
            <div class="chat-message-row" :class="{ mine: isMine(message) }">
              <div class="chat-avatar" v-if="!isMine(message)">{{ getAvatarText(peerName) }}</div>
              <div class="chat-bubble" :class="{ mine: isMine(message) }">{{ message.content }}</div>
              <div class="chat-avatar mine" v-if="isMine(message)">{{ getAvatarText(myName) }}</div>
            </div>
          </div>
        </div>
      </section>

      <footer class="chat-composer card">
        <div class="chat-tool-row">
          <button type="button" class="chat-tool" @click="useTool('鍥剧墖')">鍥剧墖</button>
          <button type="button" class="chat-tool" @click="useTool('鎴浘')">鎴浘</button>
          <button type="button" class="chat-tool" @click="useTool('璁㈠崟')">璁㈠崟</button>
          <button type="button" class="chat-tool" @click="useTool('浣嶇疆')">浣嶇疆</button>
        </div>
        <div class="chat-input-row">
          <input class="input chat-input" v-model="inputText" placeholder="杈撳叆娑堟伅锛屾寜 Enter 鍙戦€? @keydown.enter="sendMessage" />
          <button class="btn btn-primary chat-send" :disabled="sending" @click="sendMessage">{{ sending ? '鍙戦€佷腑...' : '鍙戦€? }}</button>
        </div>
      </footer>
    </section>
  `,
};

const EnhancedMessageDetailPage = {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const detail = ref(null);
    const messages = ref([]);
    const inputText = ref("");
    const sending = ref(false);
    const panelRef = ref(null);

    const myName = computed(() => getUserDisplayName(appState.user));
    const peerName = computed(() => detail.value?.peer_nickname || "对方");

    async function scrollToBottom() {
      await nextTick();
      if (panelRef.value) {
        panelRef.value.scrollTop = panelRef.value.scrollHeight;
      }
    }

    async function markConversationRead() {
      if (!detail.value?.id) return;
      try {
        await apiRequest(`/api/web/conversations/${encodeURIComponent(detail.value.id)}/read`, {
          method: "POST",
          body: {},
        });
      } catch (error) {
        // Ignore read-state sync failures.
      }
    }

    async function loadData() {
      loading.value = true;
      errorText.value = "";
      try {
        const conversationId = encodeURIComponent(route.params.id);
        const [conversation, list] = await Promise.all([
          apiRequest(`/api/web/conversations/${conversationId}`),
          apiRequest(`/api/web/conversations/${conversationId}/messages`),
        ]);
        detail.value = conversation;
        messages.value = Array.isArray(list) ? list : [];
        await markConversationRead();
        await scrollToBottom();
      } catch (error) {
        errorText.value = error.message || "加载聊天详情失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function isMine(message) {
      return message?.sender_openid === appState.user?.openid;
    }

    function getMessageImageUrl(message) {
      if (!message) return "";
      const raw = String(message.image_url || message.content || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) {
        return raw;
      }
      return raw.startsWith("/") ? raw : `/${raw}`;
    }

    async function sendMessage() {
      const content = String(inputText.value || "").trim();
      if (!content || !detail.value || sending.value) {
        return;
      }

      sending.value = true;
      try {
        const created = await apiRequest(`/api/web/conversations/${encodeURIComponent(detail.value.id)}/messages`, {
          method: "POST",
          body: { content },
        });
        if (created && !messages.value.some((item) => item.id === created.id)) {
          messages.value.push(created);
        }
        inputText.value = "";
        await scrollToBottom();
      } catch (error) {
        window.alert(error.message || "发送失败，请稍后重试。");
      } finally {
        sending.value = false;
      }
    }

    function openListing() {
      if (detail.value?.listing?.id) {
        router.push(`/listing/${encodeURIComponent(detail.value.listing.id)}`);
      }
    }

    function placeOrder() {
      window.alert("担保支付入口已预留，当前版本先保留购买按钮位置。");
    }

    onMounted(loadData);
    watch(
      () => route.params.id,
      (nextId, previousId) => {
        if (nextId && nextId !== previousId) {
          loadData();
        }
      },
    );

    return {
      loading,
      errorText,
      detail,
      messages,
      inputText,
      sending,
      panelRef,
      myName,
      peerName,
      isMine,
      getMessageImageUrl,
      sendMessage,
      openListing,
      placeOrder,
      formatPrice,
      formatDateTime,
      getAvatarText,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">正在加载聊天...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="chat-shell">
      <header class="chat-topbar card">
        <div class="chat-peer">
          <div class="chat-peer-avatar">{{ getAvatarText(peerName) }}</div>
          <div>
            <h1>{{ peerName }}</h1>
            <p>{{ detail.peer_openid || '本地社区用户' }}</p>
          </div>
        </div>
        <button class="btn btn-ghost" @click="placeOrder">立即购买</button>
      </header>

      <section class="chat-product-bar card">
        <div class="chat-product-info" @click="openListing">
          <img
            v-if="detail.listing && detail.listing.image_urls && detail.listing.image_urls[0]"
            class="chat-product-image"
            :src="detail.listing.image_urls[0]"
            alt=""
          />
          <div v-else class="chat-product-image chat-product-image-empty">无图</div>
          <div>
            <div class="chat-product-title">{{ detail.listing?.title || '商品已下架' }}</div>
            <div class="chat-product-price">{{ formatPrice(detail.listing?.price || 0) }}</div>
            <div class="chat-product-note">交易前先聊清区县、成色与见面方式。</div>
          </div>
        </div>
      </section>

      <section ref="panelRef" class="chat-panel card">
        <div class="chat-history">
          <div v-for="message in messages" :key="message.id || message.created_at" class="chat-message-block">
            <div class="chat-message-time">{{ formatDateTime(message.created_at) }}</div>
            <div class="chat-message-row" :class="{ mine: isMine(message) }">
              <div class="chat-avatar" v-if="!isMine(message)">{{ getAvatarText(peerName) }}</div>

              <div class="chat-bubble" :class="{ mine: isMine(message), 'chat-bubble-image': !!getMessageImageUrl(message) && message.message_type === 'image' }">
                <img
                  v-if="message.message_type === 'image' && getMessageImageUrl(message)"
                  class="chat-message-image"
                  :src="getMessageImageUrl(message)"
                  alt="聊天图片"
                />
                <template v-else>{{ message.content || '（空消息）' }}</template>
              </div>

              <div class="chat-avatar mine" v-if="isMine(message)">{{ getAvatarText(myName) }}</div>
            </div>
          </div>
        </div>
      </section>

      <footer class="chat-composer card">
        <div class="chat-input-row">
          <input
            class="input chat-input"
            v-model="inputText"
            placeholder="输入消息，按 Enter 发送"
            @keydown.enter="sendMessage"
          />
          <button class="btn btn-primary chat-send" :disabled="sending" @click="sendMessage">
            {{ sending ? '发送中...' : '发送' }}
          </button>
        </div>
      </footer>
    </section>
  `,
};


const ProfilePage = {
  setup() {
    const router = useRouter();
    const loading = ref(false);
    const errorText = ref("");
    const myListings = ref([]);
    const conversations = ref([]);
    const actionLoadingId = ref("");

    const saleCount = computed(
      () => myListings.value.filter((item) => item.listing_type === "sale" && item.status === "approved").length,
    );
    const wantedCount = computed(
      () => myListings.value.filter((item) => item.listing_type === "wanted" && item.status === "approved").length,
    );

    async function loadData() {
      loading.value = true;
      errorText.value = "";
      try {
        const [listingData, conversationData] = await Promise.all([
          apiRequest("/api/web/me/listings"),
          apiRequest("/api/web/conversations"),
        ]);
        myListings.value = Array.isArray(listingData) ? listingData : [];
        conversations.value = Array.isArray(conversationData) ? conversationData : [];
      } catch (error) {
        errorText.value = error.message || "加载个人中心失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function openMyMessages() {
      router.push("/messages");
    }

    function openPublish() {
      router.push("/publish");
    }

    function openFavorites() {
      router.push("/favorites");
    }

    function openListing(item) {
      router.push(`/listing/${encodeURIComponent(item.id)}`);
    }

    async function toggleListingStatus(item) {
      if (!item?.id || actionLoadingId.value) {
        return;
      }

      const nextStatus = item.status === "off_shelf" ? "approved" : "off_shelf";
      actionLoadingId.value = item.id;
      errorText.value = "";
      try {
        const updated = await apiRequest(`/api/web/me/listings/${encodeURIComponent(item.id)}/status`, {
          method: "PATCH",
          body: { status: nextStatus },
        });
        myListings.value = myListings.value.map((listing) =>
          listing.id === item.id
            ? {
                ...listing,
                status: updated?.status || nextStatus,
                review_status: updated?.review_status || updated?.status || nextStatus,
                updated_at: updated?.updated_at || Date.now(),
              }
            : listing,
        );
      } catch (error) {
        errorText.value = error.message || "更新帖子状态失败，请稍后重试。";
      } finally {
        actionLoadingId.value = "";
      }
    }

    function logout() {
      clearAuth();
      myListings.value = [];
      conversations.value = [];
      router.replace("/login");
    }

    function showComingSoon(label) {
      window.alert(`${label} 入口已预留，下一步可以继续补订单、收藏和售后模块。`);
    }

    onMounted(loadData);

    return {
      appState,
      loading,
      errorText,
      myListings,
      conversations,
      actionLoadingId,
      saleCount,
      wantedCount,
      openMyMessages,
      openPublish,
      openFavorites,
      openListing,
      toggleListingStatus,
      logout,
      showComingSoon,
      formatPrice,
      formatRelativeTime,
      formatReviewStatus,
      getAvatarText,
    };
  },
  template: `
    <section class="profile-shell">
      <div class="card profile-hero">
        <div class="profile-main">
          <div class="profile-avatar">{{ getAvatarText(appState.user?.nickname || appState.user?.account) }}</div>
          <div>
            <h1>{{ appState.user?.nickname || '本地用户' }}</h1>
            <p>账号：{{ appState.user?.account || appState.user?.openid }}</p>
            <p>当前角色：{{ appState.user?.role || 'user' }}</p>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-ghost" @click="openMyMessages">我的消息</button>
          <button class="btn btn-primary" @click="openPublish">去发布</button>
        </div>
      </div>

      <div class="profile-stat-row">
        <div class="card profile-stat"><strong>{{ myListings.length }}</strong><span>我的帖子</span></div>
        <div class="card profile-stat"><strong>{{ saleCount }}</strong><span>在售</span></div>
        <div class="card profile-stat"><strong>{{ wantedCount }}</strong><span>求购</span></div>
        <div class="card profile-stat"><strong>{{ conversations.length }}</strong><span>会话</span></div>
      </div>

      <section class="card profile-menu">
        <button class="profile-menu-item" @click="openMyMessages"><span>💬</span><span>我的消息</span></button>
        <button class="profile-menu-item" @click="openFavorites"><span>⭐</span><span>我的收藏</span></button>
        <button class="profile-menu-item" @click="showComingSoon('我的订单')"><span>🧾</span><span>我的订单</span></button>
        <button class="profile-menu-item" @click="showComingSoon('我卖出的')"><span>🏷️</span><span>我卖出的</span></button>
      </section>

      <section class="card section">
        <div class="section-title-row">
          <h2>我发布的帖子</h2>
          <button class="btn btn-ghost btn-mini" @click="logout">退出登录</button>
        </div>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <div v-if="loading" class="muted">正在加载...</div>
        <div v-else-if="!myListings.length" class="empty-inline">你还没有发布记录，先去发一个出售帖或求购帖。</div>
        <div v-else class="profile-listing-list">
          <article class="profile-listing-item" v-for="item in myListings" :key="item.id" @click="openListing(item)">
            <div class="profile-listing-main">
              <div class="profile-listing-title">{{ item.title }}</div>
              <div class="profile-listing-meta"><span>{{ formatPrice(item.price) }}</span><span>{{ formatRelativeTime(item.created_at) }}</span></div>
            </div>
            <div class="profile-listing-actions">
              <span class="badge subtle profile-listing-status">{{ formatReviewStatus(item.status) }}</span>
              <button
                v-if="item.status === 'approved' || item.status === 'off_shelf'"
                type="button"
                class="btn btn-ghost btn-mini profile-listing-toggle"
                :disabled="actionLoadingId === item.id"
                @click.stop="toggleListingStatus(item)"
              >
                {{ actionLoadingId === item.id ? '处理中...' : item.status === 'off_shelf' ? '重新上架' : '下架' }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
  `,
};
const FavoritesPage = {
  setup() {
    const router = useRouter();
    const loading = ref(false);
    const togglingId = ref("");
    const errorText = ref("");
    const listings = ref([]);

    async function loadFavorites() {
      loading.value = true;
      errorText.value = "";
      try {
        const data = await apiRequest("/api/web/favorites/listings?page=1&page_size=100");
        listings.value = Array.isArray(data?.items) ? data.items : [];
      } catch (error) {
        errorText.value = error.message || "加载收藏失败，请稍后重试。";
      } finally {
        loading.value = false;
      }
    }

    function openListing(item) {
      if (!item?.id) {
        return;
      }
      router.push(`/listing/${encodeURIComponent(item.id)}`);
    }

    async function openChat(item) {
      if (!item?.id) {
        return;
      }
      if (!appState.token) {
        router.push(`/login?redirect=${encodeURIComponent(`/listing/${item.id}`)}`);
        return;
      }
      try {
        const data = await apiRequest("/api/web/conversations/open", {
          method: "POST",
          body: { listing_id: item.id },
        });
        router.push(`/messages/${encodeURIComponent(data.id)}`);
      } catch (error) {
        window.alert(error.message || "发起聊天失败，请稍后重试。");
      }
    }

    async function cancelFavorite(item) {
      if (!item?.id || togglingId.value) {
        return;
      }
      togglingId.value = item.id;
      try {
        const data = await apiRequest("/api/web/favorites/toggle", {
          method: "POST",
          body: { listing_id: item.id },
        });
        syncFavoriteListingCache(item.id, Boolean(data?.favorited));
        if (!data?.favorited) {
          listings.value = listings.value.filter((entry) => entry.id !== item.id);
        }
      } catch (error) {
        window.alert(error.message || "取消收藏失败，请稍后重试。");
      } finally {
        togglingId.value = "";
      }
    }

    onMounted(loadFavorites);

    return {
      loading,
      togglingId,
      errorText,
      listings,
      openListing,
      openChat,
      cancelFavorite,
      formatPrice,
      formatCompactNumber,
      formatRelativeTime,
      formatListingType,
      getAvatarText,
    };
  },
  template: `
    <section class="favorites-shell">
      <section class="card section">
        <div class="section-title-row">
          <h2>我的收藏</h2>
          <router-link class="btn btn-ghost btn-mini" to="/me">返回个人中心</router-link>
        </div>
        <div class="muted favorites-subline">收藏后可以更快回到商品详情，继续联系卖家。</div>
      </section>

      <section v-if="loading" class="card section muted">正在加载收藏...</section>
      <section v-else-if="errorText" class="card section error">{{ errorText }}</section>

      <section v-else-if="listings.length" class="listing-grid listing-grid-home">
        <article
          v-for="item in listings"
          :key="item.id"
          class="card listing-item listing-item-clickable"
          @click="openListing(item)"
        >
          <img v-if="item.image_urls && item.image_urls[0]" class="listing-cover" :src="item.image_urls[0]" alt="" />
          <div v-else class="listing-cover listing-cover-empty">暂无图片</div>
          <div class="listing-body">
            <div class="listing-headline">
              <span class="badge" :class="item.listing_type">{{ formatListingType(item.listing_type) }}</span>
              <span class="badge subtle">已收藏</span>
            </div>
            <div class="listing-title">{{ item.title }}</div>
            <div class="listing-meta">
              <span>{{ item.district_name || '未设置区县' }}</span>
              <span>{{ formatRelativeTime(item.updated_at || item.created_at) }}</span>
            </div>
            <div class="listing-price-row">
              <div class="price">{{ formatPrice(item.price) }}</div>
              <div class="listing-stats">{{ formatCompactNumber(item.view_count || 0) }} 浏览</div>
            </div>
            <div class="listing-seller-row">
              <div class="seller-mini">
                <span class="seller-mini-avatar">{{ getAvatarText(item.seller_nickname) }}</span>
                <span>{{ item.seller_nickname || '本地卖家' }}</span>
              </div>
              <div class="favorites-actions">
                <button class="btn btn-ghost btn-mini" :disabled="togglingId === item.id" @click.stop="cancelFavorite(item)">
                  {{ togglingId === item.id ? '处理中...' : '取消收藏' }}
                </button>
                <button class="btn btn-primary btn-mini" @click.stop="openChat(item)">聊一聊</button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="card empty-state">
        <h3>你还没有收藏商品</h3>
        <p>去首页逛逛，点一下商品详情里的“收藏”，这里就会出现记录。</p>
        <router-link class="btn btn-primary" to="/">去首页</router-link>
      </section>
    </section>
  `,
};
const routes = [
  { path: "/", component: HomePage },
  { path: "/categories", component: CategoryPage },
  { path: "/listing/:id", component: ListingDetailPage },
  { path: "/login", component: LoginPage },
  { path: "/register", component: RegisterPage },
  { path: "/publish", component: EnhancedPublishPage, meta: { auth: true } },
  { path: "/messages", component: MessagesPage, meta: { auth: true } },
  { path: "/messages/:id", component: EnhancedMessageDetailPage, meta: { auth: true } },
  { path: "/me", component: ProfilePage, meta: { auth: true } },
  { path: "/favorites", component: FavoritesPage, meta: { auth: true } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  ensureDistricts().catch(() => {});
  ensureCategories().catch(() => {});

  if (to.meta?.auth && !appState.token) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`;
  }

  if ((to.path === "/login" || to.path === "/register") && appState.token) {
    return "/me";
  }

  return true;
});

const AppRoot = {
  setup() {
    const route = useRoute();

    const currentTab = computed(() => {
      if (route.path.startsWith("/categories")) return "categories";
      if (route.path.startsWith("/publish")) return "publish";
      if (route.path.startsWith("/messages")) return "messages";
      if (route.path.startsWith("/favorites")) return "me";
      if (route.path.startsWith("/me")) return "me";
      return "home";
    });

    const immersiveLayout = computed(
      () => route.path.startsWith("/messages/") || route.path.startsWith("/listing/"),
    );
    const authLayout = computed(
      () => route.path.startsWith("/login") || route.path.startsWith("/register"),
    );

    return { appState, currentTab, immersiveLayout, authLayout, getUserDisplayName };
  },
  template: `
    <div class="app-shell" :class="{ immersive: immersiveLayout, auth: authLayout }">
      <header v-if="!immersiveLayout && !authLayout" class="topbar">
        <div>
          <div class="brand">本地闲置</div>
          <div class="brand-subline">区县社区二手 · 仿闲鱼 Web 版</div>
        </div>
        <div class="user-pill">{{ getUserDisplayName(appState.user) }}</div>
      </header>

      <router-view />

      <nav v-if="!immersiveLayout && !authLayout" class="footer-nav">
        <router-link to="/" :class="{ active: currentTab === 'home' }">首页</router-link>
        <router-link to="/categories" :class="{ active: currentTab === 'categories' }">分类</router-link>
        <router-link class="footer-publish" to="/publish" :class="{ active: currentTab === 'publish' }">发布</router-link>
        <router-link to="/messages" :class="{ active: currentTab === 'messages' }">消息</router-link>
        <router-link to="/me" :class="{ active: currentTab === 'me' }">我的</router-link>
      </nav>
    </div>
  `,
};
async function bootstrap() {
  setupPointerSparkles();

  if (appState.token) {
    await refreshMe();
  }

  await Promise.all([ensureDistricts().catch(() => {}), ensureCategories().catch(() => {})]);

  const app = createApp(AppRoot);
  app.use(router);
  app.mount("#app");

  if (typeof window.__LOCAL_TRADER_APP_READY__ === "function") {
    window.__LOCAL_TRADER_APP_READY__();
  }
}

bootstrap();









