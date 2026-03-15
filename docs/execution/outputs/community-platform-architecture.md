# 社区二手交易平台方案

## 目标范围

- 对标闲鱼式信息流与详情页体验，支持 `出售帖` 和 `求购帖`
- 覆盖 `Web + Uni-app H5 + 微信小程序`
- 以 `地级市 -> 区县` 为社区粒度，优先支持同城线下面交
- 支持站内聊天、后台审核、客服工作台
- 支付链路定位为 `线上担保支付`，本轮代码先完成结构预留，不含真实支付接入

## 端与职责

### 1. 客户端

- 技术栈: `Vue 3 + Uni-app`
- 承载端: `H5` 与 `微信小程序`
- 核心页面:
  - 首页信息流: 出售帖 / 求购帖筛选
  - 发布页: 支持上传实拍图或截图
  - 详情页: 支持发起聊天
  - 会话页: 买卖双方或求购双方沟通
  - 我的页: 登录、订单、收藏、我发布的帖子

### 2. 管理端

- 技术栈: `Express + EJS`
- 仅 Web
- 角色: `admin`
- 核心职责:
  - 审核出售帖与求购帖
  - 管理用户状态
  - 指派 / 取消客服角色
  - 查看反馈、举报与平台操作记录

### 3. 客服端

- 技术栈: `Express + EJS`
- 仅 Web
- 角色: `customer_service`
- 核心职责:
  - 进入客服工作台
  - 查看近期聊天概况
  - 跟进未关闭反馈
  - 按权限处理部分平台工单

## 数据模型

### 用户 `users`

- `id`
- `openid`
- `open_id`
- `nickname`
- `avatar_url`
- `role`: `user | customer_service | admin`
- `status`: `active | disabled`
- `default_city_code`
- `default_district_code`

### 帖子 `listings`

- `id`
- `openid`
- `open_id`
- `seller_id`
- `listing_type`: `sale | wanted`
- `title`
- `description`
- `price`
- `district_code`
- `district_name`
- `city_code`
- `city_name`
- `status`: `pending_review | approved | rejected | removed`
- `image_urls`
- `cover_image_url`
- `view_count`
- `contact_count`

### 会话 `conversations`

- `id`
- `listing_id`
- `buyer_openid`
- `seller_openid`
- `last_message`
- `unread_count`
- `updated_at`

说明:

- 对出售帖: `buyer_openid` 是咨询方，`seller_openid` 是卖家
- 对求购帖: `buyer_openid` 是发布求购的人，`seller_openid` 是提供货源的人

### 消息 `messages`

- `id`
- `conversation_id`
- `sender_openid`
- `content`
- `created_at`

### 反馈 `feedback`

- `id`
- `user_id / openid`
- `title`
- `content`
- `type`
- `status`: `new | processing | closed`

## 当前代码落地点

- Uni-app 客户端已支持:
  - 首页 `出售 / 求购` 筛选
  - 发布出售帖 / 求购帖
  - 详情页按帖子类型发起聊天
  - 图片 / 截图上传入口
- Web 后台已支持:
  - 管理端登录
  - 客服角色登录并进入客服工作台
  - 商品 / 求购审核
  - 用户与客服角色管理
  - 反馈处理

## 仍需继续接入

- 微信登录与手机号绑定
- 真实担保支付 / 分账 / 退款链路
- 订单中心与履约状态机
- 聊天消息实时推送
- 地级市 / 区县运营看板与风控规则
