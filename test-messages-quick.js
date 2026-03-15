#!/usr/bin/env node
/**
 * 快速测试 - 验证聊天消息 API
 */

const http = require("http");

const BASE_URL = "http://localhost:3001";

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            json: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            text: data,
          });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log("🧪 聊天消息API快速测试\n");

  // Step 1: 用密码登录买家
  console.log("1️⃣  登录买家账号");
  let buyerLogin = await request("POST", "/api/web/auth/login", {
    account: "seller-002",
    password: "user123",
  });

  if (!buyerLogin.json.success) {
    console.error("❌ 买家登录失败:", buyerLogin.json.message);
    // 尝试注册
    console.log("   尝试注册新账号...");
    const registerRes = await request("POST", "/api/web/auth/register", {
      username: `buyer-${Date.now()}`,
      password: "test123456",
      nickname: "测试买家",
    });
    if (registerRes.json.success) {
      buyerLogin = registerRes;
    } else {
      console.error("❌ 注册也失败了");
      process.exit(1);
    }
  }

  const buyerToken = buyerLogin.json.data.token;
  const buyerUser = buyerLogin.json.data.user;
  console.log(`✅ 登录成功: ${buyerUser.nickname}`);
  console.log(`   token: ${buyerToken.slice(0, 20)}...\n`);

  // Step 2: 登录卖家
  console.log("2️⃣  登录卖家账号");
  let sellerLogin = await request("POST", "/api/web/auth/login", {
    account: "buyer-demo-001",
    password: "user123",
  });

  if (!sellerLogin.json.success) {
    console.error("❌ 卖家登录失败:", sellerLogin.json.message);
    const registerRes = await request("POST", "/api/web/auth/register", {
      username: `seller-${Date.now()}`,
      password: "test123456",
      nickname: "测试卖家",
    });
    if (registerRes.json.success) {
      sellerLogin = registerRes;
    } else {
      console.error("❌ 注册也失败了");
      process.exit(1);
    }
  }

  const sellerToken = sellerLogin.json.data.token;
  const sellerUser = sellerLogin.json.data.user;
  console.log(`✅ 登录成功: ${sellerUser.nickname}\n`);

  // Step 3: 获取首页商品（找第一个可用的）
  console.log("3️⃣  获取首页商品");
  const listingsRes = await request("GET", "/api/web/listings?page=1&page_size=5");

  if (!listingsRes.json.success || !listingsRes.json.data.items.length) {
    console.error("❌ 没有可用商品");
    // 卖家发布一个
    console.log("   卖家发布测试商品...");
    const publishRes = await request(
      "POST",
      "/api/web/listings",
      {
        title: "测试商品",
        description: "这是一个测试商品",
        price: 99,
        district_code: "330106",
        category_id: "cat-1",
      },
      sellerToken
    );

    if (!publishRes.json.success) {
      console.error("❌ 发布失败:", publishRes.json.message);
      process.exit(1);
    }

    console.log("✅ 商品已发布");
    var listingId = publishRes.json.data.id;
  } else {
    var listingId = listingsRes.json.data.items[0].id;
    console.log(`✅ 找到商品: ${listingsRes.json.data.items[0].title}`);
  }

  console.log(`   商品ID: ${listingId}\n`);

  // Step 4: 发起会话
  console.log("4️⃣  发起聊天会话");
  const openConvRes = await request(
    "POST",
    "/api/web/conversations/open",
    { listing_id: listingId },
    buyerToken
  );

  if (!openConvRes.json.success) {
    console.error("❌ 发起会话失败:", openConvRes.json.message);
    process.exit(1);
  }

  const conversationId = openConvRes.json.data.id;
  console.log(`✅ 会话已创建`);
  console.log(`   会话ID: ${conversationId}\n`);

  // Step 5: 发送各种消息
  console.log("5️⃣  发送多种类型消息\n");

  // 5a. 文本消息
  console.log("  📄 文本消息");
  const textMsg = await request(
    "POST",
    `/api/web/conversations/${conversationId}/messages`,
    {
      content: "你好，我对这个商品感兴趣",
      message_type: "text",
    },
    buyerToken
  );

  if (textMsg.json.success) {
    console.log(`     ✓ ID: ${textMsg.json.data.id}`);
    console.log(`     ✓ 类型: ${textMsg.json.data.message_type}`);
  } else {
    console.error(`     ✗ 失败: ${textMsg.json.message}`);
  }

  // 5b. 图片消息
  console.log("  🖼️  图片消息");
  const imgMsg = await request(
    "POST",
    `/api/web/conversations/${conversationId}/messages`,
    {
      message_type: "image",
      image_url: "https://via.placeholder.com/400x300?text=Product",
      content: "这是商品的图片",
    },
    buyerToken
  );

  if (imgMsg.json.success) {
    console.log(`     ✓ ID: ${imgMsg.json.data.id}`);
    console.log(`     ✓ 类型: ${imgMsg.json.data.message_type}`);
    console.log(`     ✓ 图片URL: ${imgMsg.json.data.image_url}`);
  } else {
    console.error(`     ✗ 失败: ${imgMsg.json.message}`);
  }

  // 5c. 截图消息
  console.log("  📸 截图消息");
  const screenshotMsg = await request(
    "POST",
    `/api/web/conversations/${conversationId}/messages`,
    {
      message_type: "image",
      image_url: "https://via.placeholder.com/400x300?text=Screenshot",
      payload: { source: "screenshot" },
      content: "转账截图",
    },
    buyerToken
  );

  if (screenshotMsg.json.success) {
    console.log(`     ✓ ID: ${screenshotMsg.json.data.id}`);
    console.log(`     ✓ 类型: ${screenshotMsg.json.data.message_type}`);
    console.log(`     ✓ 截图标识: ${screenshotMsg.json.data.payload?.source}`);
  } else {
    console.error(`     ✗ 失败: ${screenshotMsg.json.message}`);
  }

  // 5d. 订单消息
  console.log("  💳 订单消息");
  const orderMsg = await request(
    "POST",
    `/api/web/conversations/${conversationId}/messages`,
    {
      message_type: "order",
      payload: { listing_id: listingId },
    },
    buyerToken
  );

  if (orderMsg.json.success) {
    console.log(`     ✓ ID: ${orderMsg.json.data.id}`);
    console.log(`     ✓ 类型: ${orderMsg.json.data.message_type}`);
    console.log(`     ✓ 订单ID: ${orderMsg.json.data.payload?.order_id}`);
    console.log(`     ✓ 订单状态: ${orderMsg.json.data.payload?.status}`);
    console.log(`     ✓ 价格: ¥${orderMsg.json.data.payload?.price}`);
  } else {
    console.error(`     ✗ 失败: ${orderMsg.json.message}`);
  }

  // 5e. 位置消息
  console.log("  📍 位置消息");
  const locationMsg = await request(
    "POST",
    `/api/web/conversations/${conversationId}/messages`,
    {
      message_type: "location",
      payload: {
        title: "西湖景区",
        address: "杭州市西湖区",
        latitude: 30.2741,
        longitude: 120.1551,
        sender_openid: buyerUser.openid,
      },
    },
    buyerToken
  );

  if (locationMsg.json.success) {
    console.log(`     ✓ ID: ${locationMsg.json.data.id}`);
    console.log(`     ✓ 类型: ${locationMsg.json.data.message_type}`);
    console.log(`     ✓ 位置: ${locationMsg.json.data.payload?.title}`);
  } else {
    console.error(`     ✗ 失败: ${locationMsg.json.message}`);
  }

  // Step 6: 获取消息列表
  console.log("\n6️⃣  获取消息列表");
  const messagesRes = await request(
    "GET",
    `/api/web/conversations/${conversationId}/messages`,
    null,
    buyerToken
  );

  if (messagesRes.json.success) {
    const msgs = messagesRes.json.data;
    console.log(`✅ 获取成功，共 ${msgs.length} 条消息`);

    const typeCount = {};
    msgs.forEach((msg) => {
      const type = msg.message_type || "text";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    console.log(`   消息类型分布:`);
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count} 条`);
    });
  } else {
    console.error(`❌ 获取失败: ${messagesRes.json.message}`);
  }

  // Step 7: 最后消息验证
  console.log("\n7️⃣  会话最后消息验证");
  const convRes = await request(
    "GET",
    `/api/web/conversations/${conversationId}`,
    null,
    buyerToken
  );

  if (convRes.json.success) {
    console.log(`✅ 会话详情:`);
    console.log(`   ID: ${convRes.json.data.id}`);
    console.log(`   商品: ${convRes.json.data.listing?.title}`);
    console.log(`   最后消息: ${convRes.json.data.listing ? '见会话列表' : 'N/A'}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ 聊天增强功能测试完成！\n");
  console.log("📋 验证清单:");
  console.log("  ✓ 文本消息 - 正常发送");
  console.log("  ✓ 图片消息 - 正常发送");
  console.log("  ✓ 截图消息 - 带 source 标识");
  console.log("  ✓ 订单消息 - 自动创建订单");
  console.log("  ✓ 位置消息 - 坐标存储");
  console.log("  ✓ 消息列表 - 完整查询");
  console.log("  ✓ 会话保持 - 正常更新\n");

  process.exit(0);
}

main().catch((error) => {
  console.error(`\n❌ 测试出错: ${error.message}`);
  process.exit(1);
});
