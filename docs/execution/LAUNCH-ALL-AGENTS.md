# 📋 三个 AI Agent 的并行启动 Prompt

---

## 🚀 说明

这份文档包含**三个独立的 Prompt**，可以分别复制发送给三个不同的 AI Agent。

**执行方式**：
1. 复制"Frontend Dev Agent"的 Prompt，发送给 Frontend AI
2. 复制"Data Infra Agent"的 Prompt，发送给 Infrastructure AI  
3. 复制"System Architect Agent"的 Prompt，发送给Architecture AI

它们**可以并行执行**，共同推进项目。

---

---

# ✂️ Prompt 1 / 3 - Frontend Dev Agent

**复制下面的全部内容，发送给前端开发 AI**

---

你现在是 **Frontend Dev Agent**。

大主脑已经做出了重大决策，现在轮到你来从零启动用户端工程。

## 核心任务：5-7 天内完成 Uni-app 用户端 MVP，包含 4 个 P0 页面

## 输入材料（必读）

1. **执行计划与决策**
   - `g:\bishe2\docs\execution\outputs\execution-plan-round1.md`
   - 重点阅读第 2-4 步

2. **功能与产品定义**
   - `g:\bishe2\docs\mvp\01-p0-pages.md`
   - `g:\bishe2\docs\mvp\02-data-model.md`
   - `g:\bishe2\docs\mvp\03-api-and-flow.md`
   - `g:\bishe2\docs\mvp\05-ui-reference-alignment.md`

3. **当前项目配置**
   - `g:\bishe2\.env`（CloudBase 环境 ID）
   - `g:\bishe2\package.json`

4. **详细任务包**
   - `g:\bishe2\docs\execution\agents\frontend-dev-agent-task.md`

## 核心决策（已冻结，不再改）

✅ **用户端首发形态**：Uni-app → 微信小程序  
✅ **后端接入**：CloudBase 直连（不走自建后端）  
✅ **4 个 P0 页面**：首页 / 详情 / 发布 / 消息  
✅ **UI 风格**：参考闲鱼移动端（黄底、卡片流、圆角）  
✅ **数据源**：CloudBase 7 个集合（users / districts / listings / listing_images / conversations / messages / feedback）  

❌ **不做**：H5 / App / 多端 / 支付 / 订单 / 地址  

## 目标清晰

**第 2 步**（Day 1-2）： 
- Uni-app 骨架搭建，CloudBase SDK 集成，接口封装完成
- 目标：npm install + 微信工具编译无 error

**第 3 步**（Day 2-4）：
- 4 个 P0 页面完整实现
- 首页：商品流 + 区县选择 + 搜索
- 详情：商品展示 + 聊一聊按钮
- 发布：标题/描述/价格/区县/图片/提交
- 消息：会话列表 + 单聊 + 实时接收

**第 4 步**（Day 5-6）：
- 冷联调（mock 数据）验证逻辑
- 热联调（CloudBase）验证数据流

**最终验收**（Day 7）：
- QA DevOps Agent 跑端到端闭环测试

## 数据约束统一（必须遵守）

### 7 个集合的字段定义

```
users: { id, openid, nickname, avatar_url, role, status, created_at }
districts: { code, name, city_code, city_name }
listings: { id, openid(卖家), title, description, price, district_code, status(pending_review/approved/rejected/removed), image_urls, created_at }
listing_images: { id, listing_id, image_url, order }
conversations: { id, listing_id, buyer_openid, seller_openid, last_message, unread_count, updated_at }
messages: { id, conversation_id, sender_openid, content, created_at }
feedback: { id, openid, category, content, contact_info, created_at }
```

### 4 个页面的数据约束

```
首页：读 listings WHERE status='approved'，支持 districtCode+keyword 过滤
详情：读 listings WHERE id=listingId，同时读关联 listing_images
发布：写 listings{status='pending_review'} + listing_images
消息：读写 conversations + messages，查询 buyer_openid/seller_openid
```

## 4 个页面的实现需求

| 页面 | 功能 |
|------|------|
| **首页** | 顶部导航（黄底搜索框）+ 区县选择弹层 + 商品流（双列卡片）+ 底部导航 |
| **详情** | 商品图片轮播 + 标题/价格/描述/时间/卖家 + "聊一聊"CTA 按钮 |
| **发布** | 标题/描述/价格/区县/图片（最多6张）表单 + 提交（status='pending_review'） |
| **消息** | 会话列表 + 单会话聊天（商品卡片 + 消息记录 + 输入框） |

## 工程目录结构

```
uniapp-project/
├── pages/
│   ├── index/ (首页)
│   ├── listing/ (详情)
│   ├── publish/ (发布)
│   └── conversations/ (消息: conversations.vue + detail.vue)
├── components/ (通用组件)
├── services/
│   ├── api.js (CloudBase 接口 wrapper - 最关键)
│   └── auth.js
├── utils/
│   ├── cloudbase.js (初始化)
│   └── constants.js
├── pages.json (路由)
├── manifest.json (小程序配置)
├── package.json
└── README.md
```

## CloudBase 接口的最小化设计

```javascript
api.listings.listApproved({ districtCode, keyword, page, pageSize })
api.listings.getDetail(listingId)
api.listings.create(data)  // status='pending_review'

api.conversations.list(currentOpenid)
api.conversations.createOrGet(listingId, buyerOpenid, sellerOpenid)

api.messages.list(conversationId)
api.messages.send(conversationId, content, senderOpenid)
```

## 验收标准

- ✅ 微信工具编译成功（0 error）
- ✅ 4 个页面都能加载
- ✅ 冷联调逻辑完整
- ✅ 热联调数据流正常
- ✅ 代码入库 + 文档完整

**开工吧！** 🚀

---

---

# ✂️ Prompt 2 / 3 - Data Infra Agent

**复制下面的全部内容，发送给数据基础设施 AI**

---

你现在是 **Data Infra Agent**。

前端开发已经启动，你需要为他们准备好 CloudBase 的测试数据，确保冷联调和热联调能顺利进行。

## 核心任务：Day 1-2 完成 CloudBase 测试数据准备

## 输入材料（必读）

1. **项目配置**
   - `g:\bishe2\.env`（CloudBase 环境 ID）
   - `g:\bishe2\package.json`（依赖）

2. **数据模型定义**
   - `g:\bishe2\docs\mvp\02-data-model.md`
   - `g:\bishe2\docs\execution\outputs\execution-plan-round1.md`（第二章：数据约束统一）

3. **已有初始化脚本**
   - `g:\bishe2\init-db.js`
   - `g:\bishe2\query-users.js`
   - `g:\bishe2\docs\mvp\db-init\cloudbase-bootstrap-draft.js`

## 核心决策（已冻结）

✅ **后端方案**：CloudBase（固定，不改）  
✅ **不重新设计**：严格复用现有数据模型  
✅ **管理员初始化**：从 .env 读 ADMIN_OPEN_ID

## 必做任务（4 项）

### Task 1：确认 CloudBase 连接正常

- [ ] 运行 `npm install` 确保 `@cloudbase/node-sdk` 已安装
- [ ] 运行 `node query-users.js` 验证连接（检查是否能查询 users 表）
- [ ] 如连接失败，排查 CLOUDBASE_ENV 和网络问题

### Task 2：确认 districts 集合有至少 2 个测试区县

💡 **现状确认**：
- 检查 `init-db.js` 是否已初始化 districts
- 如已初始化，查询看是否有数据

💡 **如需补充**：
```javascript
// 确保至少有这 2 个区县用于测试
[
  { code: 'chaoyang', name: '朝阳区', city_code: 'beijing', city_name: '北京' },
  { code: 'haidian', name: '海淀区', city_code: 'beijing', city_name: '北京' }
]
```

- [ ] 验证 districts 集合中有 ≥ 2 个区县记录

### Task 3：准备测试商品数据（5 条 approved 商品 + 图片）

**数据准备**：
```
为热联调准备 5 条 status='approved' 的商品，包含：
- 至少 2 条带 2-3 张图片（模拟多图商品）
- 至少 3 条带 1 张图片（单图商品）
- 所有商品分散在 2 个不同区县
- 每条商品的 openid 应该是一个测试卖家账号（如 seller-001, seller-002 等）
```

**示例数据结构**（listing）：
```json
{
  "id": "auto-id",
  "openid": "seller-001",
  "title": "二手小米手机",
  "description": "使用 6 个月，成色新",
  "price": 1200,
  "district_code": "chaoyang",
  "status": "approved",
  "image_urls": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
  "created_at": 1678000000000
}
```

**处理image_urls 的两种方案**（选一种）：
1. 直接在 listings 中存储 image_urls 数组
2. 创建单独的 listing_images 集合，listings 中不存图片

**前端推荐**：方案 1（更简单）

- [ ] 写入 5 条 status='approved' 商品到 listings
- [ ] 每条商品的 image_urls 填充有效的图片 URL（可用示例 URL）
- [ ] 验证首页查询能拿到这 5 条商品

### Task 4：为管理员初始化准备

**现状**：
- .env 中有 `ADMIN_OPEN_ID=100036640483`
- users 表当前是空的（等前端首次登录后才会有数据）

**处理方案**（选一种）：

**方案 A**（现在就设置）：
- 手工在 users 表写入 1 条管理员记录：
  ```json
  {
    "openid": "100036640483",
    "nickname": "管理员",
    "avatar_url": "",
    "role": "admin",
    "status": "active",
    "created_at": 1678000000000
  }
  ```
- 验证该记录存在

**方案 B**（等前端登录）：
- 前端用户成功登录一次后，获得真实 openid
- 将该 openid 更新到 ADMIN_OPEN_ID
- 手工将该用户的 role 更新为 'admin'

**建议用方案 A**（不依赖前端）。

- [ ] 在 users 集合中有 openid=ADMIN_OPEN_ID 的管理员账号（role='admin'）

## 数据准备检查清单

完成以上 4 个 Task 后，请输出一份清单，确认：

- [ ] CloudBase 连接正常，能查询表
- [ ] districts 集合 ≥ 2 个区县
- [ ] listings 集合 ≥ 5 条 approved 商品
- [ ] listings 中的每条商品都有 image_urls（不为空）
- [ ] users 集合中有 1 条 openid=ADMIN_OPEN_ID, role='admin' 的管理员账号
- [ ] 可以运行 `node query-users.js` 看到管理员账号

## 与 Frontend Dev Agent 的协作

**Timeline**：
- Day 1-2：你完成数据准备
- Day 2：Frontend Dev 开始冷联调（用 mock 数据）
- Day 3-4：Frontend Dev 完成模块开发
- Day 4-5：Frontend Dev 开始热联调（接 CloudBase），**需要你的数据已经准备好**

**如果你 Day 1-2 没完成数据，会阻塞 Frontend Dev 的热联调进度！**

## 输出交付物

完成后，输出：
```
✅ CloudBase 环境检查报告
✅ districts 数据清单（明确有多少个区县）
✅ listings 测试数据清单（5 条商品的 ID 和标题）
✅ listings 图片 URL 清单（确认都可以加载）
✅ users 管理员账号确认（openid + role）
✅ 一份"冷热联调数据准备完成"的确认
```

**开工吧！** 🚀

---

---

# ✂️ Prompt 3 / 3 - System Architect Agent

**复制下面的全部内容，发送给系统架构 AI**

---

你现在是 **System Architect Agent**。

大主脑已经冻结了技术方案和 5 步执行计划，现在需要你做**最后的数据契约确认**，避免前后端的认知偏差。

## 核心任务：快速确认（1 小时内）

检查 `g:\bishe2\docs\execution\outputs\execution-plan-round1.md` 第二章的"数据约束统一"和"集合字段对齐表"是否完整且无遗漏。

## 检查清单

请逐项检查以下文件内容，确认：

### 1. 7 个 CloudBase 集合定义是否完整

**需要检查的方面**：
- [ ] users 集合的字段（id / openid / nickname / avatar_url / role / status / created_at）
- [ ] districts 集合的字段（code / name / city_code / city_name）
- [ ] listings 集合的关键字段（openid 作为卖家，status 值有 4 个：pending_review / approved / rejected / removed）
- [ ] listing_images 集合（listing_id 外键，image_url，order）
- [ ] conversations 集合的关键字段（buyer_openid / seller_openid / last_message / unread_count / updated_at）
- [ ] messages 集合（conversation_id 外键，sender_openid，content，created_at）
- [ ] feedback 集合（openid，category，content）

**如果有遗漏或错误**，请指出具体问题。

### 2. 4 个前端页面的数据约束是否清晰

**需要检查的方面**：
- [ ] **首页**：查询条件是否明确（WHERE status='approved' AND district_code=xxx）
- [ ] **首页**：搜索逻辑是否明确（title LIKE keyword）
- [ ] **详情页**：数据来源是否明确（listings + listing_images）
- [ ] **发布页**：新建 listings 的默认状态是否明确（status='pending_review'）
- [ ] **消息页**：会话查询条件是否明确（buyer_openid OR seller_openid）

**如果有歧义**，请澄清。

### 3. Listings 的 image_urls 存储位置是否已决定

**需要决策**：
- [ ] 图片 URL 存在 listings.image_urls（数组）
- [ ] 还是每条图片单独存在 listing_images 集合中（listing_id 外键）
- [ ] 前端应该如何读取（directly from listings / join with listing_images）

**当前决策**：根据 execution-plan-round1.md，建议用方案 1（listings.image_urls），前端更简单。

- [ ] 确认这个决策已冻结

### 4. Conversations 的 messages 子集合关系是否明确

**需要检查的方面**：
- [ ] messages 是 conversations 的子集合（conversations/{id}/messages）
- [ ] 还是独立集合（然后通过 conversation_id 外键关联）
- [ ] 前端查询消息的方式是否已明确（子集合查询 vs 普通查询）

**当前架构**：messages 是独立集合，通过 conversation_id 外键关联（CloudBase 更方便）。

- [ ] 确认这个决策已冻结

### 5. 管理员权限的鉴别方式是否可行

**需要检查的方面**：
- [ ] 用户的 role='admin' 作为管理员标识
- [ ] 后端（管理端 Express）如何验证请求者是否为管理员（检查 openid 是否 role='admin'）
- [ ] 前端是否需要鉴权（首页和发布页不涉及权限，只有管理后台需要）

**当前决策**：前端不做权限检查，仅后端检查；管理后台 Express 单独鉴权。

- [ ] 确认这个决策已冻结

## 输出

完成检查后，输出一份**《联调字段契约确认》**文档，包含：

```
✅ 7 个集合的最终字段定义（表格形式）
✅ 4 个页面的最终数据约束（表格形式）
✅ listings.image_urls 的最终存储方案（已冻结）
✅ conversations-messages 的关系设计（已冻结）
✅ admin 鉴别机制（已冻结）
✅ 前后端都应遵守的 3 个关键约束：
   1. 发布商品默认 status='pending_review'
   2. 首页只读 status='approved' 的商品
   3. 管理端审核通过后更新 status='approved'，前端 5min 内可见
✅ 如果有任何不一致，请列出修改建议
```

## 与其他 Agent 的协作

- **Frontend Dev Agent**（Day 2 开始）：需要这份字段契约来指导开发
- **Data Infra Agent**（Day 1-2）：需要这份字段契约来准备测试数据
- **Backend Admin Agent**（Day 5-6）：需要这份字段契约来排查联调 bug

**如果你不确认这些字段，他们就会各自猜测，导致后续大量返工！**

## 预期耗时

1 小时内完成即可（只是审查，不是创建）。

**开工吧！** 🚀

---

---

## 📌 三个 Agent 的执行关键点

| Agent | 关键里程碑 | 交付物 | 截止时间 |
|-------|-----------|--------|---------|
| **System Architect** | 字段契约已冻结 | `联调字段契约确认.md` | Day 1（1 小时） |
| **Data Infra** | 测试数据准备完成 | districts / listings / users 已初始化 | Day 1-2 |
| **Frontend Dev** | Uni-app 骨架完成 | `uniapp-project/` 工程可编译 | Day 2 |

**同步依赖路径**：
```
System Architect ✅ Day 1
        ↓
Data Infra ✅ Day 1-2    Frontend Dev ✅ Day 1-2
        ↓ (数据准备)      ↓ (字段契约)
    热联调准备完成   Uni-app 骨架 + 冷联调
        ↓
Frontend Dev Day 4-5（热联调）
```

**三个 Agent 可以并行工作！** 🚀

