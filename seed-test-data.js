/**
 * Seed CloudBase test data for Data Infra Agent day 1-2 tasks.
 *
 * Scope:
 * - districts: at least 2 active districts
 * - listings: 5 approved listings with image_urls
 * - listing_images: optional mirror for admin/detail compatibility
 * - users: 1 admin + seller seed accounts
 */

const { db, env, hasStaticCredentials } = require("./cloudbase");
const {
  DISTRICT_SEED,
  ensureCollections,
  listCollection,
  removeWrappedDocs,
  seedDistricts,
} = require("./init-db");

const DEFAULT_ADMIN_OPEN_ID = "100036640483";
const ADMIN_OPEN_ID = process.env.ADMIN_OPEN_ID || DEFAULT_ADMIN_OPEN_ID;
const SERVICE_OPEN_ID = process.env.SERVICE_OPEN_ID || "service-001";

const SELLER_USERS = [
  {
    docId: "user-seller-001",
    openid: "seller-001",
    nickname: "测试卖家 A",
    avatar_url: "https://placehold.co/200x200/png?text=seller-001",
    default_city_code: "330100",
    default_district_code: "330106",
  },
  {
    docId: "user-seller-002",
    openid: "seller-002",
    nickname: "测试卖家 B",
    avatar_url: "https://placehold.co/200x200/png?text=seller-002",
    default_city_code: "330100",
    default_district_code: "330105",
  },
  {
    docId: "user-seller-003",
    openid: "seller-003",
    nickname: "测试卖家 C",
    avatar_url: "https://placehold.co/200x200/png?text=seller-003",
    default_city_code: "420100",
    default_district_code: "420111",
  },
];

const SEEDED_USERS = [
  {
    docId: `user-admin-${ADMIN_OPEN_ID}`,
    openid: ADMIN_OPEN_ID,
    nickname: "管理员",
    avatar_url: "",
    role: "admin",
    status: "active",
    default_city_code: "330100",
    default_district_code: "330106",
    created_at: new Date("2026-03-10T09:30:00.000Z"),
  },
  {
    docId: `user-service-${SERVICE_OPEN_ID}`,
    openid: SERVICE_OPEN_ID,
    nickname: "社区客服",
    avatar_url: "",
    role: "customer_service",
    status: "active",
    default_city_code: "330100",
    default_district_code: "330106",
    created_at: new Date("2026-03-10T09:30:30.000Z"),
  },
  ...SELLER_USERS.map((user, index) => ({
    ...user,
    role: "user",
    status: "active",
    created_at: new Date(`2026-03-10T09:3${index + 1}:00.000Z`),
  })),
];

const DISTRICT_BY_CODE = DISTRICT_SEED.reduce((map, district) => {
  map[district.code] = district;
  return map;
}, {});

const LISTING_BLUEPRINTS = [
  {
    id: "listing-seed-mi13",
    openid: "seller-001",
    seller_id: "user-seller-001",
    category_id: "cat-1",
    title: "二手小米 13 12+256GB",
    description: "使用 8 个月，功能正常，无拆修，附原装充电器和透明壳。",
    price: 1799,
    district_code: "330106",
    created_at: new Date("2026-03-08T02:00:00.000Z"),
    view_count: 28,
    contact_count: 4,
    image_urls: [
      "https://placehold.co/1200x900/png?text=mi13-front",
      "https://placehold.co/1200x900/png?text=mi13-back",
      "https://placehold.co/1200x900/png?text=mi13-box",
    ],
  },
  {
    id: "listing-seed-desk",
    openid: "seller-002",
    seller_id: "user-seller-002",
    category_id: "cat-2",
    title: "宜家 120cm 升降书桌",
    description: "桌面轻微使用痕迹，升降顺畅，适合宿舍或出租屋。",
    price: 680,
    district_code: "330105",
    created_at: new Date("2026-03-08T08:00:00.000Z"),
    view_count: 16,
    contact_count: 2,
    image_urls: [
      "https://placehold.co/1200x900/png?text=desk-full",
      "https://placehold.co/1200x900/png?text=desk-detail",
    ],
  },
  {
    id: "listing-seed-bike",
    openid: "seller-003",
    seller_id: "user-seller-003",
    category_id: "cat-10",
    title: "捷安特通勤自行车",
    description: "26 寸，适合日常代步，刹车和变速正常，武汉本地自提。",
    price: 950,
    district_code: "420111",
    created_at: new Date("2026-03-09T01:30:00.000Z"),
    view_count: 11,
    contact_count: 1,
    image_urls: [
      "https://placehold.co/1200x900/png?text=bike-side",
    ],
  },
  {
    id: "listing-seed-ipad",
    openid: "seller-001",
    seller_id: "user-seller-001",
    category_id: "cat-1",
    title: "iPad Air 4 64GB 深空灰",
    description: "仅用于追剧和记笔记，屏幕无坏点，带保护套。",
    price: 2280,
    district_code: "420106",
    created_at: new Date("2026-03-09T06:20:00.000Z"),
    view_count: 19,
    contact_count: 3,
    image_urls: [
      "https://placehold.co/1200x900/png?text=ipad-air4",
    ],
  },
  {
    id: "listing-seed-rice-cooker",
    openid: "seller-002",
    seller_id: "user-seller-002",
    category_id: "cat-3",
    title: "九阳 4L 电饭煲",
    description: "租房搬家处理，煮饭正常，内胆无磕碰。",
    price: 120,
    district_code: "330110",
    created_at: new Date("2026-03-09T11:45:00.000Z"),
    view_count: 8,
    contact_count: 1,
    image_urls: [
      "https://placehold.co/1200x900/png?text=rice-cooker",
    ],
  },
  {
    id: "listing-seed-wanted-seat",
    openid: "seller-003",
    seller_id: "user-seller-003",
    category_id: "cat-6",
    title: "求购 9 成新儿童安全座椅",
    description: "希望在武汉洪山区附近面交，预算 300 元以内，可先发截图和实拍图沟通。",
    price: 300,
    district_code: "420111",
    listing_type: "wanted",
    created_at: new Date("2026-03-09T13:20:00.000Z"),
    view_count: 13,
    contact_count: 2,
    image_urls: [
      "https://placehold.co/1200x900/png?text=wanted-seat",
    ],
  },
];

function getOpenId(doc) {
  return doc.openid || doc.open_id || "";
}

async function removeDocs(collectionName, docIds) {
  for (const docId of docIds) {
    await db.collection(collectionName).doc(docId).remove();
  }
}

function buildUserPayload(user) {
  return {
    id: user.docId,
    openid: user.openid,
    open_id: user.openid,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    role: user.role,
    status: user.status,
    default_city_code: user.default_city_code,
    default_district_code: user.default_district_code,
    created_at: user.created_at,
    updated_at: new Date("2026-03-10T09:40:00.000Z"),
  };
}

function buildListingPayload(blueprint) {
  const district = DISTRICT_BY_CODE[blueprint.district_code];

  return {
    id: blueprint.id,
    openid: blueprint.openid,
    open_id: blueprint.openid,
    seller_id: blueprint.seller_id,
    category_id: blueprint.category_id || "cat-11",
    listing_type: blueprint.listing_type || "sale",
    title: blueprint.title,
    description: blueprint.description,
    price: blueprint.price,
    district_code: blueprint.district_code,
    district_name: district.name,
    city_code: district.city_code,
    city_name: district.city_name,
    status: "approved",
    review_status: "approved",
    reject_reason: "",
    image_urls: blueprint.image_urls,
    cover_image_url: blueprint.image_urls[0],
    image_count: blueprint.image_urls.length,
    view_count: blueprint.view_count,
    contact_count: blueprint.contact_count,
    created_at: blueprint.created_at,
    updated_at: new Date("2026-03-10T09:45:00.000Z"),
  };
}

function buildListingImagePayloads(listing) {
  return listing.image_urls.map((imageUrl, index) => {
    const order = index + 1;
    const docId = `listing-image-${listing.id}-${order}`;

    return {
      docId,
      payload: {
        id: docId,
        listing_id: listing.id,
        image_url: imageUrl,
        order,
        sort_order: order,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
      },
    };
  });
}

async function cleanUsers() {
  const removedWrapped = await removeWrappedDocs("users");
  const existing = await listCollection("users");
  const targetUserIds = new Set(SEEDED_USERS.map((user) => user.docId));
  const targetOpenIds = new Set(SEEDED_USERS.map((user) => user.openid));

  const toDelete = existing
    .filter(
      (doc) =>
        targetUserIds.has(doc._id) ||
        targetUserIds.has(doc.id) ||
        targetOpenIds.has(getOpenId(doc))
    )
    .map((doc) => doc._id);

  await removeDocs("users", toDelete);

  return {
    removedWrapped,
    removedFlat: toDelete.length,
  };
}

async function cleanListings() {
  const removedWrapped = await removeWrappedDocs("listings");
  const existing = await listCollection("listings");
  const targetIds = new Set(LISTING_BLUEPRINTS.map((listing) => listing.id));

  const toDelete = existing
    .filter((doc) => targetIds.has(doc._id) || targetIds.has(doc.id))
    .map((doc) => doc._id);

  await removeDocs("listings", toDelete);

  return {
    removedWrapped,
    removedFlat: toDelete.length,
  };
}

async function cleanListingImages() {
  const removedWrapped = await removeWrappedDocs("listing_images");
  const existing = await listCollection("listing_images");
  const targetIds = new Set(
    LISTING_BLUEPRINTS.flatMap((listing) =>
      listing.image_urls.map(
        (_, index) => `listing-image-${listing.id}-${index + 1}`
      )
    )
  );

  const toDelete = existing
    .filter((doc) => targetIds.has(doc._id) || targetIds.has(doc.id))
    .map((doc) => doc._id);

  await removeDocs("listing_images", toDelete);

  return {
    removedWrapped,
    removedFlat: toDelete.length,
  };
}

async function seedUsers() {
  for (const user of SEEDED_USERS) {
    await db.collection("users").doc(user.docId).set(buildUserPayload(user));
  }
}

async function seedListings() {
  const seededListings = LISTING_BLUEPRINTS.map(buildListingPayload);

  for (const listing of seededListings) {
    await db.collection("listings").doc(listing.id).set(listing);

    const listingImages = buildListingImagePayloads(listing);
    for (const image of listingImages) {
      await db.collection("listing_images").doc(image.docId).set(image.payload);
    }
  }

  return seededListings;
}

async function verifyData() {
  const districts = await listCollection("districts");
  const listings = await listCollection("listings");
  const users = await listCollection("users");
  const listingImages = await listCollection("listing_images");

  const approvedListings = listings.filter((listing) => listing.status === "approved");
  const adminUsers = users.filter(
    (user) => getOpenId(user) === ADMIN_OPEN_ID && user.role === "admin"
  );

  return {
    districts,
    approvedListings,
    users,
    listingImages,
    adminUsers,
  };
}

async function main() {
  console.log(`Connecting to CloudBase env: ${env}`);
  console.log(`Credential mode: ${hasStaticCredentials ? "static" : "runtime"}`);

  if (!process.env.ADMIN_OPEN_ID) {
    console.log(
      `ADMIN_OPEN_ID is not set in .env, using fallback from execution docs: ${DEFAULT_ADMIN_OPEN_ID}`
    );
  }

  await ensureCollections();
  await seedDistricts();

  const userCleanup = await cleanUsers();
  const listingCleanup = await cleanListings();
  const imageCleanup = await cleanListingImages();

  console.log(
    `Cleanup summary: users wrapped=${userCleanup.removedWrapped}, users flat=${userCleanup.removedFlat}, listings wrapped=${listingCleanup.removedWrapped}, listings flat=${listingCleanup.removedFlat}, listing_images wrapped=${imageCleanup.removedWrapped}, listing_images flat=${imageCleanup.removedFlat}`
  );

  await seedUsers();
  const seededListings = await seedListings();

  const verification = await verifyData();

  console.log(`Seeded users: ${SEEDED_USERS.length}`);
  console.log(`Seeded approved listings: ${seededListings.length}`);
  console.log(`Seeded listing_images: ${verification.listingImages.length}`);
  console.log(`Active districts available: ${verification.districts.length}`);
  console.log(`Admin users matching ADMIN_OPEN_ID: ${verification.adminUsers.length}`);

  console.log("\nApproved listings:");
  for (const listing of verification.approvedListings) {
    console.log(`- ${listing.id}: ${listing.title}`);
  }

  console.log("\nAdmin account:");
  for (const user of verification.adminUsers) {
    console.log(`- ${getOpenId(user)} (${user.role})`);
  }

  const missingImages = verification.approvedListings.filter(
    (listing) => !Array.isArray(listing.image_urls) || listing.image_urls.length === 0
  );

  if (verification.districts.length < 2) {
    throw new Error("Expected at least 2 districts after seeding.");
  }

  if (verification.approvedListings.length < 5) {
    throw new Error("Expected at least 5 approved listings after seeding.");
  }

  if (verification.adminUsers.length !== 1) {
    throw new Error("Expected exactly 1 admin user matching ADMIN_OPEN_ID.");
  }

  if (missingImages.length > 0) {
    throw new Error("Some approved listings are missing image_urls.");
  }

  console.log("\nCloudBase test data is ready for hot/cold integration.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
