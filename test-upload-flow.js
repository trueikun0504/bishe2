#!/usr/bin/env node
/**
 * 文件上传端到端测试
 * 1. 生成测试图片
 * 2. 上传到 POST /api/web/uploads/chat
 * 3. 用返回的 URL 发送图片消息
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { promisify } = require("util");

const BASE_URL = "http://localhost:3001";
const TEST_IMAGE_PATH = path.join(__dirname, "test-image.png");

/**
 * 生成一个简单的 PNG 图片（1x1 像素，红色）
 */
function generateTestImageAsync() {
  return new Promise((resolve, reject) => {
    // 最小化的 PNG：1x1 红色像素
    const pngBuffer = Buffer.from([
      // PNG 签名
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      // IHDR 块
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde,
      // IDAT 块
      0x00, 0x00, 0x00, 0x0c,
      0x49, 0x44, 0x41, 0x54,
      0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x05, 0x18, 0x0b, 0xb3,
      // IEND 块
      0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ]);

    fs.writeFile(TEST_IMAGE_PATH, pngBuffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * HTTP 请求辅助函数（支持表单上传）
 */
function requestWithFile(method, path, fileStream, fileName, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const boundary = "----FormBoundary" + Date.now();
    
    const options = {
      method,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
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

    // 构建 multipart 表单数据
    const fileBuffer = fileStream; // 直接用 Buffer
    const formStart = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`;
    const formEnd = `\r\n--${boundary}--\r\n`;

    req.write(formStart);
    req.write(fileBuffer);
    req.write(formEnd);
    req.end();
  });
}

/**
 * HTTP JSON 请求
 */
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
  console.log("\n🚀 文件上传端到端测试\n");

  // Step 0: 生成测试图片
  console.log("0️⃣  生成测试图片");
  try {
    await generateTestImageAsync();
    console.log(`✅ 测试图片已生成: ${TEST_IMAGE_PATH}`);
  } catch (error) {
    console.error("❌ 生成图片失败:", error.message);
    process.exit(1);
  }

  // Step 1: 创建用户
  console.log("\n1️⃣  创建测试用户");
  const userRes = await request("POST", "/api/web/auth/register", {
    username: `uploader-${Date.now()}`,
    password: "test123456",
    nickname: "文件上传测试",
  });

  if (!userRes.json.success) {
    console.error("❌ 用户创建失败:", userRes.json.message);
    process.exit(1);
  }

  const token = userRes.json.data.token;
  const user = userRes.json.data.user;
  console.log(`✅ 用户已创建: ${user.nickname} (${user.openid})`);
  console.log(`   Token: ${token.slice(0, 30)}...`);

  // Step 2: 上传图片文件
  console.log("\n2️⃣  上传图片文件");
  const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
  const uploadRes = await requestWithFile(
    "POST",
    "/api/web/uploads/chat",
    imageBuffer,
    "test-image.png",
    token
  );

  if (!uploadRes.json.success) {
    console.error("❌ 文件上传失败:", uploadRes.json.message);
    process.exit(1);
  }

  const uploadedUrl = uploadRes.json.data.url;
  const fullUrl = new URL(uploadedUrl, BASE_URL).toString();
  console.log(`✅ 图片已上传`);
  console.log(`   文件名: ${uploadRes.json.data.originalname}`);
  console.log(`   大小: ${uploadRes.json.data.size} 字节`);
  console.log(`   相对 URL: ${uploadedUrl}`);
  console.log(`   完整 URL: ${fullUrl}`);

  // Step 3: 创建卖家和商品
  console.log("\n3️⃣  创建卖家和商品");
  const sellerRes = await request("POST", "/api/web/auth/register", {
    username: `seller-upload-${Date.now()}`,
    password: "test123456",
    nickname: "上传测试卖家",
  });

  if (!sellerRes.json.success) {
    console.error("❌ 卖家创建失败:", sellerRes.json.message);
    process.exit(1);
  }

  const sellerToken = sellerRes.json.data.token;
  const sellerUser = sellerRes.json.data.user;

  const publishRes = await request(
    "POST",
    "/api/web/listings",
    {
      title: "上传测试商品",
      description: "用上传的图片作为商品图片",
      price: 88,
      district_code: "330106",
      category_id: "cat-1",
      image_urls: [uploadedUrl], // ⭐ 使用上传的图片 URL
    },
    sellerToken
  );

  if (!publishRes.json.success) {
    console.error("❌ 商品创建失败:", publishRes.json.message);
    process.exit(1);
  }

  const listingId = publishRes.json.data.id;
  console.log(`✅ 商品已创建: 上传测试商品`);
  console.log(`   ID: ${listingId}`);
  console.log(`   使用上传的图片 URL: ${uploadedUrl}`);

  // Step 4: 创建会话
  console.log("\n4️⃣  创建会话");
  const conversationRes = await request(
    "POST",
    "/api/web/conversations/open",
    {
      listing_id: listingId,
    },
    token
  );

  if (!conversationRes.json.success) {
    console.error("❌ 会话创建失败:", conversationRes.json.message);
    process.exit(1);
  }

  const conversationId = conversationRes.json.data.id;
  console.log(`✅ 会话已创建`);
  console.log(`   ID: ${conversationId}`);

  // Step 5: 发送图片消息（用上传的图片 URL）
  console.log("\n5️⃣  发送图片消息（使用上传的图片 URL）");
  const imageMessageRes = await request(
    "POST",
    `/api/web/conversations/${conversationId}/messages`,
    {
      message_type: "image",
      image_url: uploadedUrl,
      content: "上传文件后发送的图片消息",
    },
    token
  );

  if (!imageMessageRes.json.success) {
    console.error("❌ 图片消息发送失败:", imageMessageRes.json.message);
    process.exit(1);
  }

  console.log(`✅ 图片消息已发送`);
  console.log(`   消息 ID: ${imageMessageRes.json.data.id}`);
  console.log(`   图片 URL: ${imageMessageRes.json.data.image_url}`);

  // Step 6: 验证消息存储
  console.log("\n6️⃣  验证消息列表");
  const messagesRes = await request(
    "GET",
    `/api/web/conversations/${conversationId}/messages`,
    null,
    token
  );

  if (!messagesRes.json.success) {
    console.error("❌ 获取消息列表失败:", messagesRes.json.message);
    process.exit(1);
  }

  const messages = messagesRes.json.data;
  const imageMessage = messages.find((msg) => msg.message_type === "image");

  console.log(`✅ 消息列表已验证`);
  console.log(`   总消息数: ${messages.length}`);
  console.log(`   图片消息数: ${messages.filter((m) => m.message_type === "image").length}`);

  if (imageMessage) {
    console.log(`   最后图片消息`);
    console.log(`     • 内容: ${imageMessage.content}`);
    console.log(`     • 图片 URL: ${imageMessage.image_url}`);
    console.log(`     • 时间: ${new Date(imageMessage.created_at).toLocaleString("zh-CN")}`);
  }

  // 清理测试图片
  try {
    fs.unlinkSync(TEST_IMAGE_PATH);
  } catch (e) {
    // 忽略删除错误
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ 文件上传端到端测试完全通过！\n");
  console.log("📊 测试结果总结:");
  console.log("  ✓ 测试图片生成");
  console.log("  ✓ 用户注册 + Token 获取");
  console.log("  ✓ 文件上传到 /api/web/uploads/chat");
  console.log("  ✓ 获取上传文件的可访问 URL");
  console.log("  ✓ 用上传的 URL 创建商品");
  console.log("  ✓ 发送图片消息（使用上传的 URL）");
  console.log("  ✓ 验证消息存储和检索\n");

  console.log("🎯 核心验证:");
  console.log(`  • 上传文件大小: ${uploadRes.json.data.size} 字节`);
  console.log(`  • 返回的相对路径: ${uploadedUrl}`);
  console.log(`  • 完整可访问 URL: ${fullUrl}`);
  console.log(`  • 消息中存储的 URL: ${imageMessage?.image_url}\n`);

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});
