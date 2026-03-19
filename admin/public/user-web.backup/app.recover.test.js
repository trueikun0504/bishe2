const { createApp, reactive, ref, computed, onMounted, onBeforeUnmount, watch, nextTick } = window.Vue;
const { createRouter, createWebHashHistory, useRoute, useRouter } = window.VueRouter;

const STORAGE_TOKEN_KEY = "LOCAL_TRADER_WEB_TOKEN";
const STORAGE_USER_KEY = "LOCAL_TRADER_WEB_USER";

const FALLBACK_CATEGORIES = [
  { id: "cat-1", name: "手机数码", icon: "📱", description: "手机、平板��数码配�? "},
  { id: "cat-2", name: "电脑办公", icon: "💻", description: "笔记本��显示器、办公外�? "},
  { id: "cat-3", name: "家居家电", icon: "🏠", description: "小家电��家具��租房好�? "},
  { id: "cat-4", name: "服饰鞋包", icon: "👟", description: "衣服、鞋靴��背包配�? "},
  { id: "cat-5", name: "美妆个护", icon: "💄", description: "彩妆、护肤��个人护�? "},
  { id: "cat-6", name: "母婴用品", icon: "🍼", description: "母婴、儿童成长用�? "},
  { id: "cat-7", name: "家居日用", icon: "🪑", description: "日用百货、家居收�? "},
  { id: "cat-8", name: "运动户外", icon: "🚴", description: "露营、骑行��运动器�? "},
  { id: "cat-9", name: "图书文玩", icon: "📚", description: "图书、乐器��文创周�? "},
  { id: "cat-10", name: "车品骑行", icon: "🚗", description: "电动车��自行车、车�? "},
  { id: "cat-11", name: "其他闲置", icon: "🧩", description: "本地社区其他闲置" },
];

const HERO_BANNERS = [
  {
    eyebrow: "区县社区二手",
    title: "先看本区县，再决定聊不聊、见不见",
    text: "参��?weapp-fangxianyu 的结构，把首页��分类��发布��聊天和个人中心统一�?Web 端��?",
  },
  {
    eyebrow: "求购也能�?",
    title: "出售帖和求购帖共用一套交易入�?",
    text: "区县筛����分类浏览��聊天会话��后台审核和客服协同都保留��?",
  },
  {
    eyebrow: "担保支付预留",
    title: "商品先聊再买，支付按钮保留给后续支付网关接入",
    text: "当前先把交易链路和页面结构完整跑通，后续再接真实支付�?",
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
    return `${Number.isInteger(compact) ? compact : compact.toFixed(1)}��`;
  }
  return String(number);
}

function formatListingType(value) {
  return value === "wanted" ? "求购" : "在售";
}

function formatReviewStatus(value) {
  const map = {
    off_shelf: "已下�?",
    pending_review: "待审�?",
    approved: "已��过",
    rejected: "已驳�?",
    sold: "已售�?",
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
    return `${Math.floor(diff / (60 * 1000))} ����ǰ`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))} Сʱǰ`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} ��ǰ`;
  }
  return formatDateTime(timestamp);
}

function getUserDisplayName(user) {
  return user?.nickname || user?.account || user?.openid || "δ��¼";
}

function getAvatarText(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 2) : "����";
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
        name: String(item.name || fallback.name || "其他"),
        icon: String(item.icon || fallback.icon || "🧩"),
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
  const map = new Map();
  for (const item of districts || []) {
    if (!item?.province_code || map.has(item.province_code)) {
      continue;
    }
    map.set(item.province_code, {
      code: item.province_code,
      name: item.province_name || item.province_code,
    });
  }
  return Array.from(map.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

function getCityOptions(districts, provinceCode = "") {
  const provinceValue = String(provinceCode || "").trim();
  const map = new Map();
  for (const item of districts || []) {
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
  return Array.from(map.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

function getDistrictOptions(districts, scope = {}) {
  const provinceCode = String(scope.province_code || "").trim();
  const cityCode = String(scope.city_code || "").trim();
  return (districts || [])
    .filter((item) => (provinceCode ? item.province_code === provinceCode : true))
    .filter((item) => (cityCode ? item.city_code === cityCode : true))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
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
    return "未��择区县";
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
        message: `���񷵻����޷����������ݣ�${response.status} ${contentType || "unknown"}����`,
      };
    }
  })();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `请求失败，状态码 ${response.status}`);
  }

  return payload.data;
}

async function ensureDistricts() {
  if (appState.loadingDistricts || appState.districts.length) {
    return appState.districts;
  }
  appState.loadingDistricts = true;
  try {
    const data = await apiRequest("/api/web/districts", { auth: false });
    appState.districts = normalizeDistricts(data);
    return appState.districts;
  } finally {
    appState.loadingDistricts = false;
  }
}

async function ensureCategories() {
  if (appState.loadingCategories || appState.categories.length) {
    return appState.categories;
  }
  appState.loadingCategories = true;
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
  }
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
        errorText.value = "�������˺ź����롣";
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
        errorText.value = error.message || "��¼ʧ�ܣ������ԡ�";
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
          <p>参��?weapp-fangxianyu 的用户链路，改成�?Web 端交易入口��?/p>
        </div>
        <div class="field">
          <label>账号</label>
          <input class="input" v-model.trim="form.account" placeholder="例如 seller-002 �?buyer-demo-001" />
        </div>
        <div class="field">
          <label>密码</label>
          <input class="input" type="password" v-model="form.password" placeholder="请输入密�? />
        </div>
        <div class="actions auth-fill-actions">
          <button class="btn btn-ghost" type="button" @click="fillDemoAccount('seller-002')">填充 seller-002</button>
          <button class="btn btn-ghost" type="button" @click="fillDemoAccount('buyer-demo-001')">填充 buyer-demo-001</button>
        </div>
        <button class="btn btn-primary auth-submit" :disabled="submitting" @click="submit">
          {{ submitting ? '登录�?..' : '登录' }}
        </button>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <p class="auth-footnote">没有账号�?router-link to="/register">去注�?/router-link></p>
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
        errorText.value = "请输入用户名�?;"
        return;
      }
      if (!form.password) {
        errorText.value = "请输入密码��?;"
        return;
      }
      if (form.password.length < 6) {
        errorText.value = "密码长度至少 6 位��?;"
        return;
      }
      if (form.password !== form.confirmPassword) {
        errorText.value = "两次输入的密码不丢�致��?;"
        return;
      }
      if (form.avatar_url && !isValidUrl(form.avatar_url)) {
        errorText.value = "头像链接必须�?http �?https 地址�?;"
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
        errorText.value = error.message || "注册失败，请重试�?;"
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
          <div class="auth-badge">新用户注�?/div>
          <h1>创建本地闲置账号</h1>
          <p>注册后即可发布出售帖、求购帖，并发起聊天会话�?/p>
        </div>
        <div class="field">
          <label>用户�?/label>
          <input class="input" v-model.trim="form.username" placeholder="3-30 位字母��数字或短横�? />
        </div>
        <div class="field">
          <label>昵称</label>
          <input class="input" v-model.trim="form.nickname" placeholder="留空则自动生成昵�? />
        </div>
        <div class="field">
          <label>头像链接</label>
          <input class="input" v-model.trim="form.avatar_url" placeholder="可��，http(s) 图片地址" />
        </div>
        <div class="field">
          <label>密码</label>
          <input class="input" type="password" v-model="form.password" placeholder="至少 6 �? />
        </div>
        <div class="field">
          <label>确认密码</label>
          <input class="input" type="password" v-model="form.confirmPassword" placeholder="再次输入密码" />
        </div>
        <button class="btn btn-primary auth-submit" :disabled="submitting" @click="submit">
          {{ submitting ? '注册�?..' : '注册并登�? }}
        </button>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <p class="auth-footnote">已有账号�?router-link to="/login">返回登录</router-link></p>
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
    const selectedDistrict = computed(
      () => findDistrictByCode(filters.district_code),
    );
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
        errorText.value = error.message || "加载帖子失败，请稍后重试�?;"
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
        window.alert(error.message || "发起聊天失败�?");
      }
    }

    function categoryNameOf(item) {
      return findCategory(item.category_id)?.name || "其他闲置";
    }

    onMounted(async () => {
      await Promise.all([ensureDistricts(), ensureCategories()]);
      await loadListings();
      window.setInterval(() => {
        bannerIndex.value = (bannerIndex.value + 1) % HERO_BANNERS.length;
      }, 5000);
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
        <div class="hero-metric"><strong>{{ listings.length }}</strong><span>条可见帖�?/span></div>
        <div class="hero-metric"><strong>{{ appState.categories.length || 11 }}</strong><span>个闲置分�?/span></div>
      </div>
    </section>

    <section class="card section search-section">
      <div class="row wrap search-row">
        <select class="select search-district" v-model="filters.district_code" @change="handleDistrictChange">
          <option value="">全部区县</option>
          <option v-for="item in districtOptions" :key="item.code" :value="item.code">{{ item.name }}{{ item.city_name ? ' �� ' + item.city_name : '' }}</option>
        </select>
        <input class="input search-input" v-model.trim="filters.keyword" placeholder="搜手机��书桌��自行车、求购需�?.." @keydown.enter="loadListings" />
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
        <div class="district-scope-hint">已按�?/�?/区县三级分类，当�?{{ districtOptions.length }} 个可选区�?/div>
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
      <div class="section-caption">��ǰ������{{ selectedScopeLabel }} <span>�� {{ listings.length }} �����</span></div>
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
          <div class="listing-meta"><span>{{ item.district_name || '未设置区�? }}</span><span>{{ formatRelativeTime(item.created_at) }}</span></div>
          <div class="listing-price-row"><div class="price">{{ formatPrice(item.price) }}</div><div class="listing-stats">{{ formatCompactNumber(item.view_count || 0) }} 浏览</div></div>
          <div class="listing-seller-row">
            <div class="seller-mini"><span class="seller-mini-avatar">{{ getAvatarText(item.seller_nickname) }}</span><span>{{ item.seller_nickname || '本地卖家' }}</span></div>
            <button class="btn btn-primary btn-mini" @click.stop="openChat(item)">聊一�?/button>
          </div>
        </div>
      </article>

      <div v-if="!listings.length" class="card empty-state">
        <h3>�������������ʱû��ƥ������</h3>
        <p>������л�ʡ�ݡ����С����ػ����ɸѡ��Ҳ�����Լ��ȷ�һ��������</p>
        <router-link class="btn btn-primary" to="/publish">ȥ����</router-link>
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
        errorText.value = error.message || "加载分类内容失败�?;"
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
            <p>{{ activeCategory.description || '本地社区里与该分类相关的闲置和求购帖�? }}</p>
          </div>
        </div>

        <div v-if="loading" class="category-placeholder muted">正在加载分类帖子...</div>
        <div v-else-if="errorText" class="category-placeholder error">{{ errorText }}</div>
        <div v-else-if="!listings.length" class="category-placeholder">
          <h3>这个分类还没有帖�?/h3>
          <p>可以先去发布丢�条，也可以切换其他分类看看��?/p>
          <router-link class="btn btn-primary" to="/publish">去发�?/router-link>
        </div>
        <div v-else class="listing-grid category-listing-grid">
          <article v-for="item in listings" :key="item.id" class="card listing-item listing-item-clickable" @click="openListing(item)">
            <img v-if="item.image_urls && item.image_urls[0]" class="listing-cover" :src="item.image_urls[0]" alt="" />
            <div v-else class="listing-cover listing-cover-empty">暂无图片</div>
            <div class="listing-body">
              <div class="listing-title">{{ item.title }}</div>
              <div class="listing-meta"><span>{{ item.district_name || '未设置区�? }}</span><span>{{ formatRelativeTime(item.created_at) }}</span></div>
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
    const imageZoomed = ref(false);
    const descriptionExpanded = ref(false);
    const isFavorited = ref(false);

    const galleryImages = computed(() => {
      const images = Array.isArray(detail.value?.image_urls) ? detail.value.image_urls.filter(Boolean) : [];
      return images.length ? images : (detail.value?.cover_image_url ? [detail.value.cover_image_url] : []);
    });

    const categoryInfo = computed(() => findCategory(detail.value?.category_id));

    const visibleDescription = computed(() => {
      const text = String(detail.value?.description || "").trim();
      if (!text) return "发布者暂未补充更详细的描述��?;"
      if (descriptionExpanded.value || text.length <= 180) return text;
      return `${text.slice(0, 180)}...`;
    });

    async function loadDetail() {
      loading.value = true;
      errorText.value = "";
      try {
        const data = await apiRequest(`/api/web/listings/${encodeURIComponent(route.params.id)}`);
        detail.value = data;
        selectedImage.value = data?.image_urls?.[0] || data?.cover_image_url || "";
        imageZoomed.value = false;

        let favorited = Boolean(data?.is_favorited);
        const listingId = String(data?.id || "").trim();
        if (appState.token && listingId && !favorited) {
          try {
            const favoriteData = await apiRequest("/api/web/favorites");
            const favoriteIds = Array.isArray(favoriteData?.listing_ids)
              ? favoriteData.listing_ids
              : [];
            favorited = favoriteIds.includes(listingId);
          } catch (error) {
            // Ignore favorite lookup failure and keep detail response value.
          }
        }
        isFavorited.value = favorited;
      } catch (error) {
        errorText.value = error.message || "加载详情失败�?;"
      } finally {
        loading.value = false;
      }
    }

    function selectImage(url) {
      selectedImage.value = url;
      imageZoomed.value = false;
    }

    function toggleImageZoom() {
      if (!selectedImage.value) {
        return;
      }
      imageZoomed.value = !imageZoomed.value;
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
        window.alert(error.message || "发起聊天失败�?");
      }
    }

    function placeOrder() {
      window.alert("担保支付入口已预留，下一步可接微信支付或第三方担保支付��?");
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
      } catch (error) {
        window.alert(error.message || "收藏失败，请稍后再试�?");
      }
    }

    onMounted(async () => {
      await ensureCategories();
      await loadDetail();
    });

    return {
      loading,
      errorText,
      detail,
      selectedImage,
      imageZoomed,
      galleryImages,
      categoryInfo,
      visibleDescription,
      descriptionExpanded,
      selectImage,
      toggleImageZoom,
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
            <div class="detail-thumbs" v-if="galleryImages.length > 1">
              <button v-for="imageUrl in galleryImages" :key="imageUrl" type="button" class="detail-thumb" :class="{ active: selectedImage === imageUrl }" @click="selectImage(imageUrl)">
                <img :src="imageUrl" alt="" />
              </button>
            </div>
            <div class="detail-main-preview" :class="{ zoomed: imageZoomed }">
              <img v-if="selectedImage" :src="selectedImage" alt="" @click="toggleImageZoom" />
              <div v-if="selectedImage" class="detail-zoom-tip">{{ imageZoomed ? 'Click image to reset' : 'Click image to zoom' }}</div>
              <div v-else class="detail-preview-empty">暂无图片</div>
            </div>
          </div>
          <div class="detail-trust-strip"><span>担保交易</span><span>区县见面</span><span>先聊后买</span></div>
        </div>

        <div class="card detail-summary-card">
          <div class="detail-meta-line">
            <div class="detail-price-group"><span class="detail-price">{{ formatPrice(detail.price) }}</span><span class="detail-price-note">{{ detail.listing_type === 'wanted' ? '预算' : '可聊' }}</span></div>
            <div class="detail-stats"><span>{{ formatCompactNumber(detail.contact_count || 0) }} 人联�?/span><span>{{ formatCompactNumber(detail.view_count || 0) }} 浏览</span></div>
          </div>
          <div class="detail-service-strip"><span>区县社区 · {{ detail.district_name || '未设置区�? }}</span><span>状��?· {{ formatListingType(detail.listing_type) }}</span></div>
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
            <button class="detail-chat-btn" @click="openChat">聊一�?/button>
            <button class="detail-buy-btn" @click="placeOrder">立即购买</button>
            <button
              class="detail-fav-btn"
              :class="{ active: isFavorited }"
              @click="toggleFavorite"
            >
              {{ isFavorited ? '已收�? : '收藏' }}
            </button>
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
        errorText.value = "请先输入图片链接�?;"
        return;
      }
      if (!isValidUrl(imageUrl)) {
        errorText.value = "图片链接必须�?http �?https 地址�?;"
        return;
      }
      if (form.image_urls.includes(imageUrl)) {
        errorText.value = "这张图片已经添加过了�?;"
        return;
      }
      if (form.image_urls.length >= 6) {
        errorText.value = "朢�多上�?6 张图片��?;"
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
        errorText.value = "标题、描述和区县不能为空�?;"
        return;
      }
      if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
        errorText.value = "请输入合法价格��?;"
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
        successText.value = `发布成功，当前状态：${formatReviewStatus(result.status)}`;
        form.title = "";
        form.description = "";
        form.price = "";
        form.district_code = "";
        form.category_id = "cat-11";
        form.image_input = "";
        form.image_urls = [];
        window.setTimeout(() => router.push("/me"), 1200);
      } catch (error) {
        errorText.value = error.message || "发布失败，请稍后重试�?;"
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
            <div class="publish-eyebrow">发布帖子</div>
            <h1>参��仿闲鱼的发帖流程，改成社区 Web 表单</h1>
          </div>
          <div class="publish-switch">
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'sale' }" @click="form.listing_type = 'sale'">出售</button>
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'wanted' }" @click="form.listing_type = 'wanted'">求购</button>
          </div>
        </div>
        <div class="publish-grid">
          <div class="publish-main">
            <div class="field"><label>标题</label><input class="input" v-model.trim="form.title" placeholder="例如：九成新显示器��本地求购儿童座�? /></div>
            <div class="field">
              <label>描述</label>
              <textarea class="textarea publish-textarea" v-model.trim="form.description" placeholder="写清楚成色��使用情况��见面范围��是否支持同城或邮寄�?></textarea>
              <div class="field-tip">剩余 {{ 800 - form.description.length }} �?/div>
            </div>
            <div class="field">
              <label>图片链接（最�?6 张）</label>
              <div class="publish-image-input"><input class="input" v-model.trim="form.image_input" placeholder="粘贴丢�张图片地坢�后点击添�? /><button class="btn btn-dark" type="button" @click="addImage">添加</button></div>
              <div class="publish-image-grid">
                <div class="publish-image-card publish-image-empty" v-if="!form.image_urls.length">还没有图片，可以先发纯文字帖�?/div>
                <div class="publish-image-card" v-for="(imageUrl, index) in form.image_urls" :key="imageUrl">
                  <img :src="imageUrl" alt="" />
                  <button type="button" class="publish-image-remove" @click="removeImage(index)">删除</button>
                </div>
              </div>
            </div>
          </div>
          <div class="publish-side">
            <div class="field"><label>价格</label><input class="input" type="number" min="0" v-model="form.price" placeholder="0.00" /></div>
            <div class="field">
              <label>区县社区</label>
              <select class="select" v-model="form.district_code">
                <option value="">请��择区县</option>
                <option v-for="item in appState.districts" :key="item.code" :value="item.code">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>分类</label>
              <select class="select" v-model="form.category_id">
                <option v-for="item in appState.categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.name }}</option>
              </select>
            </div>
            <div class="publish-tip-card">
              <h3>发布建议</h3>
              <p>出售帖优先放实拍图，求购帖可以放参��图、聊天截图或型号图��?/p>
              <p>如果是同城面对面交易，建议在描述里写清楚区县、时间和见面方式�?/p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary publish-submit" :disabled="submitting" @click="submit">{{ submitting ? '提交�?..' : '提交审核' }}</button>
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
        throw new Error("请��择图片后再上传�?");
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
        throw new Error("仅支�?jpg、png、webp 图片�?");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("图片不能超过 10MB�?");
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
        errorText.value = "朢�多上�?9 张图片��?;"
        return;
      }

      const acceptedFiles = files.slice(0, remain);
      if (acceptedFiles.length < files.length) {
        errorText.value = "朢�多上�?9 张图片，多余图片已忽略��?;"
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
          successText.value = "图片已粘贴，提交时统丢�上传�?;"
        }
      } catch (error) {
        errorText.value = error.message || "图片添加失败，请重试�?;"
      }
    }

    function openImagePicker() {
      if (!canAddMoreImages.value) {
        errorText.value = "朢�多上�?9 张图片��?;"
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
            (message.includes("无法解析的数�?") ||
              message.includes("状��码 404") ||
              message.includes("页面不存�?"));
          if (!canFallback) {
            throw error;
          }
        }
      }

      throw lastError || new Error("图片上传失败，请稍后重试�?");
    }

    async function submit() {
      errorText.value = "";
      successText.value = "";
      if (!form.title.trim() || !form.description.trim() || !form.district_code) {
        errorText.value = "标题、描述和区县不能为空�?;"
        return;
      }
      if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
        errorText.value = "请输入合法价格��?;"
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
        errorText.value = error.message || "发布失败，请稍后重试�?;"
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
            <h1>参��仿闲鱼的发帖流程，改成社区 Web 表单</h1>
          </div>
          <div class="publish-switch">
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'sale' }" @click="form.listing_type = 'sale'">出售</button>
            <button class="publish-switch-btn" :class="{ active: form.listing_type === 'wanted' }" @click="form.listing_type = 'wanted'">求购</button>
          </div>
        </div>
        <div class="publish-grid">
          <div class="publish-main">
            <div class="field"><label>标题</label><input class="input" v-model.trim="form.title" placeholder="例如：九成新显示器��本地求购儿童座�? /></div>
            <div class="field">
              <label>描述</label>
              <textarea class="textarea publish-textarea" v-model.trim="form.description" placeholder="写清楚成色��使用情况��见面范围��是否支持同城或邮寄�?></textarea>
              <div class="field-tip">剩余 {{ 800 - form.description.length }} �?/div>
            </div>
            <div class="field">
              <label>图片（最�?9 张，第一张作为首页封面）</label>
              <div class="publish-image-input">
                <div class="publish-image-count">已��?{{ selectedImages.length }}/9 张，可一次多选，也可以继续添�?/div>
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
                <div class="publish-image-summary">已��?{{ selectedImages.length }} 张，第一张会作为首页封面</div>
                <button type="button" class="btn btn-ghost publish-image-more" :disabled="submitting || !canAddMoreImages" @click="openImagePicker">
                  {{ canAddMoreImages ? '继续添加' : '已达上限' }}
                </button>
              </div>
              <div class="publish-image-grid publish-image-grid-nine">
                <div class="publish-image-card publish-image-empty" v-if="!selectedImages.length">还没有图片，可以先发纯文字帖，也可以直接 Ctrl+V 粘贴截图�?/div>
                <div class="publish-image-card" v-for="(imageItem, index) in selectedImages" :key="imageItem.id">
                  <img :src="imageItem.preview_url" alt="" />
                  <div class="publish-image-badge" v-if="index === 0">首页封面</div>
                  <div class="publish-image-status" :class="imageItem.status">{{ imageItem.status === 'uploading' ? '上传�? : imageItem.status === 'uploaded' ? '已就�? : imageItem.status === 'failed' ? '失败' : '待上�? }}</div>
                  <div class="publish-image-error" v-if="imageItem.error">{{ imageItem.error }}</div>
                  <button type="button" class="publish-image-remove" @click="removeImage(index)">删除</button>
                </div>
              </div>
            </div>
          </div>
          <div class="publish-side">
            <div class="field"><label>价格</label><input class="input" type="number" min="0" v-model="form.price" placeholder="0.00" /></div>
            <div class="field">
              <label>ʡ�ݷ���</label>
              <select class="select" v-model="form.province_code" @change="handleProvinceChange">
                <option value="">��ѡ��ʡ��</option>
                <option v-for="item in provinceOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>���з���</label>
              <select class="select" v-model="form.city_code" @change="handleCityChange">
                <option value="">��ѡ�����</option>
                <option v-for="item in cityOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>��������</label>
              <select class="select" v-model="form.district_code" @change="handleDistrictChange">
                <option value="">��ѡ������</option>
                <option v-for="item in districtOptions" :key="item.code" :value="item.code">{{ item.name }}{{ item.city_name ? ' �� ' + item.city_name : '' }}</option>
              </select>
              <div class="publish-district-summary">{{ selectedDistrictPath }}</div>
            </div>
            <div class="field">
              <label>����</label>
              <select class="select" v-model="form.category_id">
                <option v-for="item in appState.categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.name }}</option>
              </select>
            </div>
            <div class="publish-tip-card">
              <h3>��������</h3>
              <p>�����Ѿ���ʡ�ݺͳ��з��飬��ѡʡ�У���ѡ���أ�¼�����졣</p>
              <p>���������ȷ�ʵ��ͼ���������ԷŲο�ͼ�������ͼ���ͺ�ͼ��</p>
              <p>�����ͬ���潻��������������д������ء�ʱ��ͼ��淽ʽ��</p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary publish-submit" :disabled="submitting" @click="submit">{{ submitting ? '提交�?..' : '提交审核' }}</button>
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
        errorText.value = error.message || "加载会话失败�?;"
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
      <div class="message-warning card">如遇到明显低价��要求站外沟通��要求直接打款等情况，请谨慎交易�?/div>

      <section v-if="loading" class="card section muted">正在加载会话...</section>
      <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
      <section v-else class="message-list">
        <article v-for="item in items" :key="item.id" class="card message-item" @click="openDetail(item)">
          <div class="message-avatar">{{ getAvatarText(item.peer_nickname) }}</div>
          <div class="message-main">
            <div class="message-row"><strong>{{ item.peer_nickname || '对方' }}</strong><span class="muted">{{ formatRelativeTime(item.updated_at) }}</span></div>
            <div class="message-subline">{{ item.listing_title }}</div>
            <div class="message-row"><span class="muted">{{ item.last_message || '还没有消息，先聊聊细节��? }}</span><span class="message-unread" v-if="item.unread_count">{{ item.unread_count }}</span></div>
          </div>
          <img v-if="item.listing_image" class="message-thumb" :src="item.listing_image" alt="" />
          <div v-else class="message-thumb message-thumb-empty">{{ formatPrice(item.listing_price) }}</div>
        </article>

        <div v-if="!items.length" class="card empty-state">
          <h3>还没有会�?/h3>
          <p>从商品详情点击��聊丢�聊��后，会话就会出现在这里�?/p>
          <router-link class="btn btn-primary" to="/">去��首�?/router-link>
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
    const peerName = computed(() => detail.value?.peer_nickname || "对方");

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
        errorText.value = error.message || "加载聊天详情失败�?;"
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
        window.alert(error.message || "发��失败��?");
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
      window.alert("担保支付入口已预留，当前版本先保留购买按钮位置��?");
    }

    function useTool(label) {
      window.alert(`${label} 功能已预留，下一步可以继续接图片、位置或订单卡片。``);
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
        setComposerMessage("当前浏览器不支持截图授权，请直接 Ctrl+V 粘贴截图�?��", "error");
        return;
      }

      let stream;
      try {
        setComposerMessage("请在浏览器授权后选择要截取的窗口或屏�?..");
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("没有获取到屏幕画靃6�9��?");
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
          throw new Error("截图生成失败，请重试�?");
        }

        const file = new File([blob], `screencapture-${Date.now()}.png`, { type: "image/png" });
        queueComposerFiles([file], "capture");
      } catch (error) {
        const isAbort = error?.name === "NotAllowedError" || error?.name === "AbortError";
        setComposerMessage(
          isAbort
            ? "截图未授权，你也可以直接 Ctrl+V 粘贴截图发����?"
            : error.message || "截图失败，请改用粘贴图片�?",
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
          throw new Error("剪贴板图片读取失败，请重试��?");
        }
        queueComposerFiles(files, "paste");
      } catch (error) {
        setComposerMessage(error.message || "粘贴图片失败，请重试�?��", "error");
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
    <section v-if="loading" class="card section muted">正在加载聊天...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="chat-shell">
      <header class="chat-topbar card">
        <div class="chat-peer">
          <div class="chat-peer-avatar">{{ getAvatarText(peerName) }}</div>
          <div><h1>{{ peerName }}</h1><p>{{ detail.peer_openid || '本地社区用户' }}</p></div>
        </div>
        <button class="btn btn-ghost" @click="placeOrder">立即购买</button>
      </header>

      <section class="chat-product-bar card">
        <div class="chat-product-info" @click="openListing">
          <img v-if="detail.listing && detail.listing.image_urls && detail.listing.image_urls[0]" class="chat-product-image" :src="detail.listing.image_urls[0]" alt="" />
          <div v-else class="chat-product-image chat-product-image-empty">无图</div>
          <div>
            <div class="chat-product-title">{{ detail.listing?.title || '商品已下�? }}</div>
            <div class="chat-product-price">{{ formatPrice(detail.listing?.price || 0) }}</div>
            <div class="chat-product-note">交易前先聊一聊，确认区县与面交方式��?/div>
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
          <button type="button" class="chat-tool" @click="useTool('图片')">图片</button>
          <button type="button" class="chat-tool" @click="useTool('截图')">截图</button>
          <button type="button" class="chat-tool" @click="useTool('订单')">订单</button>
          <button type="button" class="chat-tool" @click="useTool('位置')">位置</button>
        </div>
        <div class="chat-input-row">
          <input class="input chat-input" v-model="inputText" placeholder="输入消息，按 Enter 发��? @keydown.enter="sendMessage" />
          <button class="btn btn-primary chat-send" :disabled="sending" @click="sendMessage">{{ sending ? '发��中...' : '发��? }}</button>
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
    const uploadInputRef = ref(null);
    const panelRef = ref(null);
    const composerError = ref("");
    const composerHint = ref("");
    const activePreviewUrl = ref("");
    const pendingComposerImages = ref([]);
    const pendingSendSource = ref("");
    const socketStatus = ref("idle");
    const objectUrls = new Set();
    let socketRef = null;
    let reconnectTimer = 0;
    let activeConversationId = "";

    const myName = computed(() => getUserDisplayName(appState.user));
    const peerName = computed(() => detail.value?.peer_nickname || "对方");
    const canSend = computed(() => {
      return Boolean(String(inputText.value || "").trim() || pendingComposerImages.value.length);
    });
    let hintTimer = 0;

    async function scrollToBottom() {
      await nextTick();
      if (panelRef.value) {
        panelRef.value.scrollTop = panelRef.value.scrollHeight;
      }
    }

    function setComposerMessage(text, type = "hint") {
      if (hintTimer) {
        window.clearTimeout(hintTimer);
        hintTimer = 0;
      }
      if (type === "error") {
        composerError.value = text;
        composerHint.value = "";
        return;
      }
      composerError.value = "";
      composerHint.value = text;
      if (text) {
        hintTimer = window.setTimeout(() => {
          composerHint.value = "";
          hintTimer = 0;
        }, 3200);
      }
    }

    function clearComposerError() {
      composerError.value = "";
    }

    function normalizeImageUrl(url) {
      const value = String(url || "").trim();
      if (!value) return "";
      if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) return value;
      return value.startsWith("/") ? value : `/${value}`;
    }

    function getMessageKey(message, index) {
      return message.id || message.local_id || `${message.created_at || "temp"}-${index}`;
    }

    function isImageMessage(message) {
      return message?.message_type === "image";
    }

    function getMessageImageUrl(message) {
      if (!isImageMessage(message)) return "";
      return normalizeImageUrl(message.image_url || message.content || message.preview_url || "");
    }

    function canPreviewImage(message) {
      return Boolean(getMessageImageUrl(message));
    }

    function revokePreviewUrl(url) {
      if (url && objectUrls.has(url)) {
        URL.revokeObjectURL(url);
        objectUrls.delete(url);
      }
    }

    function cleanupPendingPreview(message) {
      if (message?.preview_url) {
        revokePreviewUrl(message.preview_url);
      }
    }

    function updateLocalMessage(localId, patch) {
      const index = messages.value.findIndex((item) => item.local_id === localId);
      if (index === -1) return null;
      const current = messages.value[index];
      const next = { ...current, ...patch };
      messages.value.splice(index, 1, next);
      return next;
    }

    function removeLocalMessage(localId) {
      const index = messages.value.findIndex((item) => item.local_id === localId);
      if (index !== -1) {
        const [removed] = messages.value.splice(index, 1);
        cleanupPendingPreview(removed);
      }
    }

    function clearPendingComposerImages() {
      pendingComposerImages.value.forEach((item) => {
        if (item?.preview_url) {
          revokePreviewUrl(item.preview_url);
        }
      });
      pendingComposerImages.value = [];
      pendingSendSource.value = "";
    }

    function removePendingComposerImage(imageId) {
      const index = pendingComposerImages.value.findIndex((item) => item.id === imageId);
      if (index === -1) {
        return;
      }
      const [removed] = pendingComposerImages.value.splice(index, 1);
      if (removed?.preview_url) {
        revokePreviewUrl(removed.preview_url);
      }
    }

    function hasMessage(messageId) {
      return Boolean(messageId) && messages.value.some((item) => item.id === messageId);
    }

    function upsertMessage(message) {
      if (!message) return;
      const index = messages.value.findIndex((item) => item.id === message.id);
      if (index === -1) {
        messages.value.push(message);
        return;
      }
      messages.value.splice(index, 1, { ...messages.value[index], ...message });
    }

    function updateOwnMessageStatus(status) {
      messages.value = messages.value.map((message) => {
        if (message.sender_openid === appState.user?.openid && message.status !== status) {
          return { ...message, status };
        }
        return message;
      });
    }

    function getConversationSocketIds() {
      const ids = [detail.value?.id, route.params.id]
        .filter(Boolean)
        .map((item) => String(item));
      return Array.from(new Set(ids));
    }

    function normalizeImageFile(file) {
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

      return new File([file], file.name || `image-${Date.now()}`, {
        type: normalizedType,
        lastModified: file.lastModified || Date.now(),
      });
    }

    function queueComposerFiles(fileList, source = "paste") {
      const files = Array.from(fileList || [])
        .map((file) => normalizeImageFile(file))
        .filter(Boolean);
      if (!files.length) {
        return;
      }

      const remain = 9 - pendingComposerImages.value.length;
      if (remain <= 0) {
        setComposerMessage("聊天中最多暂�?9 张待发��图片��?��", "error");
        return;
      }

      const acceptedFiles = files.slice(0, remain);
      let addedCount = 0;

      acceptedFiles.forEach((file) => {
        validateImageFile(file);
        const duplicate = pendingComposerImages.value.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        );
        if (duplicate) {
          return;
        }
        const previewUrl = URL.createObjectURL(file);
        objectUrls.add(previewUrl);
        pendingComposerImages.value.push({
          id: `composer-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          source,
          preview_url: previewUrl,
          name: file.name || "image",
        });
        addedCount += 1;
      });

      pendingSendSource.value = "";
      if (addedCount > 0) {
        const sourceText = source === "paste" ? "��ճ��" : "��ѡ��";
        setComposerMessage(`${sourceText} ${addedCount} 张图片，点击发��后上传`);
      }
    }

    function buildPendingImageMessage(file) {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.add(previewUrl);
      return {
        local_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id: "",
        sender_openid: appState.user?.openid || "",
        content: "",
        message_type: "image",
        image_url: "",
        preview_url: previewUrl,
        created_at: Date.now(),
        local_status: "uploading",
        local_error: "",
      };
    }

    async function sendMessagePayload(body) {
      return apiRequest(`/api/web/conversations/${encodeURIComponent(detail.value.id)}/messages`, {
        method: "POST",
        body,
      });
    }

    async function uploadChatImage(file) {
      const formData = new FormData();
      formData.append("image", file, file.name || `image-${Date.now()}.png`);
      return apiRequest("/api/web/uploads/chat", {
        method: "POST",
        body: formData,
      });
    }

    function validateImageFile(file) {
      if (!file) {
        throw new Error("请��择图片后再发����?");
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
        throw new Error("仅支�?jpg、png、webp 图片�?");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("图片不能超过 10MB�?");
      }
    }

    async function sendImageFile(file, options = {}) {
      const manageSending = options.manageSending !== false;
      if (!detail.value || (manageSending && sending.value)) return;

      validateImageFile(file);
      clearComposerError();
      setComposerMessage("图片上传�?..");
      if (manageSending) {
        sending.value = true;
      }
      const pending = buildPendingImageMessage(file);
      messages.value.push(pending);
      await scrollToBottom();

      try {
        const uploaded = await uploadChatImage(file);
        const created = await sendMessagePayload({
          message_type: "image",
          image_url: normalizeImageUrl(uploaded?.url || ""),
          content: "",
        });
        cleanupPendingPreview(pending);
        if (hasMessage(created.id)) {
          removeLocalMessage(pending.local_id);
        } else {
          updateLocalMessage(pending.local_id, {
            ...created,
            preview_url: "",
            local_status: "sent",
            local_error: "",
          });
        }
        setComposerMessage("图片已发�?");
        await scrollToBottom();
        return true;
      } catch (error) {
        updateLocalMessage(pending.local_id, {
          local_status: "failed",
          local_error: error.message || "发��失败，请重试��?",
        });
        setComposerMessage(error.message || "图片发��失败，请重试��?��", "error");
        return false;
      } finally {
        if (manageSending) {
          sending.value = false;
        }
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
        console.warn("[chat-ws] mark read failed:", error.message || error);
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = 0;
      }
    }

    function cleanupSocket() {
      clearReconnectTimer();
      if (socketRef) {
        const closingSocket = socketRef;
        socketRef = null;
        closingSocket.onopen = null;
        closingSocket.onmessage = null;
        closingSocket.onerror = null;
        closingSocket.onclose = null;
        if (
          closingSocket.readyState === window.WebSocket.OPEN ||
          closingSocket.readyState === window.WebSocket.CONNECTING
        ) {
          closingSocket.close();
        }
      }
      socketStatus.value = "idle";
    }

    function subscribeCurrentConversation() {
      if (!socketRef || socketRef.readyState !== window.WebSocket.OPEN) return;
      getConversationSocketIds().forEach((conversationId) => {
        socketRef.send(JSON.stringify({ type: "subscribe", conversationId }));
      });
    }

    function scheduleReconnect() {
      if (!detail.value?.id || !appState.token) return;
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = 0;
        connectSocket();
      }, 2500);
    }

    function handleSocketPayload(payload) {
      if (!payload || typeof payload !== "object") return;

      if (payload.type === "auth:success") {
        socketStatus.value = "connected";
        subscribeCurrentConversation();
        return;
      }

      if (payload.type === "message:new") {
        const message = payload.data?.message || null;
        const conversationId = String(payload.data?.conversation_id || "");
        if (!message || !getConversationSocketIds().includes(conversationId)) {
          return;
        }
        if (message.sender_openid === appState.user?.openid) {
          return;
        }
        if (!hasMessage(message.id)) {
          upsertMessage(message);
          scrollToBottom();
        }
        markConversationRead();
        return;
      }

      if (payload.type === "conversation:read") {
        const conversationId = String(payload.data?.conversation_id || "");
        if (!getConversationSocketIds().includes(conversationId)) {
          return;
        }
        if (payload.data?.reader_openid && payload.data.reader_openid !== appState.user?.openid) {
          updateOwnMessageStatus("read");
        }
      }
    }

    function connectSocket() {
      if (!detail.value?.id || !appState.token || !window.WebSocket) return;

      const nextConversationId = String(detail.value.id);
      if (
        socketRef &&
        socketRef.readyState === window.WebSocket.OPEN &&
        activeConversationId === nextConversationId
      ) {
        subscribeCurrentConversation();
        return;
      }

      cleanupSocket();
      activeConversationId = nextConversationId;
      socketStatus.value = "connecting";

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socketUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(appState.token)}`;
      const socket = new window.WebSocket(socketUrl);
      socketRef = socket;

      socket.onopen = () => {
        socketStatus.value = "authenticating";
      };

      socket.onmessage = (event) => {
        const payload = safeJsonParse(String(event.data || ""));
        handleSocketPayload(payload);
      };

      socket.onerror = () => {
        socketStatus.value = "error";
      };

      socket.onclose = () => {
        if (socketRef === socket) {
          socketRef = null;
        }
        if (socketStatus.value !== "idle") {
          socketStatus.value = "disconnected";
          scheduleReconnect();
        }
      };
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
        errorText.value = error.message || "加载聊天详情失败�?;"
      } finally {
        loading.value = false;
      }
    }

    function isMine(message) {
      return message.sender_openid === appState.user?.openid;
    }

    async function sendMessage() {
      const content = String(inputText.value || "").trim();
      const composerImages = [...pendingComposerImages.value];
      if ((!content && !composerImages.length) || !detail.value || sending.value) return;

      const sendSource = pendingSendSource.value || "";
      if (composerImages.length && sendSource !== "button") {
        pendingSendSource.value = "";
        return;
      }

      clearComposerError();
      sending.value = true;
      try {
        if (content) {
          const created = await sendMessagePayload({ content });
          if (!hasMessage(created.id)) {
            messages.value.push(created);
          }
          inputText.value = "";
        }

        if (composerImages.length) {
          const sentImageIds = [];
          for (const imageItem of composerImages) {
            const imageSent = await sendImageFile(imageItem.file, { manageSending: false });
            if (!imageSent) {
              break;
            }
            sentImageIds.push(imageItem.id);
          }
          sentImageIds.forEach((imageId) => removePendingComposerImage(imageId));
        }

        setComposerMessage("");
        await scrollToBottom();
      } catch (error) {
        setComposerMessage(error.message || "发��失败，请重试��?��", "error");
      } finally {
        pendingSendSource.value = "";
        sending.value = false;
      }
    }

    async function handleImageSelection(event) {
      const file = normalizeImageFile(event?.target?.files?.[0]);
      if (!file) return;
      try {
        await sendImageFile(file);
      } catch (error) {
        setComposerMessage(error.message || "图片发��失败，请重试��?��", "error");
      } finally {
        if (event?.target) {
          event.target.value = "";
        }
      }
    }

    async function captureScreenshot() {
      if (sending.value) return;

      if (!navigator.mediaDevices?.getDisplayMedia) {
        setComposerMessage("当前浏览器不支持截图授权，请直接 Ctrl+V 粘贴截图�?��", "error");
        return;
      }

      let stream;
      try {
        setComposerMessage("请在浏览器授权后选择要截取的窗口或屏�?..");
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("没有获取到屏幕画靃6�9��?");
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
          throw new Error("截图生成失败，请重试�?");
        }

        const file = new File([blob], `screencapture-${Date.now()}.png`, { type: "image/png" });
        await sendImageFile(file);
      } catch (error) {
        const isAbort = error?.name === "NotAllowedError" || error?.name === "AbortError";
        setComposerMessage(
          isAbort
            ? "截图未授权，您也可以直接 Ctrl+V 粘贴截图发����?"
            : error.message || "截图发��失败，请改用粘贴图片��?",
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
      const imageItem = clipboardItems.find((item) => item.type && item.type.startsWith("image/"));
      if (!imageItem) return;

      event.preventDefault();
      try {
        const file = normalizeImageFile(imageItem.getAsFile());
        if (!file) {
          throw new Error("剪贴板图片读取失败，请重试��?");
        }
        queueComposerFiles([file], "paste");
      } catch (error) {
        setComposerMessage(error.message || "粘贴图片发��失败，请重试��?��", "error");
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

    function requestSend(source = "button") {
      pendingSendSource.value = source;
      sendMessage();
    }

    function openListing() {
      if (detail.value?.listing?.id) {
        router.push(`/listing/${encodeURIComponent(detail.value.listing.id)}`);
      }
    }

    function placeOrder() {
      window.alert("担保支付入口已预留，当前版本先保留购买按钮位置��?");
    }

    function useTool(label) {
      if (label === "图片") {
        if (uploadInputRef.value) {
          uploadInputRef.value.value = "";
          uploadInputRef.value.click();
        }
        return;
      }

      if (label === "截图") {
        captureScreenshot();
        return;
      }

      window.alert(`${label} 功能暂未接入，当前先保留入口位置。``);
    }

    function openImagePreview(message) {
      const imageUrl = getMessageImageUrl(message);
      if (!imageUrl) return;
      activePreviewUrl.value = imageUrl;
    }

    function closeImagePreview() {
      activePreviewUrl.value = "";
    }

    function retryImageMessage() {
      setComposerMessage("失败图片霢�要重新��择后发送��?��", "error");
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
        setComposerMessage("当前浏览器不支持截图授权，请直接 Ctrl+V 粘贴截图�?��", "error");
        return;
      }

      let stream;
      try {
        setComposerMessage("请在浏览器授权后选择要截取的窗口或屏�?..");
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("没有获取到屏幕画靃6�9��?");
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
          throw new Error("截图生成失败，请重试�?");
        }

        const file = new File([blob], `screencapture-${Date.now()}.png`, { type: "image/png" });
        queueComposerFiles([file], "capture");
      } catch (error) {
        const isAbort = error?.name === "NotAllowedError" || error?.name === "AbortError";
        setComposerMessage(
          isAbort
            ? "截图未授权，你也可以直接 Ctrl+V 粘贴截图发����?"
            : error.message || "截图失败，请改用粘贴图片�?",
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
          throw new Error("剪贴板图片读取失败，请重试��?");
        }
        queueComposerFiles(files, "paste");
      } catch (error) {
        setComposerMessage(error.message || "粘贴图片失败，请重试�?��", "error");
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
    watch(
      () => route.params.id,
      (nextId, previousId) => {
        if (nextId && nextId !== previousId) {
          cleanupSocket();
          activeConversationId = "";
          loadData();
        }
      },
    );
    onBeforeUnmount(() => {
      clearPendingComposerImages();
      cleanupSocket();
      if (hintTimer) {
        window.clearTimeout(hintTimer);
      }
      Array.from(objectUrls).forEach((url) => revokePreviewUrl(url));
    });

    return {
      activePreviewUrl,
      canSend,
      canPreviewImage,
      clearPendingComposerImage: clearPendingComposerImages,
      clearPendingComposerImages,
      clearComposerError,
      closeImagePreview,
      composerError,
      composerHint,
      detail,
      errorText,
      formatDateTime,
      formatPrice,
      getAvatarText,
      getMessageImageUrl,
      getMessageKey,
      handleEnterSend,
      handleImageSelection,
      handlePaste,
      inputText,
      isImageMessage,
      isMine,
      loading,
      messages,
      myName,
      openImagePreview,
      openListing,
      panelRef,
      pendingComposerImage: null,
      pendingComposerImages,
      peerName,
      placeOrder,
      removePendingComposerImage,
      requestSend,
      retryImageMessage,
      sendMessage,
      sending,
      uploadInputRef,
      useTool,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">正在加载聊天...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="chat-shell">
      <header class="chat-topbar card">
        <div class="chat-peer">
          <div class="chat-peer-avatar">{{ getAvatarText(peerName) }}</div>
          <div><h1>{{ peerName }}</h1><p>{{ detail.peer_openid || '本地社区用户' }}</p></div>
        </div>
        <button class="btn btn-ghost" @click="placeOrder">立即购买</button>
      </header>

      <section class="chat-product-bar card">
        <div class="chat-product-info" @click="openListing">
          <img v-if="detail.listing && detail.listing.image_urls && detail.listing.image_urls[0]" class="chat-product-image" :src="detail.listing.image_urls[0]" alt="" />
          <div v-else class="chat-product-image chat-product-image-empty">无图</div>
          <div>
            <div class="chat-product-title">{{ detail.listing?.title || '商品已下�? }}</div>
            <div class="chat-product-price">{{ formatPrice(detail.listing?.price || 0) }}</div>
            <div class="chat-product-note">交易前先聊一聊，确认区县与面交方式��?/div>
          </div>
        </div>
      </section>

      <section ref="panelRef" class="chat-panel card">
        <div class="chat-history">
          <div v-for="(message, index) in messages" :key="getMessageKey(message, index)" class="chat-message-block">
            <div class="chat-message-time">{{ formatDateTime(message.created_at) }}</div>
            <div class="chat-message-row" :class="{ mine: isMine(message) }">
              <div class="chat-avatar" v-if="!isMine(message)">{{ getAvatarText(peerName) }}</div>
              <div class="chat-bubble" :class="{ mine: isMine(message), 'chat-bubble-image': isImageMessage(message) }">
                <template v-if="isImageMessage(message)">
                  <button
                    v-if="canPreviewImage(message)"
                    type="button"
                    class="chat-image-button"
                    @click="openImagePreview(message)"
                  >
                    <img class="chat-message-image" :src="getMessageImageUrl(message)" alt="聊天图片" />
                  </button>
                  <div v-else class="chat-image-fallback">图片暂时无法预览</div>
                  <div class="chat-image-meta">
                    <span v-if="message.local_status === 'uploading'" class="chat-message-status">发��中...</span>
                    <span v-else-if="message.local_status === 'failed'" class="chat-message-status chat-message-status-error">{{ message.local_error || '发��失�? }}</span>
                    <span v-else class="chat-message-status">图片</span>
                    <button
                      v-if="message.local_status === 'failed'"
                      type="button"
                      class="chat-message-action"
                      @click="retryImageMessage()"
                    >
                      重新选择
                    </button>
                  </div>
                </template>
                <template v-else>{{ message.content }}</template>
              </div>
              <div class="chat-avatar mine" v-if="isMine(message)">{{ getAvatarText(myName) }}</div>
            </div>
          </div>
        </div>
      </section>

      <footer class="chat-composer card">
        <div class="chat-tool-row">
          <button type="button" class="chat-tool" :disabled="sending" @click="useTool('图片')">图片</button>
          <button type="button" class="chat-tool" :disabled="sending" @click="useTool('截图')">截图</button>
          <button type="button" class="chat-tool" @click="useTool('订单')">订单</button>
          <button type="button" class="chat-tool" @click="useTool('位置')">位置</button>
          <input
            ref="uploadInputRef"
            class="chat-upload-input"
            type="file"
            accept="image/jpeg,image/jpg,image/pjpeg,image/png,image/webp,.jpg,.jpeg,.jfif,.pjp,.png,.webp"
            multiple
            @change="handleImageSelection"
          />
        </div>
        <div v-if="composerError || composerHint" class="chat-feedback" :class="{ error: composerError }">
          {{ composerError || composerHint }}
        </div>
        <div v-if="false && pendingComposerImage" class="chat-composer-attachment">
          <img class="chat-composer-attachment-image" :src="pendingComposerImage.preview_url" alt="待发送图�? />
          <div class="chat-composer-attachment-meta">
            <strong>待发送图�?/strong>
            <span>{{ pendingComposerImage.source === 'paste' ? '已粘贴，点击发��后上传' : '已��择，点击发送后上传' }}</span>
          </div>
          <button type="button" class="chat-composer-attachment-remove" @click="clearPendingComposerImage">移除</button>
        </div>
        <div v-if="pendingComposerImages.length" class="chat-composer-attachments">
          <div class="chat-composer-attachment-card" v-for="imageItem in pendingComposerImages" :key="imageItem.id">
            <img class="chat-composer-attachment-image" :src="imageItem.preview_url" alt="待发送图�? />
            <div class="chat-composer-attachment-meta">
              <strong>{{ imageItem.source === 'capture' ? '待发送截�? : '待发送图�? }}</strong>
              <span>{{ imageItem.source === 'paste' ? '已粘贴，点击发��后上传' : imageItem.source === 'capture' ? '已截图，点击发��后上传' : '已��择，点击发送后上传' }}</span>
            </div>
            <button type="button" class="chat-composer-attachment-remove" @click="removePendingComposerImage(imageItem.id)">移除</button>
          </div>
        </div>
        <div class="chat-input-row">
          <input
            class="input chat-input"
            v-model="inputText"
            placeholder="输入消息，按 Enter 发��，支持 Ctrl+V 粘贴图片"
            @input="clearComposerError"
            @keydown.enter.prevent="handleEnterSend"
            @paste="handlePaste"
          />
          <button class="btn btn-primary chat-send" :disabled="sending || !canSend" @click="requestSend('button')">{{ sending ? '发��中...' : '发��? }}</button>
        </div>
      </footer>

      <div v-if="activePreviewUrl" class="chat-image-preview-mask" @click="closeImagePreview">
        <div class="chat-image-preview-card" @click.stop>
          <button type="button" class="chat-image-preview-close" @click="closeImagePreview">关闭</button>
          <img class="chat-image-preview-image" :src="activePreviewUrl" alt="聊天图片预览" />
        </div>
      </div>
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
        errorText.value = error.message || "加载个人中心失败�?;"
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
        errorText.value = error.message || "更新帖子状��失败��?;"
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
      window.alert(`${label} 入口已预留，下一步可以继续补订单、收藏和售后模块。``);
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
          <button class="btn btn-primary" @click="openPublish">去发�?/button>
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
        <button class="profile-menu-item" @click="openFavorites"><span>�?/span><span>我的收藏</span></button>
        <button class="profile-menu-item" @click="showComingSoon('我的订单')"><span>📦</span><span>我的订单</span></button>
        <button class="profile-menu-item" @click="showComingSoon('我卖出的')"><span>🏷�?/span><span>我卖出的</span></button>
      </section>

      <section class="card section">
        <div class="section-title-row">
          <h2>我发布的帖子</h2>
          <button class="btn btn-ghost btn-mini" @click="logout">逢�出登�?/button>
        </div>
        <div class="error" v-if="errorText">{{ errorText }}</div>
        <div v-if="loading" class="muted">正在加载...</div>
        <div v-else-if="!myListings.length" class="empty-inline">你还没有发布记录，先去发丢�个出售帖或求购帖�?/div>
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
                {{ actionLoadingId === item.id ? '处理�?..' : item.status === 'off_shelf' ? '重新上架' : '下架' }}
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
        errorText.value = error.message || "加载收藏失败�?;"
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
        window.alert(error.message || "发起聊天失败�?");
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
        if (!data?.favorited) {
          listings.value = listings.value.filter((entry) => entry.id !== item.id);
        }
      } catch (error) {
        window.alert(error.message || "取消收藏失败，请稍后重试�?");
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
        <div class="muted favorites-subline">收藏后可快��回到商品详情继续沟通��?/div>
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
              <span class="badge subtle">已收�?/span>
            </div>
            <div class="listing-title">{{ item.title }}</div>
            <div class="listing-meta">
              <span>{{ item.district_name || '未设置区�? }}</span>
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
                  {{ togglingId === item.id ? '处理�?..' : '取消收藏' }}
                </button>
                <button class="btn btn-primary btn-mini" @click.stop="openChat(item)">聊一�?/button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="card empty-state">
        <h3>你还没有收藏商品</h3>
        <p>去首页����，点击商品详情里的“收藏��即可在这里查看�?/p>
        <router-link class="btn btn-primary" to="/">去首�?/router-link>
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
        <div><div class="brand">本地闲置</div><div class="brand-subline">区县社区二手 · 仿闲�?Web �?/div></div>
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



