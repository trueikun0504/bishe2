/**
 * CloudBase 数据初始化草案
 *
 * 用途：
 * 1. 初始化 MVP 测试区县数据
 * 2. 输出集合与索引规划
 *
 * 前提：
 * 1. 已创建 CloudBase 环境
 * 2. 已安装 @cloudbase/node-sdk
 * 3. 环境变量中存在 CLOUDBASE_ENV
 */

const cloudbase = require("@cloudbase/node-sdk");

const ENV = process.env.CLOUDBASE_ENV;

if (!ENV) {
  throw new Error("Missing CLOUDBASE_ENV");
}

const app = cloudbase.init({ env: ENV });
const db = app.database();

const COLLECTION_PLAN = [
  "users",
  "districts",
  "listings",
  "listing_images",
  "conversations",
  "messages",
  "feedback",
  "admin_actions",
];

const INDEX_PLAN = {
  users: ["open_id(unique)", "status"],
  districts: ["city_code + is_active"],
  listings: [
    "status + district_code + created_at",
    "seller_id + created_at",
  ],
  listing_images: ["listing_id + sort_order"],
  conversations: [
    "buyer_id + updated_at",
    "seller_id + updated_at",
    "listing_id + buyer_id",
  ],
  messages: [
    "conversation_id + created_at",
    "receiver_id + read_status",
  ],
  feedback: ["status + created_at"],
  admin_actions: [
    "target_type + target_id",
    "admin_user_id + created_at",
  ],
};

const DISTRICT_SEED = [
  {
    code: "330106",
    name: "西湖区",
    city_code: "330100",
    city_name: "杭州市",
    province_code: "330000",
    province_name: "浙江省",
    is_active: true,
    sort_order: 1,
  },
  {
    code: "330105",
    name: "拱墅区",
    city_code: "330100",
    city_name: "杭州市",
    province_code: "330000",
    province_name: "浙江省",
    is_active: true,
    sort_order: 2,
  },
  {
    code: "330110",
    name: "余杭区",
    city_code: "330100",
    city_name: "杭州市",
    province_code: "330000",
    province_name: "浙江省",
    is_active: true,
    sort_order: 3,
  },
  {
    code: "420111",
    name: "洪山区",
    city_code: "420100",
    city_name: "武汉市",
    province_code: "420000",
    province_name: "湖北省",
    is_active: true,
    sort_order: 4,
  },
  {
    code: "420106",
    name: "武昌区",
    city_code: "420100",
    city_name: "武汉市",
    province_code: "420000",
    province_name: "湖北省",
    is_active: true,
    sort_order: 5,
  },
  {
    code: "420103",
    name: "江汉区",
    city_code: "420100",
    city_name: "武汉市",
    province_code: "420000",
    province_name: "湖北省",
    is_active: true,
    sort_order: 6,
  },
];

function now() {
  return new Date();
}

async function upsertByField(collectionName, fieldName, value, payload) {
  const collection = db.collection(collectionName);
  const existing = await collection.where({ [fieldName]: value }).get();

  if (existing.data && existing.data.length > 0) {
    const record = existing.data[0];
    await collection.doc(record._id).update({
      data: {
        ...payload,
        updated_at: now(),
      },
    });
    return { action: "updated", id: record._id };
  }

  const result = await collection.add({
    data: {
      ...payload,
      created_at: payload.created_at || now(),
      updated_at: payload.updated_at || now(),
    },
  });
  return { action: "created", id: result.id };
}

async function seedDistricts() {
  for (const district of DISTRICT_SEED) {
    const result = await upsertByField("districts", "code", district.code, district);
    console.log(`[districts] ${district.name}: ${result.action}`);
  }
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
  printPlan();
  await seedDistricts();
  console.log("CloudBase bootstrap draft completed.");
  console.log("提示：管理员账号请在 users 集合中单独设置 role=admin。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
