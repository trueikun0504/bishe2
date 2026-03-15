/**
 * CloudBase bootstrap helpers for the MVP environment.
 *
 * Responsibilities:
 * 1. Ensure the expected collections exist
 * 2. Seed district data in a flat document shape
 * 3. Clean up legacy documents accidentally written as { data: ... }
 */

const { db, env, hasStaticCredentials } = require("./cloudbase");
const {
  districts: DISTRICT_SEED,
  metadata: DISTRICT_METADATA,
} = require("./data/china-districts.generated");

const COLLECTION_PLAN = [
  "users",
  "districts",
  "categories",
  "listings",
  "listing_images",
  "conversations",
  "messages",
  "feedback",
  "admin_actions",
  "orders",
];

const INDEX_PLAN = {
  users: ["openid/open_id + status"],
  districts: ["city_code + is_active"],
  categories: ["parent_id + sort_order", "is_active + sort_order"],
  listings: [
    "status + district_code + created_at",
    "seller_id + created_at",
  ],
  listing_images: ["listing_id + sort_order"],
  conversations: [
    "buyer_openid + updated_at",
    "seller_openid + updated_at",
    "listing_id + buyer_openid",
  ],
  messages: ["conversation_id + created_at"],
  feedback: ["created_at"],
  orders: [
    "order_id + status",
    "buyer_openid + created_at",
    "seller_openid + created_at",
  ],
  admin_actions: [
    "target_type + target_id",
    "admin_user_id + created_at",
  ],
};

const CATEGORY_SEED = [
  {
    id: "cat-1",
    name: "鎵嬫満鏁扮爜",
    icon: "馃摫",
    parent_id: "",
    is_active: true,
    sort_order: 1,
    description: "鎵嬫満銆佸钩鏉裤€佹暟鐮侀厤浠剁瓑",
  },
  {
    id: "cat-2",
    name: "鐢佃剳鍔炲叕",
    icon: "馃捇",
    parent_id: "",
    is_active: true,
    sort_order: 2,
    description: "鐢佃剳銆佸璁俱€佸姙鍏澶?",
  },
  {
    id: "cat-3",
    name: "瀹剁敤鐢靛櫒",
    icon: "馃彔",
    parent_id: "",
    is_active: true,
    sort_order: 3,
    description: "澶у鐢点€佸皬瀹剁數銆佸帹鎴跨數鍣?",
  },
  {
    id: "cat-4",
    name: "鏈嶉グ闉嬪寘",
    icon: "馃憰",
    parent_id: "",
    is_active: true,
    sort_order: 4,
    description: "鏈嶈銆侀瀷闈淬€佺鍖?",
  },
  {
    id: "cat-5",
    name: "缇庡涓姢",
    icon: "馃拕",
    parent_id: "",
    is_active: true,
    sort_order: 5,
    description: "鍖栧鍝併€佹姢鑲ゅ搧銆佷釜浜烘姢鐞?",
  },
  {
    id: "cat-6",
    name: "姣嶅┐鐢ㄥ搧",
    icon: "馃懚",
    parent_id: "",
    is_active: true,
    sort_order: 6,
    description: "濠村辜鍎跨敤鍝併€佸瓡濡囩敤鍝?",
  },
  {
    id: "cat-7",
    name: "瀹跺眳鏃ョ敤",
    icon: "馃泲锔?",
    parent_id: "",
    is_active: true,
    sort_order: 7,
    description: "瀹跺叿銆佸灞呰楗般€佹棩鐢ㄥ搧",
  },
  {
    id: "cat-8",
    name: "杩愬姩鎴峰",
    icon: "鈿?",
    parent_id: "",
    is_active: true,
    sort_order: 8,
    description: "杩愬姩鍣ㄦ潗銆佹埛澶栬澶?",
  },
  {
    id: "cat-9",
    name: "鍥句功闊冲儚",
    icon: "馃摎",
    parent_id: "",
    is_active: true,
    sort_order: 9,
    description: "鍥句功銆侀煶鍍忓埗鍝併€佹枃鍏?",
  },
  {
    id: "cat-10",
    name: "杞﹁締閰嶄欢",
    icon: "馃殫",
    parent_id: "",
    is_active: true,
    sort_order: 10,
    description: "姹借溅銆佺數鍔ㄨ溅銆佽嚜琛岃溅鍙婇厤浠?",
  },
  {
    id: "cat-11",
    name: "鍏朵粬",
    icon: "馃摝",
    parent_id: "",
    is_active: true,
    sort_order: 11,
    description: "鍏朵粬鏈垎绫荤墿鍝?",
  },
];

function normalizeDoc(doc) {
  if (
    doc &&
    typeof doc === "object" &&
    !Array.isArray(doc) &&
    doc.data &&
    typeof doc.data === "object" &&
    !Array.isArray(doc.data)
  ) {
    const merged = {
      ...doc,
      ...doc.data,
      _id: doc._id,
    };
    delete merged.data;
    return merged;
  }

  return doc;
}

async function listCollection(collectionName, limit = 100) {
  const result = await db.collection(collectionName).limit(limit).get();
  return (result.data || []).map(normalizeDoc);
}

function isCollectionExistsError(error) {
  const message = String(error && error.message ? error.message : "").toLowerCase();
  const code = String(error && error.code ? error.code : "").toLowerCase();
  return (
    code.includes("exist") ||
    message.includes("already exist") ||
    message.includes("already exists")
  );
}

async function runInBatches(items, worker, batchSize = 50) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.all(batch.map((item, batchIndex) => worker(item, index + batchIndex)));
  }
}

async function ensureCollections() {
  for (const name of COLLECTION_PLAN) {
    try {
      await db.createCollection(name);
      console.log(`[collections] ${name}: created`);
    } catch (error) {
      if (isCollectionExistsError(error)) {
        console.log(`[collections] ${name}: already exists`);
        continue;
      }

      throw error;
    }
  }
}

async function removeWrappedDocs(collectionName) {
  const result = await db.collection(collectionName).limit(100).get();
  const wrappedDocs = (result.data || []).filter(
    (doc) =>
      doc &&
      typeof doc === "object" &&
      !Array.isArray(doc) &&
      doc.data &&
      typeof doc.data === "object" &&
      !Array.isArray(doc.data)
  );

  for (const doc of wrappedDocs) {
    await db.collection(collectionName).doc(doc._id).remove();
  }

  return wrappedDocs.length;
}

async function seedDistricts() {
  const removedWrapped = await removeWrappedDocs("districts");
  if (removedWrapped > 0) {
    console.log(`[districts] removed ${removedWrapped} wrapped legacy documents`);
  }

  const seeded = [];

  console.log(
    `[districts] syncing ${DISTRICT_SEED.length} county-level divisions from snapshot ${DISTRICT_METADATA.generated_at}`,
  );

  await runInBatches(
    DISTRICT_SEED,
    async (district, index) => {
      const docId = `district-${district.code}`;
      const payload = {
        id: docId,
        ...district,
        created_at: new Date("2026-03-10T09:00:00.000Z"),
        updated_at: new Date("2026-03-10T09:00:00.000Z"),
      };

      await db.collection("districts").doc(docId).set(payload);
      seeded.push(payload);

      if ((index + 1) % 200 === 0 || index === DISTRICT_SEED.length - 1) {
        console.log(`[districts] ${index + 1}/${DISTRICT_SEED.length} synced`);
      }
    },
    40,
  );

  return seeded;
}

async function seedCategories() {
  const removedWrapped = await removeWrappedDocs("categories");
  if (removedWrapped > 0) {
    console.log(`[categories] removed ${removedWrapped} wrapped legacy documents`);
  }

  const seeded = [];
  const now = new Date().toISOString();

  for (const category of CATEGORY_SEED) {
    const docId = `category-${category.id}`;
    const payload = {
      id: docId,
      ...category,
      created_at: now,
      updated_at: now,
    };

    await db.collection("categories").doc(docId).set(payload);
    seeded.push(payload);
    console.log(`[categories] ${category.id} ${category.name}: upserted`);
  }

  return seeded;
}

function printPlan() {
  console.log("=== COLLECTION PLAN ===");
  for (const name of COLLECTION_PLAN) {
    console.log(`- ${name}`);
  }

  console.log("=== INDEX PLAN ===");
  for (const [name, indexes] of Object.entries(INDEX_PLAN)) {
    console.log(`- ${name}`);
    for (const index of indexes) {
      console.log(`  - ${index}`);
    }
  }
}

async function main() {
  console.log(`Connecting to CloudBase env: ${env}`);
  console.log(`Credential mode: ${hasStaticCredentials ? "static" : "runtime"}`);
  printPlan();
  await ensureCollections();
  const districts = await seedDistricts();
  const categories = await seedCategories();
  console.log(`Bootstrapped ${districts.length} districts and ${categories.length} categories.`);
  console.log("CloudBase bootstrap completed.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  });
}

module.exports = {
  COLLECTION_PLAN,
  DISTRICT_SEED,
  CATEGORY_SEED,
  INDEX_PLAN,
  ensureCollections,
  listCollection,
  normalizeDoc,
  removeWrappedDocs,
  seedDistricts,
  seedCategories,
};

