# 第一轮执行冻结决策 - 技术方案 + 任务拆解

**日期**：2026年3月10日  
**主脑决策**：锁定技术方案、冻结数据约束、启动 Uni-app + CloudBase 联调闭环

---

## 一、技术方案冻结

### 🎯 用户端架构

| 决策项 | 方案 | 理由 |
|--------|------|------|
| **首发形态** | Uni-app → 微信小程序 | 最快速进入市场，暂不考虑跨端 |
| **后端接入** | 直接 CloudBase | 轻量、快速、按量付费 |
| **UI 风格** | 参考闲鱼移动端 | 社区感强、卡片流、大黄底 |
| **数据源** | CloudBase 数据库 | users / districts / listings / messages / conversations |
| **认证方案** | 微信 wx.login() + code2session | 最小化认证复杂度 |

### 🎯 管理端架构

| 决策项 | 方案 | 理由 |
|--------|------|------|
| **形态** | **本地 Express + CloudBase** | 不改，继续用当前方案 |
| **职责** | 审核/下架/禁用/反馈查看 | 明确后台权限边界 |
| **扩展** | **禁止**在本轮添加任何功能 | 专注闭环验证 |

---

## 二、数据约束统一（关键！）

### 核心约束

```
📌 listings.status = pending_review（用户发布的默认状态）
📌 首页只读 status = 'approved' 的商品
📌 详情页从 listings + listing_images 取数
📌 创建会话时自动写 conversations
📌 消息写入 messages 子集合
📌 管理端审核通过后 → 首页 5 分钟内可见
```

### 集合字段对齐表

| 集合 | 读写端 | 字段清单 | 状态更新 |
|------|--------|---------|---------|
| **users** | 前端读；管理端写禁用 | id / openid / nickname / avatar_url / role / status / created_at | 前端登录写入 |
| **districts** | 前端读；后端维护 | code / name / city_code / city_name | 初始化后冻结 |
| **listings** | 前端读写；管理端审核 | id / openid / title / description / price / district_code / status / created_at / image_urls | status: pending_review → approved / rejected / removed |
| **listing_images** | 前端写；前后端读 | id / listing_id / image_url / order | 发布时批量写 |
| **conversations** | 前端读写 | id / listing_id / buyer_openid / seller_openid / last_message / unread_count / updated_at | 联系时创建；消息时更新 |
| **messages** | 前端读写 | id / conversation_id / sender_openid / content / created_at | 发送时写 |
| **feedback** | 前端写；管理端读 | id / openid / category / content / contact_info / created_at | 提交时创建 |

---

## 三、任务分阶段拆解

### 📋 第 1 步：冻结联调契约（Product + Architect）

**目标**：确认数据模型不再改，减低前后端认知差

**必做**：
1. ✅ 确认以上 7 个集合的字段定义（不新增复杂结构）
2. ✅ 确认前端只消费现有字段，不强制后端添加字段
3. ✅ 确认 listings.status 的所有状态值：`pending_review` / `approved` / `rejected` / `removed`
4. ✅ 确认消息和会话的数据关系（消息在 conversations/{id}/messages 子集合）

**交付**：
- `联调字段契约.md` — 所有端都遵循这个契约

---

### 📋 第 2 步：起 Uni-app 用户端骨架（Frontend Dev Agent ← **这是本轮主导**）

**目标**：建立可编译可运行的 Uni-app 工程，支持微信小程序端

**具体任务**：

#### 2.1 工程初始化
```
uniapp-project/
├── pages/
│   ├── index/
│   ├── listing/          ← 详情页
│   ├── publish/          ← 发布页
│   ├── conversations/    ← 消息列表
│   └── message-detail/   ← 单会话页
├── components/
│   ├── NavBar.vue
│   ├── ProductCard.vue
│   ├── ImageUpload.vue
│   └── ...
├── services/
│   ├── api.js           ← CloudBase 接口封装
│   └── auth.js
├── utils/
│   ├── cloudbase.js      ← CloudBase 初始化
│   └── constants.js
├── static/
│   ├── images/
│   └── styles/
├── main.js
├── App.vue
├── uni.scss
└── package.json
```

#### 2.2 基础配置
- [ ] pages.json：注册 4 个 P0 页面 + 底部导航
- [ ] uni.scss：全局样式（颜色、字体、圆角）
- [ ] manifest.json：微信小程序配置

#### 2.3 CloudBase 初始化封装
```javascript
// utils/cloudbase.js
export const initCloudBase = async () => {
  // 1. 初始化 CloudBase SDK
  // 2. 获取环境变量
  // 3. 暴露 db / auth / cloud 等全局方法
}

// services/api.js - 主要接口
export const listings = {
  listApproved(districtCode, keyword, page),
  getDetail(listingId),
  create(data),
  myListings(openid)
}
export const conversations = {
  list(openid),
  getDetail(conversationId),
  createOrGet(listingId, buyerOpenid, sellerOpenid)
}
export const messages = {
  list(conversationId),
  send(conversationId, content, senderOpenid)
}
```

#### 2.4 基础流程确认
- [ ] 页面路由跳转无误
- [ ] CloudBase 连接成功
- [ ] 可成功查询一条 approved 商品
- [ ] 可成功写入一个测试文档

**交付**：
- 可编译运行的 Uni-app 工程
- CloudBase 接口封装层

---

### 📋 第 3 步：落地 4 个 P0 页面（Frontend Dev Agent）

#### 3.1 首页（index）

**功能**：
- [ ] 顶部导航：Logo + 搜索框
- [ ] 区县切换（弹层）
- [ ] 关键词搜索
- [ ] 商品流（双列卡片）
- [ ] 底部导航：首页 / 发布 / 消息 / 我的

**数据动作**：
```javascript
// 查询已审核商品
listings.listApproved(districtCode, keyword, page)
// 返回：[{ id, title, price, image_url, seller_nickname, created_at }, ...]
```

**页面交互**：
- ( ) 点击商品卡片 → 进详情
- ( ) 点击发布按钮 → 检查是否登录 → 进发布页或登录页
- ( ) 切换区县后自动刷新列表

---

#### 3.2 详情页（listing）

**功能**：
- [ ] 商品大图 + 轮播（如果有多图）
- [ ] 标题、价格、描述
- [ ] 区县、发布时间
- [ ] 卖家昵称
- [ ] **"聊一聊"主按钮**

**数据动作**：
```javascript
// 获取商品详情 + 图片列表
await listings.getDetail(listingId)
// 返回：{ id, title, description, price, district_code, openid, seller_nickname, created_at, image_urls: [...] }
```

**页面交互**：
- [ ] 非登录用户点"聊一聊" → 跳登录页
- [ ] 登录用户点"聊一聊" → `createOrGet(listingId, buyerOpenid, sellerOpenid)` → 跳消息页
- [ ] 返回首页 → 列表回到之前位置

---

#### 3.3 发布页（publish）

**功能**：
- [ ] 标题输入框
- [ ] 描述文本框
- [ ] 价格输入框
- [ ] 图片上传（最多 6 张）
- [ ] 区县选择
- [ ] 提交按钮

**数据动作**：
```javascript
// 1. 上传图片
const imageUrls = await uploadImages(files)

// 2. 写入 listings
await listings.create({
  openid: currentUser.openid,
  title: formData.title,
  description: formData.description,
  price: formData.price,
  district_code: formData.district_code,
  status: 'pending_review',  // 默认
  image_urls: imageUrls
})
```

**页面交互**：
- [ ] 上传图片时显示进度
- [ ] 提交成功后提示"已提交审核"并跳回首页
- [ ] 提交失败显示错误提示

---

#### 3.4 消息页（conversations → messages）

**布局**：
- **移动端**：先做"会话列表"tab，每条会话点击进单聊页面
- **单会话页**：商品卡片 + 消息列表 + 输入框

**功能 - 会话列表**：
- [ ] 显示与当前用户相关的所有会话
- [ ] 每条会话展示：商品缩略图 + 商品标题 + 最后一条消息 + 对方昵称 + 时间
- [ ] 未读消息高亮或 badge

**功能 - 单会话页**：
- [ ] 对应商品信息卡片（图片 + 标题 + 价格）
- [ ] 消息记录（分左右显示）
- [ ] 文本输入框 + 发送按钮

**数据动作**：
```javascript
// 获取会话列表
await conversations.list(currentOpenid)
// 返回：[{ id, listing_id, buyer_openid, seller_openid, last_message, unread_count, updated_at }, ...]

// 获取单会话的消息
await messages.list(conversationId)
// 返回：[{ id, sender_openid, content, created_at }, ...]

// 发送消息
await messages.send(conversationId, content, currentOpenid)
// 同时更新 conversations.last_message 和 updated_at
```

**页面交互**：
- [ ] 发送消息后清空输入框，消息立即显示
- [ ] 接收消息时自动刷新（可用 CloudBase 实时监听或定时轮询）
- [ ] 返回会话列表后重新加载，显示最新状态

---

### 📋 第 4 步：冷联调 + 热联调测试（Frontend Dev + QA）

#### 4.1 冷联调（无真实后端数据）

**目标**：验证前端逻辑、组件、路由没问题

**操作**：
- [ ] 用本地 mock 数据跑一遍所有 4 个页面
- [ ] 检查路由跳转、参数传递无误
- [ ] 检查 UI 样式与参考图对齐

#### 4.2 热联调（接 CloudBase 真实数据）

**目标**：验证前后端数据契约

**前置条件**：
- ✅ CloudBase 有测试数据（由 data-infra-agent 准备）
  - districts：至少 2 个区县
  - listings：至少 5 条 approved 商品，含图片
  - users：至少 1 个管理员账号（为了审核测试）

**操作**：
1. 清空本地 mock，改用 CloudBase API
2. 首页查询 → 看能否加载商品列表
3. 详情页查询 → 看能否显示商品完整信息和图片
4. 发布页 → 上传测试图片，发布一条商品
5. 消息页 → 创建会话，发送消息

---

### 📋 第 5 步：跑 QA 闭环验收（QA DevOps Agent）

**验收链路**：

#### 场景 1：完整交易闭环 ✅

```
Step 1：用户 A（OpenID: A001）登录
  → 前端调 wx.login() 
  → 后端调 code2session 获取 openid
  → 写入 users 集合

Step 2：用户 A 发布商品（"二手小米手机"）
  → 进发布页
  → 填写标题、描述、价格、选区县
  → 上传 2 张图片
  → 提交
  → 前端写入 listings { status: 'pending_review' }
  → 收到成功提示

Step 3：用户 B（OpenID: B001）登录
  → 与用户 A 同样流程

Step 4：管理员（OpenID: 100036640483，从 .env ADMIN_OPEN_ID）登录后台
  → 看到"未审核商品"列表里有用户 A 的商品
  → 点击"审核通过"
  → 后端更新 listings.status = 'approved'

Step 5：用户 B 首页刷新
  → 看到用户 A 的商品出现在流中

Step 6：用户 B 进商品详情
  → 看到完整信息和 2 张图片
  → 点"聊一聊"按钮
  → 前端创建 conversations { buyer_openid: B001, seller_openid: A001 }

Step 7：用户 B 发送消息："这个手机还在吗？"
  → 消息写入 conversations/{id}/messages
  → 同时更新 conversations.last_message = "这个手机还在吗？"

Step 8：用户 A 打开消息页
  → 看到来自用户 B 的会话
  → 点击进单会话页面
  → 看到商品卡片和消息记录
  → 回复："在的，9 成新"
  → 消息发送成功

Step 9：管理员下架该商品
  → 后端更新 listings.status = 'removed'

Step 10：用户 B 首页刷新
  → 该商品消失

✅ 闭环验证通过！
```

#### 验收清单

| # | 验收项 | 检查方式 |
|----|--------|---------|
| 1 | 首页可查询 approved 商品 | 发布后审核通过，5min 内首页加载 |
| 2 | 详情页显示完整信息 + 图片 | 点击商品卡片，看价格、描述、图片 |
| 3 | 联系卖家创建会话 | 点"聊一聊"后会话出现在消息列表 |
| 4 | 双向消息可发送和接收 | 买卖双方都能看到对方消息 |
| 5 | 发布商品写入 pending_review | 提交后查数据库 listings.status |
| 6 | 管理端审核生效 | 后台通过后，前端 5min 内看到商品 |
| 7 | 下架商品生效 | 后台下架后，前端首页商品消失 |
| 8 | 禁用用户生效 | 管理员禁用用户后，该用户无法发布新商品 |
| 9 | 无崩溃无黑屏 | 全流程走一遍，console 无 error |
| 10 | 图片上传和加载正常 | 发布 2 张图，详情页都能看到 |

---

## 四、Agent 与 Skill 分工明确

### Product Strategy Agent

**职责**：冻结范围，守住 MVP 边界  
**本轮任务**：
- 确认 P0 页面的 4 个选择是**最终的**
- 确认**不做清单**中的内容不会被讨论
- 如出现新需求，从 P0 边界判定是否应该做

**交付**：无（已在之前的 product-strategy-output.md 中输出）

---

### System Architect Agent

**职责**：确认前后端数据契约，避免认知偏差  
**本轮任务**：
- 审视第二章的"数据约束统一"和"集合字段对齐表"，有无遗漏❓
- 确认 listings.status 的所有可能值
- 确认 messages 的结构（是子集合还是单独集合）
- 确认图片 URL 的存储位置（在 listing_images 还是 listings.image_urls）

**交付**：
- 确认备忘录：`联调字段契约.md`

---

### Data Infra Agent

**职责**：保证 CloudBase 数据库可用，准备必要的初始数据  
**本轮任务**：
- ✅ 保持现有 init-db.js 的执行结果不变
- ✅ 确认 districts 集合有至少 2 个测试区县
- [ ] **新增**：为测试准备管理员账号
  - 手工在 users 集合写入：openid = ADMIN_OPEN_ID（从 .env 读），role = 'admin'
  - 或在首次前端用户登录后，手工更新该用户的 role 为 admin
- [ ] **新增**：为冷联调准备 5-10 条 approved 商品和 listing_images（可用示例 URL）

**交付**：
- 可用的 CloudBase 环境，包含：
  - districts（≥2 个区县）
  - listings（≥5 条 approved，含 image_urls）
  - listing_images（可选）
  - 1 个管理员账号（openid = ADMIN_OPEN_ID, role = admin）

---

### Frontend Dev Agent ⭐ **本轮主导**

**职责**：从零到一启动 Uni-app 用户端，实现 4 个 P0 页面  
**本轮任务**：
1. 初始化 Uni-app 工程（可参考 Uni-app 官方模板）
2. 搭建基础目录结构和配置
3. CloudBase SDK 集成和接口封装（utils/cloudbase.js + services/api.js）
4. 实现 4 个 P0 页面：
   - 首页（商品流 + 区县选择 + 搜索）
   - 详情页（商品展示 + 聊一聊）
   - 发布页（表单 + 图片上传）
   - 消息页（会话列表 + 单聊）
5. 页面路由和底部导航
6. 基础样式对齐（参考闲鱼）

**交付**：
- 完整的 Uni-app 工程
- 4 个功能完整的页面
- CloudBase 接口封装
- 可运行的微信小程序预览

**约束**：
- ❌ 不做跨端支持（暂时只微信小程序）
- ❌ 不做 H5 / App / 快应用
- ❌ 不处理支付、订单、地址等逻辑

---

### Backend Admin Agent

**职责**：维护管理后台，不扩展功能  
**本轮任务**：
- [ ] 检查现有 `admin/server.js` 是否有 bug
- [ ] 如有联调错误，修复对应接口
- ❌ **不添加** 新的管理功能
- ❌ **不改** 数据模型

**交付**：
- 可用的管理后台（审核 / 下架 / 禁用 / 反馈查看）

---

### QA DevOps Agent

**职责**：跑完整闭环验收，确保交付质量  
**本轮任务**：
- 等前端 + 后端都有基础能力后
- 按"验收链路"进行端到端测试
- 记录所有 bug（分 P0-bug / P1-bug）
- 输出冒烟和闭环验证报告

**交付**：
- 闭环验证报告
- Bug 列表
- 预发布建议

---

## 五、关键风险与待确认项

### 🔴 风险 1：users 集合当前是空的

**现象**：用户还没登录过小程序，所以 users 表没有数据

**处理方案**：
1. 前端用户首先成功登录一次
2. 后端通过 wx.login() + code2session 拿到 openid，写入 users
3. 用户的 openid 作为"谁是管理员"的标识

**行动**：
- 前端先冷联调完成后，用真实微信小程序账号登录一次
- 然后把成功登录用户的 openid 复制到 .env 的 ADMIN_OPEN_ID
- data-infra-agent 再手工更新该用户的 role = 'admin'

---

### 🟡 风险 2：当前是"本地管理端 + CloudBase 数据库"，不是"后端全上云"

**现象**：
- 用户端：Uni-app 直接调 CloudBase
- 管理端：本地 Express 调 CloudBase
- 这不是真正的"三层架构"

**影响**：
- 用户端直接暴露 CloudBase 权限和数据
- 如果 CloudBase 权限配置不对，用户可能能看到不该看到的数据

**处理**：
- ✅ 在 CloudBase 数据库权限上严格设置
- ✅ 未登录用户只能读 approved 商品，不能读其他数据
- ✅ 用户只能写自己的 listings 和 messages
- ⚠️ 这是当前 MVP 的设计选择，后期如需完整后端再改

---

### 🔴 风险 3：腾讯云密钥暴露

**现象**：之前可能在代码或日志中暴露过腾讯云密钥

**处理**：
- ✅ 联调完成前，**立即轮换** CloudBase 环境的密钥
- ✅ 检查 .env 文件，确保没有进 Git

---

### 🟡 风险 4：如果改成真正跨端（H5/App），会拖慢决策

**现象**：如果要支持 H5 + App + 小程序，工作量 3 倍

**决策**：
- ✅ **首发锁微信小程序**
- ⏳ H5/App 留到 P1 或后续版本

---

## 六、执行顺序（由 Frontend Dev Agent 主导）

### Week 1

| 日期 | 任务 | 负责 | 状态 |
|------|------|------|------|
| Day 1 | 冻结联调契约 | System Architect + Data Infra | ⬜ |
| Day 1-2 | 起 Uni-app 骨架 + 配置 | Frontend Dev | ⬜ |
| Day 2-3 | 实现首页 + 详情页 | Frontend Dev | ⬜ |
| Day 3-4 | 实现发布页 + 消息页 | Frontend Dev | ⬜ |
| Day 4-5 | 冷联调（mock 数据） | Frontend Dev | ⬜ |

### Week 2

| 日期 | 任务 | 负责 | 状态 |
|------|------|------|------|
| Day 1-2 | 热联调（接 CloudBase） | Frontend Dev + Backend Admin | ⬜ |
| Day 2-3 | 修复联调 bug | Frontend Dev + Backend Admin | ⬜ |
| Day 3-4 | 端到端验收流程 | QA DevOps | ⬜ |
| Day 4-5 | 总结报告，准备预发布 | QA DevOps | ⬜ |

---

## 七、成功标准

当以下条件全部满足，第一轮执行成功：

✅ 前端 4 个 P0 页面都能在微信开发者工具中编译运行  
✅ 可以从首页搜索和浏览 CloudBase 中的 approved 商品  
✅ 可以发布商品（default status = pending_review）  
✅ 管理员可以审核通过商品，5 分钟内首页可见  
✅ 可以创建会话、发送消息、接收消息  
✅ 完整闭环验证通过（用户 A 发布 → 用户 B 发现 → 联系 → 回复）  
✅ 无阻塞性 bug，所有错误都能在本地复现和修复  
✅ QA 确认冒烟测试全部通过  

---

## 八、下一步：Frontend Dev Agent 的入场

> **Frontend Dev Agent，请阅读完本文档后，立即开始第 2 步：起 Uni-app 用户端骨架。**

你的任务清单：

1. ✅ 确认已理解 Uni-app + 微信小程序 + CloudBase 的技术方案
2. ✅ 确认已理解 4 个 P0 页面的功能需求
3. ✅ 确认已理解数据约束（集合字段对齐表）
4. ✅ 新建 Uni-app 工程目录（可基于官方模板）
5. ✅ 完成第 2 步（骨架搭建）+ 第 3 步（4 个页面实现）
6. ✅ 输出可运行的微信小程序完整工程

**预期交付时间**：5-7 个工作日

**关键里程碑**：
- D2：Uni-app 骨架 ✅，可编译运行
- D3：首页 + 详情 ✅，冷联调
- D4：发布 + 消息 ✅，冷联调完成
- D5-6：热联调，接 CloudBase
- D7：QA 闭环验收

