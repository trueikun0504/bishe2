# 本地二手交易 MVP 最小数据模型

## 设计原则

- 只支持 P0 闭环
- 字段尽量少，但要能支撑审核、会话和基础统计
- 优先支持云开发或轻量数据库
- 支持后续平滑扩展，不做过早抽象

## 测试范围建议

- 首期只录入 1 到 3 个测试城市的区县
- 示例：
  - 杭州：西湖区、拱墅区、余杭区
  - 成都：武侯区、成华区、高新区
  - 武汉：洪山区、武昌区、江汉区

## 集合 / 表清单

- `users`
- `districts`
- `listings`
- `listing_images`
- `conversations`
- `messages`
- `feedback`
- `admin_actions`

## 1. users

用途：存储用户基础身份与状态。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 用户唯一 ID |
| open_id | string | 是 | 微信 openid 或平台唯一身份 |
| nickname | string | 是 | 用户昵称 |
| avatar_url | string | 否 | 头像 |
| mobile | string | 否 | 手机号，MVP 可选 |
| role | string | 是 | `user` / `admin` / `customer_service` |
| status | string | 是 | `active` / `disabled` |
| default_city_code | string | 否 | 默认城市编码 |
| default_district_code | string | 否 | 默认区县编码 |
| created_at | datetime | 是 | 创建时间 |
| updated_at | datetime | 是 | 更新时间 |

索引建议：

- `open_id` 唯一索引
- `status`

## 2. districts

用途：存储 MVP 可用的省市区县数据。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 行政区编码 |
| name | string | 是 | 区县名称 |
| city_code | string | 是 | 城市编码 |
| city_name | string | 是 | 城市名称 |
| province_code | string | 是 | 省编码 |
| province_name | string | 是 | 省名称 |
| is_active | boolean | 是 | 是否启用 |
| sort_order | number | 否 | 排序 |

索引建议：

- `city_code + is_active`

## 3. listings

用途：存储商品主体。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 商品 ID |
| seller_id | string | 是 | 发布者 ID |
| title | string | 是 | 商品标题 |
| description | string | 是 | 商品描述 |
| price | number | 是 | 商品价格 |
| district_code | string | 是 | 所在区县编码 |
| district_name | string | 是 | 所在区县名称，便于展示 |
| city_code | string | 是 | 所在城市编码 |
| city_name | string | 是 | 所在城市名称 |
| status | string | 是 | `draft` / `pending_review` / `approved` / `rejected` / `removed` / `sold` |
| review_status | string | 是 | `pending` / `approved` / `rejected` |
| reject_reason | string | 否 | 审核拒绝原因 |
| cover_image_url | string | 否 | 封面图 |
| image_count | number | 是 | 图片数量 |
| view_count | number | 是 | 浏览次数 |
| contact_count | number | 是 | 联系发起次数 |
| last_contact_at | datetime | 否 | 最近被联系时间 |
| created_at | datetime | 是 | 创建时间 |
| updated_at | datetime | 是 | 更新时间 |

索引建议：

- `status + district_code + created_at`
- `seller_id + created_at`
- `title` 关键词检索索引或简化搜索字段

## 4. listing_images

用途：存储商品图片。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 图片 ID |
| listing_id | string | 是 | 商品 ID |
| image_url | string | 是 | 图片地址 |
| sort_order | number | 是 | 排序 |
| created_at | datetime | 是 | 创建时间 |

索引建议：

- `listing_id + sort_order`

## 5. conversations

用途：存储商品相关会话。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 会话 ID |
| listing_id | string | 是 | 商品 ID |
| buyer_id | string | 是 | 买家 ID |
| seller_id | string | 是 | 卖家 ID |
| status | string | 是 | `active` / `closed` |
| last_message_text | string | 否 | 最后一条消息摘要 |
| last_message_at | datetime | 否 | 最后一条消息时间 |
| buyer_unread_count | number | 是 | 买家未读数 |
| seller_unread_count | number | 是 | 卖家未读数 |
| created_at | datetime | 是 | 创建时间 |
| updated_at | datetime | 是 | 更新时间 |

约束建议：

- 一个买家对同一个商品只保留一个活跃会话

索引建议：

- `buyer_id + updated_at`
- `seller_id + updated_at`
- `listing_id + buyer_id`

## 6. messages

用途：存储站内文字消息。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 消息 ID |
| conversation_id | string | 是 | 会话 ID |
| sender_id | string | 是 | 发送者 ID |
| receiver_id | string | 是 | 接收者 ID |
| content | string | 是 | 文本内容 |
| message_type | string | 是 | 固定为 `text` |
| read_status | string | 是 | `unread` / `read` |
| created_at | datetime | 是 | 创建时间 |

索引建议：

- `conversation_id + created_at`
- `receiver_id + read_status`

## 7. feedback

用途：收集用户反馈。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 反馈 ID |
| user_id | string | 否 | 用户 ID，允许匿名 |
| category | string | 是 | `bug` / `suggestion` / `complaint` / `other` |
| content | string | 是 | 反馈内容 |
| contact_info | string | 否 | 联系方式 |
| status | string | 是 | `new` / `processing` / `closed` |
| created_at | datetime | 是 | 创建时间 |

索引建议：

- `status + created_at`

## 8. admin_actions

用途：记录后台管理动作，便于追溯。

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 日志 ID |
| admin_user_id | string | 是 | 管理员 ID |
| target_type | string | 是 | `listing` / `user` / `feedback` |
| target_id | string | 是 | 目标 ID |
| action | string | 是 | `approve` / `reject` / `remove` / `disable` / `close_feedback` |
| action_note | string | 否 | 备注 |
| created_at | datetime | 是 | 创建时间 |

索引建议：

- `target_type + target_id`
- `admin_user_id + created_at`

## 核心关系

- 一个用户可发布多个商品
- 一个商品有多张图片
- 一个商品可产生多个会话
- 一个会话有多条消息
- 一个管理员可对多个商品和用户执行管理动作

## 关键状态定义

### 商品状态

- `pending_review`：待审核
- `approved`：审核通过，可展示
- `rejected`：审核拒绝，不展示
- `removed`：管理员下架
- `sold`：用户手动标记已售，MVP 可后置

### 用户状态

- `active`：正常
- `disabled`：禁用

### 会话状态

- `active`：可继续沟通
- `closed`：结束沟通，MVP 可先不开放给用户主动关闭

## MVP 必备统计字段

建议基于表内字段和事件埋点统计：

- 商品发布数
- 审核通过数
- 商品详情浏览数
- 联系发起数
- 卖家回复数
- 用户反馈数

## 后续迭代预留

以下能力暂不建复杂结构，只保留未来扩展空间：

- 收藏
- 举报
- 订单
- 支付
- 客服工单
- 推荐标签
