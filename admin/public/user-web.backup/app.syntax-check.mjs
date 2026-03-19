const createApp = () => ({ use() {}, mount() {} });
const reactive = (v) => v;
const ref = (v) => ({ value: v });
const computed = (fn) => ({ get value() { return fn(); } });
const onMounted = () => {};
const nextTick = async () => {};
const createRouter = () => ({ beforeEach() {} });
const createWebHashHistory = () => ({});
const useRoute = () => ({ path: '/', query: {}, params: {}, fullPath: '/' });
const useRouter = () => ({ push() {}, replace() {} });
const STORAGE_TOKEN_KEY = "LOCAL_TRADER_WEB_TOKEN";
const STORAGE_USER_KEY = "LOCAL_TRADER_WEB_USER";

const appState = reactive({
  token: String(localStorage.getItem(STORAGE_TOKEN_KEY) || ""),
  user: loadStoredJson(STORAGE_USER_KEY, null),
  districts: [],
  loadingDistricts: false,
});

function loadStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
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
    return "JPY 0";
  }
  return Number.isInteger(number) ? `JPY ${number}` : `JPY ${number.toFixed(2)}`;
}

function formatTime(value) {
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

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.auth !== false && appState.token) {
    headers.Authorization = `Bearer ${appState.token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    credentials: "same-origin",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({
    success: false,
    message: "Invalid JSON response from server.",
  }));

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
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
    appState.districts = Array.isArray(data) ? data : [];
    return appState.districts;
  } finally {
    appState.loadingDistricts = false;
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
    const form = reactive({
      openid: "",
      nickname: "",
      avatar_url: "",
    });
    const submitting = ref(false);
    const errorText = ref("");

    async function submit() {
      errorText.value = "";
      if (!form.openid.trim()) {
        errorText.value = "Please enter an account id.";
        return;
      }

      submitting.value = true;
      try {
        const data = await apiRequest("/api/web/auth/login", {
          method: "POST",
          auth: false,
          body: {
            openid: form.openid.trim(),
            nickname: form.nickname.trim(),
            avatar_url: form.avatar_url.trim(),
          },
        });
        saveAuth(data.token, data.user);
        const redirect = String(route.query.redirect || "").trim();
        router.replace(redirect || "/me");
      } catch (error) {
        errorText.value = error.message || "Login failed.";
      } finally {
        submitting.value = false;
      }
    }

    return {
      form,
      submitting,
      errorText,
      submit,
    };
  },
  template: `
    <section class="card section">
      <h2 style="margin:0 0 12px;font-size:20px;">User Login</h2>
      <p class="muted" style="margin:0 0 12px;">The user app now runs on the web.</p>
      <div class="field">
        <label>Account</label>
        <input class="input" v-model.trim="form.openid" placeholder="seller-001 or phone number" />
      </div>
      <div class="field">
        <label>Nickname</label>
        <input class="input" v-model.trim="form.nickname" placeholder="Optional" />
      </div>
      <div class="field">
        <label>Avatar URL</label>
        <input class="input" v-model.trim="form.avatar_url" placeholder="https://example.com/avatar.jpg" />
      </div>
      <button class="btn btn-green" :disabled="submitting" @click="submit">
        {{ submitting ? 'Logging in...' : 'Login' }}
      </button>
      <div class="error" v-if="errorText">{{ errorText }}</div>
    </section>
  `,
};

const HomePage = {
  setup() {
    const router = useRouter();
    const filters = reactive({
      district_code: "",
      listing_type: "all",
      keyword: "",
    });
    const loading = ref(false);
    const errorText = ref("");
    const listings = ref([]);

    async function loadListings() {
      loading.value = true;
      errorText.value = "";

      try {
        const query = new URLSearchParams();
        if (filters.district_code) {
          query.set("district_code", filters.district_code);
        }
        if (filters.listing_type !== "all") {
          query.set("listing_type", filters.listing_type);
        }
        if (filters.keyword) {
          query.set("keyword", filters.keyword);
        }
        query.set("page", "1");
        query.set("page_size", "50");

        const data = await apiRequest(`/api/web/listings?${query.toString()}`, {
          auth: false,
        });
        listings.value = Array.isArray(data.items) ? data.items : [];
      } catch (error) {
        errorText.value = error.message || "Failed to load listings.";
      } finally {
        loading.value = false;
      }
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
        window.alert(error.message || "Failed to open conversation.");
      }
    }

    onMounted(async () => {
      await ensureDistricts();
      await loadListings();
    });

    return {
      appState,
      filters,
      loading,
      errorText,
      listings,
      loadListings,
      openChat,
      formatPrice,
      formatTime,
    };
  },
  template: `
    <section class="card section">
      <div class="row wrap">
        <select class="select" style="flex:1;min-width:140px;" v-model="filters.district_code">
          <option value="">All districts</option>
          <option v-for="item in appState.districts" :key="item.code" :value="item.code">
            {{ item.name }}
          </option>
        </select>
        <select class="select" style="width:120px;" v-model="filters.listing_type">
          <option value="all">All</option>
          <option value="sale">Sale</option>
          <option value="wanted">Wanted</option>
        </select>
      </div>
      <div class="row" style="margin-top:10px;">
        <input
          class="input"
          style="flex:1;"
          v-model.trim="filters.keyword"
          placeholder="Search phone, desk, bike..."
          @keydown.enter="loadListings"
        />
        <button class="btn btn-dark" @click="loadListings">Search</button>
      </div>
      <div class="error" v-if="errorText">{{ errorText }}</div>
    </section>

    <section v-if="loading" class="card section muted">Loading listings...</section>

    <section v-else class="listing-grid">
      <article v-for="item in listings" :key="item.id" class="card listing-item">
        <img
          v-if="item.image_urls && item.image_urls[0]"
          class="listing-cover"
          :src="item.image_urls[0]"
          alt=""
        />
        <div
          v-else
          class="listing-cover"
          style="display:flex;align-items:center;justify-content:center;color:#999;"
        >
          No image
        </div>
        <div class="listing-body">
          <div class="row" style="justify-content:space-between;align-items:center;">
            <span class="badge" :class="item.listing_type">
              {{ item.listing_type === 'wanted' ? 'Wanted' : 'Sale' }}
            </span>
            <span class="muted" style="font-size:12px;">{{ item.district_name || 'Unknown district' }}</span>
          </div>
          <div class="listing-title" style="margin-top:8px;">{{ item.title }}</div>
          <div class="muted" style="margin-top:6px;font-size:12px;">
            {{ item.seller_nickname }} 路 {{ formatTime(item.created_at) }}
          </div>
          <div class="price" style="margin-top:8px;">{{ formatPrice(item.price) }}</div>
          <div class="actions">
            <router-link class="btn btn-ghost" :to="'/listing/' + encodeURIComponent(item.id)">
              Detail
            </router-link>
            <button class="btn btn-primary" @click="openChat(item)">Chat</button>
          </div>
        </div>
      </article>
      <div v-if="!listings.length" class="card section muted">No listings found.</div>
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

    async function loadDetail() {
      loading.value = true;
      errorText.value = "";
      try {
        detail.value = await apiRequest(`/api/web/listings/${encodeURIComponent(route.params.id)}`, {
          auth: false,
        });
      } catch (error) {
        errorText.value = error.message || "Failed to load detail.";
      } finally {
        loading.value = false;
      }
    }

    async function openChat() {
      if (!detail.value) {
        return;
      }
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
        window.alert(error.message || "Failed to open conversation.");
      }
    }

    onMounted(loadDetail);

    return {
      loading,
      errorText,
      detail,
      openChat,
      formatPrice,
      formatTime,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">Loading detail...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else-if="detail" class="card section">
      <img
        v-if="detail.image_urls && detail.image_urls[0]"
        :src="detail.image_urls[0]"
        class="listing-cover"
        style="height:220px;border-radius:14px;"
        alt=""
      />
      <h2 style="margin:12px 0 6px;font-size:22px;">{{ detail.title }}</h2>
      <div class="row" style="align-items:center;justify-content:space-between;">
        <div class="price">{{ formatPrice(detail.price) }}</div>
        <span class="badge" :class="detail.listing_type">
          {{ detail.listing_type === 'wanted' ? 'Wanted' : 'Sale' }}
        </span>
      </div>
      <div class="muted" style="margin-top:6px;">
        {{ detail.seller_nickname }} 路 {{ detail.district_name }} 路 {{ formatTime(detail.created_at) }}
      </div>
      <p style="margin:14px 0 0;line-height:1.7;white-space:pre-wrap;">{{ detail.description }}</p>
      <div class="actions" style="margin-top:14px;">
        <button class="btn btn-primary" @click="openChat">Chat</button>
      </div>
    </section>
  `,
};

const PublishPage = {
  setup() {
    const form = reactive({
      listing_type: "sale",
      title: "",
      description: "",
      price: "",
      district_code: "",
      image_urls_text: "",
    });
    const submitting = ref(false);
    const errorText = ref("");
    const successText = ref("");

    async function submit() {
      errorText.value = "";
      successText.value = "";
      submitting.value = true;
      try {
        const imageUrls = form.image_urls_text
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6);

        const result = await apiRequest("/api/web/listings", {
          method: "POST",
          body: {
            listing_type: form.listing_type,
            title: form.title.trim(),
            description: form.description.trim(),
            price: Number(form.price || 0),
            district_code: form.district_code,
            image_urls: imageUrls,
          },
        });

        successText.value = `Created successfully. Status: ${result.status}`;
        form.title = "";
        form.description = "";
        form.price = "";
        form.image_urls_text = "";
      } catch (error) {
        errorText.value = error.message || "Failed to create listing.";
      } finally {
        submitting.value = false;
      }
    }

    onMounted(ensureDistricts);

    return {
      appState,
      form,
      submitting,
      errorText,
      successText,
      submit,
    };
  },
  template: `
    <section class="card section">
      <h2 style="margin:0 0 12px;font-size:20px;">Create Listing</h2>
      <div class="field">
        <label>Type</label>
        <select class="select" v-model="form.listing_type">
          <option value="sale">Sale</option>
          <option value="wanted">Wanted</option>
        </select>
      </div>
      <div class="field">
        <label>Title</label>
        <input class="input" v-model.trim="form.title" placeholder="Used iPad for sale" />
      </div>
      <div class="field">
        <label>Description</label>
        <textarea class="textarea" v-model.trim="form.description" placeholder="Add condition, meetup area, notes"></textarea>
      </div>
      <div class="row">
        <div class="field" style="flex:1;">
          <label>Price</label>
          <input class="input" type="number" min="0" v-model="form.price" placeholder="199" />
        </div>
        <div class="field" style="flex:1;">
          <label>District</label>
          <select class="select" v-model="form.district_code">
            <option value="">Select district</option>
            <option v-for="item in appState.districts" :key="item.code" :value="item.code">
              {{ item.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Image URLs</label>
        <textarea class="textarea" v-model.trim="form.image_urls_text" placeholder="One URL per line"></textarea>
      </div>
      <button class="btn btn-primary" :disabled="submitting" @click="submit">
        {{ submitting ? 'Submitting...' : 'Submit' }}
      </button>
      <div class="error" v-if="errorText">{{ errorText }}</div>
      <div class="success" v-if="successText">{{ successText }}</div>
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
        errorText.value = error.message || "Failed to load conversations.";
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
      formatTime,
    };
  },
  template: `
    <section class="card section">
      <h2 style="margin:0;font-size:20px;">Messages</h2>
      <div class="muted" style="margin-top:6px;">Open a chat from any listing.</div>
    </section>

    <section v-if="loading" class="card section muted">Loading conversations...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <section v-else class="chat-list">
      <article
        class="card chat-item"
        v-for="item in items"
        :key="item.id"
        @click="openDetail(item)"
        style="cursor:pointer;"
      >
        <div class="chat-line">
          <div class="chat-title">{{ item.peer_nickname }}</div>
          <div class="muted">{{ formatTime(item.updated_at) }}</div>
        </div>
        <div class="muted">{{ item.listing_title }} 路 {{ formatPrice(item.listing_price) }}</div>
        <div style="margin-top:8px;">{{ item.last_message || 'No messages yet.' }}</div>
      </article>
      <div v-if="!items.length" class="card section muted">No conversations yet.</div>
    </section>
  `,
};

const MessageDetailPage = {
  setup() {
    const route = useRoute();
    const loading = ref(false);
    const errorText = ref("");
    const detail = ref(null);
    const messages = ref([]);
    const inputText = ref("");
    const sending = ref(false);
    const panelRef = ref(null);

    async function loadDetail() {
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
        await apiRequest(`/api/web/conversations/${conversationId}/read`, { method: "POST" });
        await nextTick();
        if (panelRef.value) {
          panelRef.value.scrollTop = panelRef.value.scrollHeight;
        }
      } catch (error) {
        errorText.value = error.message || "Failed to load conversation.";
      } finally {
        loading.value = false;
      }
    }

    async function sendMessage() {
      const content = inputText.value.trim();
      if (!content || sending.value) {
        return;
      }

      sending.value = true;
      try {
        const conversationId = encodeURIComponent(route.params.id);
        const message = await apiRequest(`/api/web/conversations/${conversationId}/messages`, {
          method: "POST",
          body: { content },
        });
        messages.value.push(message);
        inputText.value = "";
        await nextTick();
        if (panelRef.value) {
          panelRef.value.scrollTop = panelRef.value.scrollHeight;
        }
      } catch (error) {
        window.alert(error.message || "Failed to send message.");
      } finally {
        sending.value = false;
      }
    }

    onMounted(loadDetail);

    return {
      appState,
      loading,
      errorText,
      detail,
      messages,
      inputText,
      sending,
      sendMessage,
      panelRef,
      formatPrice,
      formatTime,
    };
  },
  template: `
    <section v-if="loading" class="card section muted">Loading conversation...</section>
    <section v-else-if="errorText" class="card section error">{{ errorText }}</section>
    <template v-else>
      <section class="card section" v-if="detail">
        <div style="font-size:17px;font-weight:700;">{{ detail.listing?.title || 'Conversation' }}</div>
        <div class="muted" style="margin-top:6px;">
          Peer: {{ detail.peer_nickname }} 路 {{ formatPrice(detail.listing?.price) }}
        </div>
      </section>

      <section class="card section">
        <div class="msg-panel" ref="panelRef">
          <div
            v-for="item in messages"
            :key="item.id"
            class="msg-row"
            :class="{ mine: appState.user && item.sender_openid === appState.user.openid }"
          >
            <div class="msg-bubble">
              <div>{{ item.content }}</div>
              <div class="muted" style="font-size:11px;margin-top:6px;">{{ formatTime(item.created_at) }}</div>
            </div>
          </div>
          <div v-if="!messages.length" class="muted">No messages yet.</div>
        </div>
      </section>

      <section class="card section">
        <div class="row">
          <input class="input" style="flex:1;" v-model.trim="inputText" placeholder="Type a message..." @keydown.enter="sendMessage" />
          <button class="btn btn-primary" :disabled="sending" @click="sendMessage">
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </section>
    </template>
  `,
};

const ProfilePage = {
  setup() {
    const loading = ref(false);
    const errorText = ref("");
    const myListings = ref([]);

    async function loadMyListings() {
      loading.value = true;
      errorText.value = "";
      try {
        const data = await apiRequest("/api/web/me/listings");
        myListings.value = Array.isArray(data) ? data : [];
      } catch (error) {
        errorText.value = error.message || "Failed to load my listings.";
      } finally {
        loading.value = false;
      }
    }

    function logout() {
      clearAuth();
      myListings.value = [];
    }

    onMounted(loadMyListings);

    return {
      appState,
      loading,
      errorText,
      myListings,
      logout,
      formatPrice,
      formatTime,
    };
  },
  template: `
    <section class="card section">
      <h2 style="margin:0 0 10px;font-size:20px;">My Account</h2>
      <div style="font-size:18px;font-weight:700;">{{ appState.user?.nickname || 'Local user' }}</div>
      <div class="muted" style="margin-top:6px;">Account: {{ appState.user?.openid }}</div>
      <div class="muted">Role: {{ appState.user?.role }}</div>
      <div class="actions">
        <button class="btn btn-ghost" @click="logout">Logout</button>
      </div>
    </section>

    <section class="card section">
      <h3 style="margin:0 0 10px;font-size:18px;">My Listings</h3>
      <div class="error" v-if="errorText">{{ errorText }}</div>
      <div v-if="loading" class="muted">Loading...</div>
      <div v-else-if="!myListings.length" class="muted">No listings yet.</div>
      <div v-else class="chat-list">
        <article class="card chat-item" v-for="item in myListings" :key="item.id">
          <div class="chat-line">
            <div class="chat-title">{{ item.title }}</div>
            <span class="badge">{{ item.status }}</span>
          </div>
          <div class="muted">{{ formatPrice(item.price) }} 路 {{ formatTime(item.created_at) }}</div>
        </article>
      </div>
    </section>
  `,
};

const routes = [
  { path: "/", component: HomePage },
  { path: "/listing/:id", component: ListingDetailPage },
  { path: "/login", component: LoginPage },
  { path: "/publish", component: PublishPage, meta: { auth: true } },
  { path: "/messages", component: MessagesPage, meta: { auth: true } },
  { path: "/messages/:id", component: MessageDetailPage, meta: { auth: true } },
  { path: "/me", component: ProfilePage, meta: { auth: true } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!appState.districts.length) {
    ensureDistricts().catch(() => {});
  }

  if (to.meta?.auth && !appState.token) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`;
  }

  if (to.path === "/login" && appState.token) {
    return "/me";
  }

  return true;
});

const AppRoot = {
  setup() {
    const route = useRoute();

    const currentTab = computed(() => {
      if (route.path.startsWith("/publish")) {
        return "publish";
      }
      if (route.path.startsWith("/messages")) {
        return "messages";
      }
      if (route.path.startsWith("/me") || route.path.startsWith("/login")) {
        return "me";
      }
      return "home";
    });

    return {
      appState,
      currentTab,
    };
  },
  template: `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">Local Trader Web</div>
        <div class="user-pill">
          {{ appState.user ? (appState.user.nickname || appState.user.openid) : 'Guest' }}
        </div>
      </header>

      <router-view />

      <nav class="footer-nav">
        <router-link to="/" :class="{ active: currentTab === 'home' }">Home</router-link>
        <router-link to="/publish" :class="{ active: currentTab === 'publish' }">Publish</router-link>
        <router-link to="/messages" :class="{ active: currentTab === 'messages' }">Messages</router-link>
        <router-link to="/me" :class="{ active: currentTab === 'me' }">Me</router-link>
      </nav>
    </div>
  `,
};

async function bootstrap() {
  if (appState.token) {
    await refreshMe();
  }

  await ensureDistricts().catch(() => {});

  const app = createApp(AppRoot);
  app.use(router);
  app.mount("#app");
}

bootstrap();

