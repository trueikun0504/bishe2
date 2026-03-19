# local-trader-uniapp

Uni-app 微信小程序 MVP，覆盖 4 个 P0 页面：

- 首页
- 商品详情
- 发布
- 消息

同时补了两个最小兜底页：

- 登录页
- 我的页

## 运行方式

1. 进入项目目录：

```bash
cd g:\bishe2\uniapp-project
```

2. 安装依赖：

```bash
npm install
```

3. 本地开发：

```bash
npm run dev:mp-weixin
```

4. 产出微信小程序构建：

```bash
npm run build:mp-weixin
```

然后用微信开发者工具打开 `dist/dev/mp-weixin` 或 `dist/build/mp-weixin`。

## 数据模式

项目支持两种模式，在“我的”页切换：

- `Mock`
  - 默认模式
  - 不依赖微信云环境
  - 启动时会自动注入演示商品、区县、会话和消息
- `CloudBase`
  - 只在微信小程序端可用
  - 通过根目录 `g:\bishe2\.env` 中的 `CLOUDBASE_ENV` 注入
  - 当前实现直接使用小程序端 `wx.cloud` 能力

## 字段契约

按冻结契约实现：

- `users`: `{ id, openid, nickname, avatar_url, role, status, created_at }`
- `districts`: `{ code, name, city_code, city_name }`
- `listings`: `{ id, openid, title, description, price, district_code, status, image_urls, created_at }`
- `listing_images`: `{ id, listing_id, image_url, order }`
- `conversations`: `{ id, listing_id, buyer_openid, seller_openid, last_message, unread_count, updated_at }`
- `messages`: `{ id, conversation_id, sender_openid, content, created_at }`
- `feedback`: `{ id, openid, category, content, contact_info, created_at }`

## 当前实现说明

- 首页只读取 `status='approved'`
- 发布默认写入 `status='pending_review'`
- 详情优先读 `listings.image_urls`，为空时兜底读 `listing_images`
- 消息使用平铺 `messages` 集合，通过 `conversation_id` 关联
- 登录为测试登录，允许手动输入 openid，方便前端独立联调

## 目录

```
src/
├── components/
├── pages/
│   ├── index/
│   ├── listing/
│   ├── publish/
│   ├── conversations/
│   ├── login/
│   └── profile/
├── services/
├── utils/
├── App.vue
├── main.js
├── manifest.json
├── pages.json
└── uni.scss
```

## 已知限制

- 真实微信登录与 openid 自动获取未接入，当前使用测试 openid
- CloudBase 消息未做真正实时监听，当前用轮询刷新
- 自定义底部导航用于快速交付，未接入原生 tabBar 图标资源
