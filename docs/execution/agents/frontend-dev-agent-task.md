# Frontend Dev Agent 任务包

## 你的职责

你负责从零到一启动 Uni-app 用户端，实现 4 个 P0 页面，并完成冷联调与热联调。

## 输入材料

必读文件（按优先级）：

1. **刚冻结的决策文档**
   - `g:\bishe2\docs\execution\outputs\execution-plan-round1.md`（第 2-4 步）

2. **MVP 功能与数据模型**
   - `g:\bishe2\docs\mvp\01-p0-pages.md`（用户端页面定义）
   - `g:\bishe2\docs\mvp\02-data-model.md`（数据模型）
   - `g:\bishe2\docs\mvp\03-api-and-flow.md`（接口清单）
   - `g:\bishe2\docs\mvp\05-ui-reference-alignment.md`（UI 风格参考）

3. **当前现状**
   - `g:\bishe2\docs\execution\00-command-board.md`（项目背景）
   - `g:\bishe2\.env`（CloudBase 环境配置）

## 目标

1. 从零创建 Uni-app 工程，支持微信小程序端
2. 实现 4 个 P0 页面及其数据交互
3. 集成 CloudBase SDK，完成接口封装
4. 冷联调验证逻辑，热联调验证数据

## 必做任务

### 第 2 步：起 Uni-app 用户端骨架（Day 1-2）

#### 2.1 工程初始化
- [ ] 创建 `uniapp-project` 目录
- [ ] 初始化 package.json（依赖：uni-app, @dcloudio/uni-ui, cloudbase-js-sdk）
- [ ] 创建标准目录结构：pages/ / components/ / services/ / utils/ / static/

#### 2.2 基础配置
- [ ] 完成 pages.json：注册 4 个 P0 页面 + 底部导航
- [ ] 完成 uni.scss：全局颜色变量（黄 #FFE000 / 黑 #222222 / 灰 #F6F6F6 等）
- [ ] 完成 manifest.json：微信小程序配置

#### 2.3 CloudBase 初始化与接口封装
- [ ] `utils/cloudbase.js`：初始化 CloudBase SDK
- [ ] `utils/constants.js`：常量定义（环境 ID、接口前缀等）
- [ ] `services/api.js`：接口 wrapper 函数（listings / conversations / messages）

#### 2.4 验收
- [ ] `npm install` 无错误
- [ ] 在微信开发者工具中编译成功（0 error）
- [ ] 可以打开首页（即使是空白页也可以）

---

### 第 3 步：实现 4 个 P0 页面（Day 2-4）

#### 3.1 首页（pages/index/index.vue）

**功能需求**：
- 顶部导航：黄底，Logo + 搜索框
- 区县切换：弹层，点击导航区县名称打开
- 搜索框：输入关键词，回车搜索，联动列表刷新
- 商品流：双列卡片，每张卡片显示 (图片 / 标题 / 价格 / 卖家昵称 / 发布时间)
- 底部导航：首页 / 发布 / 消息 / 我的

**数据源**：
```javascript
// 查询已审核商品
await api.listings.listApproved({ 
  districtCode, 
  keyword, 
  page: 1, 
  pageSize: 20 
})
```

**交互流**：
- ✅ 点击商品卡片 → 跳详情页，传 listing_id
- ✅ 点击区县 → 打开区县选择弹层，选择后刷新列表
- ✅ 点击搜索框 → 搜索商品，刷新列表
- ✅ 点击"发布"按钮（导航） → 检查是否登录；已登录 → 跳发布页；未登录 → 跳登录页
- ✅ 点击"消息"按钮（导航） → 跳消息列表页
- ✅ 点击"我的"按钮（导航） → 跳我的页（可先做空页）

**验收项**：
- [ ] 首页加载，显示商品列表（冷联调用 mock 数据，热联调接 CloudBase）
- [ ] 区县能切换，列表刷新
- [ ] 关键词搜索有效
- [ ] 底部导航点击无误以及题目

---

#### 3.2 详情页（pages/listing/listing.vue）

**功能需求**：
- 商品图片区：单张或轮播
- 基础信息：标题、价格（大号、颜色突出）、描述、区县、发布时间
- 卖家信息：昵称
- "聊一聊"按钮：主 CTA，底部或右下角悬浮

**数据源**：
```javascript
// 获取商品详情
await api.listings.getDetail(listingId)
// 返回：{ id, title, description, price, district_code, openid, seller_nickname, created_at, image_urls: [...] }
```

**交互流**：
- ✅ 进详情页加载数据
- ✅ 图片能点击查看大图（或轮播）
- ✅ 非登录用户点"聊一聊" → 跳登录页
- ✅ 登录用户点"聊一聊" → 调用 `conversations.createOrGet(listingId, buyerOpenid, sellerOpenid)` → 跳到消息详情页
- ✅ 返回首页 → 列表保持之前滚动位置（可选）

**验收项**：
- [ ] 详情页加载成功，显示完整信息
- [ ] 图片能正常加载
- [ ] "聊一聊"按钮响应正确

---

#### 3.3 发布页（pages/publish/publish.vue）

**功能需求**：
- 标题输入框：单行，必填
- 描述文本框：多行，必填
- 价格输入框：数字，必填
- 区县选择：下拉 / 弹层，必填（可默认记忆用户最后选择的区县）
- 图片上传：最多 6 张，必填至少 1 张
- 提交按钮：发布

**数据流**：
```javascript
// 1. 上传图片到 CloudBase 存储
const imageUrls = await Promise.all(
  files.map(file => uploadImageToCloudBase(file))
)

// 2. 写入 listings
await api.listings.create({
  openid: currentUser.openid,
  title: form.title,
  description: form.description,
  price: form.price,
  district_code: form.district_code,
  status: 'pending_review',  // 关键：默认待审核
  image_urls: imageUrls,
  created_at: Date.now()
})
```

**交互流**：
- ✅ 点击"选择图片"打开相册，可多选（iOS 权限处理）
- ✅ 图片上传时显示进度（转圈动画）
- ✅ 点击"发布"前，验证所有字段填写
- ✅ 提交成功 → 弹提示"已提交审核，请等待管理员审核" → 跳回首页
- ✅ 提交失败 → 显示错误提示，留在当前页

**验收项**：
- [ ] 表单验证生效（必填项）
- [ ] 图片上传进度正常
- [ ] 发布成功后跳转并提示
- [ ] 发布的数据在 CloudBase 中 status = 'pending_review'

---

#### 3.4 消息页（pages/conversations/conversations.vue + pages/conversations/detail.vue）

**布局**：
- conversations.vue：会话列表（移动端）
- detail.vue：单会话聊天

**会话列表功能**：
- 显示所有相关会话
- 每条会话：（商品图 + 商品标题 + 对方昵称 + 最后一条消息）+ 时间 + 未读 badge（可选）
- 点击会话进详情

**数据源**：
```javascript
// 获取会话列表
await api.conversations.list(currentOpenid)
// 返回：[{ id, listing_id, buyer_openid, seller_openid, last_message, unread_count, updated_at }, ...]
```

**单会话详情页功能**：
- 顶部：对应商品的卡片（图 + 标题 + 价格）（可点击返回首页或详情）
- 中部：消息记录（左右分显，不同颜色，显示发送时间）
- 底部：文本输入框 + 发送按钮

**数据源**：
```javascript
// 获取单会话的消息
await api.messages.list(conversationId)
// 返回：[{ id, sender_openid, content, created_at }, ...]

// 发送消息
await api.messages.send(conversationId, {
  content: inputValue,
  sender_openid: currentOpenid,
  created_at: Date.now()
})
// 同时更新 conversations.last_message 和 updated_at
```

**交互流**：
- ✅ 消息页加载会话列表
- ✅ 点击会话进详情，加载消息记录
- ✅ 发送消息后立即清空输入框、消息列表显示新消息
- ✅ 如果是接收端，可用轮询或 CloudBase 实时监听自动刷新（实时监听更佳，可选）
- ✅ 返回会话列表 → 重新加载，显示最新状态
- ✅ 点击消息顶部商品卡片 → 可跳商品详情页

**验收项**：
- [ ] 会话列表能加载
- [ ] 单会话的消息能加载并正确显示
- [ ] 能成功发送消息，对方能接收（至少轮询刷新能看到）
- [ ] 消息发送前后都能看到对方的消息记录

---

## 第 4 步：联调与测试（Day 5-6）

### 4.1 冷联调（用 mock 数据）

- [ ] 所有 4 个页面都能用 mock 数据正常运行
- [ ] 路由跳转无异常
- [ ] UI 布局与参考图对齐（颜色、圆角、字号等）

### 4.2 热联调（接 CloudBase）

**前置条件**：
- ✅ data-infra-agent 已准备好测试数据（districts / listings / images）
- ✅ CloudBase 权限配置正确
- ✅ .env 文件配置正确

**热联调检查清单**：

1. **首页查询**
   - [ ] 能加载 CloudBase 的 approved 商品列表
   - [ ] 搜索和筛选有效

2. **详情页**
   - [ ] 能正确加载商品完整信息
   - [ ] 图片 URL 正确，图片能显示

3. **发布页**
   - [ ] 选择图片上传无误
   - [ ] 发布后 CloudBase 中 listings.status = 'pending_review'（不会是 approved）

4. **消息页**
   - [ ] 创建会话后 conversations 集合中出现新记录
   - [ ] 发送消息后 messages 子集合中出现新消息

---

## 约束条件

❌ **不做**：
- H5 / App / 快应用（仅微信小程序）
- 支付、订单、地址、担保交易
- 复杂的本地缓存策略（可以简单做）
- 图片编辑、滤镜等高级功能

✅ **必须做**：
- CloudBase 接口模块化、易于后续修改
- 错误处理和用户提示（网络错误、超时、服务异常）
- 登录鉴权（至少检查 openid 有无）

---

## 输出交付物

### 代码交付

- 完整 Uni-app 工程目录（可直接在微信开发者工具中打开）
- 4 个页面的生产级代码
- CloudBase 接口封装完整

### 文档交付

- `README.md`：工程结构说明和运行方式
- `API-INTEGRATION.md`：CloudBase 接口文档（参数、返回字段、注意事项）
- `ARCHITECTURE.md`：前端架构说明（目录结构、数据流、状态管理）

### 交付检查清单

- [ ] npm install && npm run dev（或 build）无 error
- [ ] 微信开发者工具能编译运行
- [ ] 所有 4 个页面都能打开
- [ ] 冷联调用 mock 数据能跑完整闭环
- [ ] 热联调接 CloudBase 能正常查询和写入

---

## 关键技术决策（锁定）

| 项 | 决策 | 理由 |
|----|------|------|
| 框架 | Uni-app | 跨端（现在先微信，后续可扩） |
| 初版端 | 微信小程序 | 最快上市，不做多端 |
| 后端接入 | CloudBase 直连 | 轻量、快速、省钱 |
| 状态管理 | Vue data + props（可选后续加 pinia） | MVP 阶段简单数据流够用 |
| 图片存储 | CloudBase 存储 | 与数据库同生态 |
| 消息实时性 | 轮询（30 秒一次）或 CloudBase 实时监听 | 轮询稳妥，监听更优 |

---

## 预期交付时间

| 里程碑 | 预计完成 | 检查点 |
|--------|---------|--------|
| 骨架搭建 | Day 2 | npm install OK，微信工具能打开 |
| 首页 + 详情 | Day 3 | 冷联调完成，页面布局无误 |
| 发布 + 消息 | Day 4 | 4 个页面都能加载 |
| 冷联调验证 | Day 4-5 | mock 数据闭环通畅 |
| 热联调 + 修复 | Day 5-6 | 接 CloudBase，bug 修复 |
| **QA 闭环** | Day 7 | QA Devops Agent 接手 |

---

## 与其他 Agent 的协作

### System Architect Agent
- 本阶段不需要，架构已冻结

### Data Infra Agent
- Day 1-2 完成数据准备（districts / listings + images）
- 你在 Day 3 开始热联调时，数据应该已经准备好

### Backend Admin Agent
- Day 5-6 如果前后端通信有 bug，可能需要配合修复
- 你的 CloudBase 接口调用失败时，他来排查权限问题

### QA DevOps Agent
- Day 7 接过工程，跑端到端验收

---

## 快速参考：4 个页面的核心数据约束

| 页面 | 读/写 | 集合与条件 | 输入输出 |
|------|-------|-----------|---------|
| 首页 | R | listings WHERE status='approved' | districtCode + keyword → [商品列表] |
| 详情 | R | listings + listing_images WHERE listing_id=id | listing_id → 商品完整信息 + 图片 |
| 发布 | W | listings (status='pending_review') + listing_images | form → 写 listings + 批量写 images |
| 消息 | R/W | conversations + messages | openid → [会话列表]；conversation_id → [消息] |

