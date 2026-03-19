# Frontend Dev Agent Prompt（可直接发送给其他 AI）

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

### 集合字段对齐表

```
users
├─ id / openid (PK)
├─ nickname
├─ avatar_url
├─ role ('user' / 'admin')
├─ status ('active' / 'disabled')
└─ created_at

districts
├─ code (PK)
├─ name
├─ city_code
├─ city_name
└─ (冻结，不新增)

listings
├─ id (PK)
├─ openid (卖家)
├─ title
├─ description
├─ price
├─ district_code
├─ status ('pending_review' / 'approved' / 'rejected' / 'removed')  ← 关键！
├─ image_urls [string]  (可选：在 listing_images 里存)
└─ created_at

listing_images
├─ id (PK)
├─ listing_id (FK)
├─ image_url
├─ order
└─ (可选集合，也可把 image_urls 直接放 listings)

conversations
├─ id (PK)
├─ listing_id (FK)
├─ buyer_openid
├─ seller_openid
├─ last_message
├─ unread_count
└─ updated_at

messages
├─ id (PK)
├─ conversation_id (FK)
├─ sender_openid
├─ content
└─ created_at

feedback
├─ id (PK)
├─ openid
├─ category
├─ content
├─ contact_info
└─ created_at
```

### 4 个页面的数据约束

```
首页
├─ 读 listings WHERE status='approved' AND district_code=districtCode
├─ 支持关键词搜索（title like keyword）
└─ 只读，不写

详情
├─ 读 listings WHERE id=listingId
├─ 读 listing_images WHERE listing_id=listingId （或从 listings.image_urls 读）
└─ 只读，不写

发布
├─ 写 listings { openid, title, description, price, district_code, status='pending_review', image_urls, created_at }
├─ 写 listing_images（可选）
└─ 返回 listing_id

消息
├─ 读 conversations WHERE buyer_openid=currentOpenid OR seller_openid=currentOpenid
├─ 写 conversations { listing_id, buyer_openid, seller_openid, last_message, updated_at }
├─ 读 messages WHERE conversation_id=id
└─ 写 messages { conversation_id, sender_openid, content, created_at }
   并更新 conversations.last_message + updated_at
```

## 4 个页面的详细需求

### Page 1：首页（index）

```
顶部导航
├─ Logo（或简单文字）
├─ 黄底（#FFE000）
└─ 搜索框

中部内容
├─ 区县选择（弹层）
├─ 商品流（双列卡片）
│  └─ 每张卡片：图片 + 标题 + 价格 + 卖家昵称 + 时间
├─ 点击卡片进详情，传 listing_id
└─ 点击区县切换后刷新列表

底部导航
└─ 首页 / 发布 / 消息 / 我的
   └─ 发布 → 检查登录状态，未登录跳登录页
   └─ 消息 → 跳消息列表
   └─ 我的 → 跳我的页（暂可空）
```

### Page 2：详情（listing）

```
商品图片区
├─ 单张或轮播（如果有多图）
└─ 可点击查看大图

基础信息
├─ 标题（大号、粗）
├─ 价格（#FF5A1F 橙红色、超大号）
├─ 描述
├─ 区县 + 发布时间
└─ 卖家昵称

主 CTA
└─ "聊一聊"按钮（黄底、胶囊、底部或悬浮）
   └─ 非登录用户 → 跳登录页
   └─ 登录用户 → 调 conversations.createOrGet() → 跳消息详情页
```

### Page 3：发布（publish）

```
表单字段
├─ 标题（输入框、必填）
├─ 描述（文本域、必填）
├─ 价格（數字输入、必填）
├─ 区县（선택/弹层、必填、可记忆）
└─ 图片（最多 6 张、必填至少 1 张）

提交流程
├─ 验证所有字段（必填）
├─ 上传图片到 CloudBase 存储
├─ 写入 listings { status: 'pending_review' }  ← 关键
├─ 成功 → "已提交审核" 提示 → 跳回首页
└─ 失败 → 错误提示 → 留在当前页
```

### Page 4：消息（conversations + detail）

```
会话列表
├─ 显示所有相关会话（buyer 或 seller）
├─ 每条会话：商品图 + 商品标题 + 对方昵称 + 最后消息摘要 + 时间
├─ 点击进详情
└─ 底部导航直接跳这页

单会话详情
├─ 顶部：商品卡片（图 + 标题 + 价格）
├─ 中部：消息列表（左右分显、时间戳）
├─ 底部：文本输入框 + 发送按钮

数据交互
├─ 加载消息列表
├─ 发送消息后立即显示（乐观更新）
├─ 可用轮询（推荐 30s）或 CloudBase 实时监听（更优）更新接收端
└─ 返回列表 → 重新加载，看最新状态
```

## 工程目录建议

```
uniapp-project/
├── pages/
│   ├── index/
│   │   ├── index.vue
│   │   └── index.scss
│   ├── listing/
│   │   ├── listing.vue
│   │   └── listing.scss
│   ├── publish/
│   │   ├── publish.vue
│   │   └── publish.scss
│   ├── conversations/
│   │   ├── conversations.vue
│   │   ├── detail.vue
│   │   └── conversations.scss
│   └── login/  (可选，如需单独登录页)
│
├── components/
│   ├── NavBar.vue
│   ├── ProductCard.vue
│   ├── DistrictSelector.vue
│   ├── ImageUpload.vue
│   └── ...
│
├── services/
│   ├── api.js  ← 最关键！CloudBase 接口 wrapper
│   └── auth.js
│
├── utils/
│   ├── cloudbase.js  ← CloudBase 初始化
│   └── constants.js
│
├── static/  (图片、样式资源)
│
├── main.js
├── App.vue
├── uni.scss  (全局样式)
├── pages.json  (路由配置)
├── manifest.json  (小程序配置)
├── package.json
└── README.md
```

## CloudBase 接口封装示例（services/api.js）

```javascript
// 伪代码，展示结构
export const api = {
  listings: {
    async listApproved({ districtCode, keyword, page = 1, pageSize = 20 }) {
      // 查询 listings WHERE status = 'approved'
      // 支持 districtCode 和 keyword 过滤
      // 返回：[{ id, title, price, image_url, seller_nickname, created_at }, ...]
    },
    
    async getDetail(listingId) {
      // 获取单条 listing 完整信息
      // 同时获取关联的 listing_images
      // 返回：{ id, title, description, price, district_code, openid, seller_nickname, image_urls, created_at }
    },
    
    async create(data) {
      // data: { openid, title, description, price, district_code, image_urls }
      // 写入 listings { status: 'pending_review' }
      // 返回：{ id, status }
    }
  },
  
  conversations: {
    async list(currentOpenid) {
      // 查询 conversations WHERE buyer_openid = currentOpenid OR seller_openid = currentOpenid
      // 返回：[{ id, listing_id, buyer_openid, seller_openid, last_message, unread_count, updated_at }, ...]
    },
    
    async createOrGet(listingId, buyerOpenid, sellerOpenid) {
      // 检查是否存在，不存在则创建
      // 返回：{ id, listing_id, ... }
    },
    
    async getDetail(conversationId) {
      // 获取单条会话信息（可选）
      // 返回：{ id, ... }
    }
  },
  
  messages: {
    async list(conversationId) {
      // 查询 messages WHERE conversation_id = conversationId，按 created_at 排序
      // 返回：[{ id, sender_openid, content, created_at }, ...]
    },
    
    async send(conversationId, content, senderOpenid) {
      // 写入 messages { conversation_id, sender_openid, content, created_at }
      // 同时更新 conversations.last_message + updated_at
      // 返回：{ id, content, created_at }
    }
  }
}
```

## 技术栈决策（锁定）

| 项 | 选择 |
|----|------|
| 框架 | Uni-app |
| 初版端 | 微信小程序（H5/App 留 P1） |
| SDK | cloudbase-js-sdk |
| UI 组件库 | @dcloudio/uni-ui（可选） |
| 状态管理 | Vue data + props（简单阶段）；可后续迁 pinia/vuex |
| 图片存储 | CloudBase 存储 |
| 实时通信 | 轮询（稳妥）或 CloudBase 实时监听（更优） |

## 验收标准（Day 7，QA DevOps 接手前）

- ✅ Uni-app 工程可在微信开发者工具中编译运行（0 error）
- ✅ 4 个页面都能加载，路由跳转正确
- ✅ 冷联调（mock 数据）逻辑完整
- ✅ 热联调（CloudBase）数据流正常
- ✅ 首页能查询 approved 商品
- ✅ 详情页能显示完整信息 + 图片
- ✅ 发布页能上传图片 + 写入 pending_review 商品
- ✅ 消息页能创建会话 + 发送/接收消息
- ✅ 提交代码到仓库，文档完整（README + API 文档）

## 与其他 Agent 的协作

- **Data Infra Agent**（Day 1-2）：准备测试数据（districts / listings + images）
- **Backend Admin Agent**（Day 5-6）：如有前后端通信 bug，可配合排查
- **QA DevOps Agent**（Day 7）：接过完整工程，跑端到端验收

## 预期时间表（5-7 个工作日）

| Day | 里程碑 | 检查点 |
|-----|--------|--------|
| 1-2 | 骨架 + 配置 | npm install OK，微信工具编译成功 |
| 2-3 | 首页 + 详情 | 冷联调页面布局 OK |
| 3-4 | 发布 + 消息 | 4 页面都能加载 |
| 4-5 | 冷联调完成 | mock 数据关键路径通 |
| 5-6 | 热联调 + 修复 | 接 CloudBase，bug 修 |
| 6-7 | 文档 + 交付 | 代码入库，文档完整 |
| 7 | **QA 闭环** | **QA 接手** |

---

## 一旦你理解了以上 5 个关键点，立即开始第 2 步：起 Uni-app 骨架

```
关键点：
1. Uni-app + 微信小程序 + CloudBase（已冻结）
2. 4 个页面 + 7 个数据集合（数据约束已明确）
3. 冷联调 + 热联调两个验证阶段
4. CloudBase 接口封装必须模块化
5. 与其他 Agent 的分工和时间依赖（Day 1-2 需要 data-infra-agent 先行）
```

**开工吧！** 🚀

