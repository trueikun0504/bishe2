# CloudBase / Supabase 选型结论

## 结论

针对当前这个 MVP，我建议优先选择 `CloudBase（腾讯云开发）`，不选 `Supabase` 作为第一阶段主方案。

原因不是 Supabase 不好，而是当前目标是：

- 用最少资源尽快上线
- 优先交付 `Uni-app + 微信小程序`
- 快速验证本地二手交易的 `发布 -> 浏览 -> 联系` 闭环
- 尽量减少自建后端、对象存储、鉴权和运维工作

在这个前提下，CloudBase 更符合这次 MVP 的“最小化、可行性、可迭代”标准。

## 最终决策

- 第一阶段 MVP：`CloudBase`
- 保留备选方案：`Supabase`
- 复评节点：
  - 如果首批用户验证通过
  - 且后续需要更强的 SQL 分析、复杂关系查询、跨端统一后端、实时能力扩展
  - 再重新评估是否迁移到 `Supabase / PostgreSQL`

## 为什么这次先选 CloudBase

### 1. 更贴合微信小程序与 Uni-app 首发场景

CloudBase 官方文档明确覆盖了云函数、云数据库、云存储、身份认证和前端集成能力，并且是腾讯体系内的服务组合。  
对以微信小程序为首发形态的 MVP 来说，这意味着：

- 登录链路更顺
- 存储和后端服务更容易拼起来
- 部署路径更短

### 2. 更适合“几天到数周”的 MVP 交付节奏

本次最怕的不是功能少，而是基础设施过重。  
CloudBase 可以把以下成本压低：

- 自建后端服务
- 独立对象存储接入
- 服务器部署和运维
- 初期鉴权整合成本

这和本次 MVP 的目标完全一致。

### 3. 管理后台和运营能力更容易补齐

MVP 阶段必须有最小后台，否则商品审核和禁用用户会拖垮试点。  
CloudBase 在腾讯生态内做一个轻量管理后台的摩擦更小，适合先把审核和基础运营跑起来。

## 为什么这次不首选 Supabase

### 1. 它更强，但不一定更省

Supabase 的优势很明显：

- PostgreSQL
- SQL 能力完整
- Realtime 能力成熟
- Storage 和 Auth 都比较完整
- 后续分析、搜索、推荐扩展空间更好

但这些优势更多体现在：

- 复杂数据关系
- 多端统一后端
- 更强的分析和运营系统
- 中后期产品迭代

而不是这次 MVP 的第一周到第三周。

### 2. 微信小程序登录链路不是这次最短路径

我查阅的官方 Supabase 文档里，能看到 Auth、Storage、Database 和 Realtime 的完整说明，但在本次查阅范围内，没有看到一个与“微信小程序首发 MVP”同等顺手的官方一体化路径。  
因此这里的判断是：

- `Supabase 能做`
- 但对本次场景，`集成路径大概率比 CloudBase 更长`

这是一个基于官方文档范围的工程推断，不是说 Supabase 不能支持。

## 选型对比

| 维度 | CloudBase | Supabase | 这次 MVP 判断 |
| --- | --- | --- | --- |
| 微信小程序适配 | 强 | 可做，但集成链更长 | CloudBase 胜 |
| 上线速度 | 强 | 中等 | CloudBase 胜 |
| 轻量后端搭建 | 强 | 强 | 平 |
| 数据关系建模 | 中 | 强 | Supabase 胜 |
| SQL 查询分析 | 弱于 Postgres | 强 | Supabase 胜 |
| Realtime 聊天扩展 | 中 | 强 | Supabase 胜 |
| 国内首发链路 | 强 | 中 | CloudBase 胜 |
| MVP 总体匹配度 | 高 | 中高 | CloudBase 胜 |

## 推荐技术组合

### MVP 第一阶段推荐栈

- 前端：`Uni-app`
- 首发端：`微信小程序`
- 后端：`CloudBase 云函数`
- 数据库：`CloudBase 云数据库`
- 文件存储：`CloudBase 云存储`
- 管理后台：轻量 Web 后台，直接连管理接口

### 备选栈

- 前端：`Uni-app`
- 后端：`Supabase`
- 数据库：`PostgreSQL`
- 存储：`Supabase Storage`
- 鉴权：`Supabase Auth + 自定义小程序登录桥接`

## 数据模型建议

无论最终选 CloudBase 还是 Supabase，业务模型不变：

- `users`
- `districts`
- `listings`
- `listing_images`
- `conversations`
- `messages`
- `feedback`
- `admin_actions`

也就是说：

- 先把业务模型稳定下来
- 底层存储选型只影响实现方式
- 不影响页面、接口、闭环和埋点定义

## 风险与取舍

### 选择 CloudBase 的风险

- 文档型数据库在复杂关系查询上不如 PostgreSQL 直接
- 后期做复杂搜索、推荐和分析时，可能需要补更多数据工程能力
- 如果以后重点不再是微信生态，平台绑定感会更强

### 选择 Supabase 的风险

- 首发小程序链路更长
- 登录、对象存储、消息和部署整合成本更高
- 更容易在 MVP 阶段把时间花在“基础设施正确性”而不是“用户验证”

## 主脑结论

如果你的目标是：

- 先拿给一批种子用户试
- 尽快看到是否真的有人发布和发起聊天
- 先验证核心商业假设

那就应该选 `CloudBase`。

如果你的目标变成：

- 未来重点是跨端统一
- 更复杂的 SQL 分析
- 更强的实时聊天和推荐系统
- 更高的数据可迁移性

那下一阶段再评估 `Supabase` 更合理。

## 数据库初始化脚本草案说明

本目录下同时给出两份草案：

- [cloudbase-bootstrap-draft.js](g:\bishe2\docs\mvp\db-init\cloudbase-bootstrap-draft.js)
- [supabase-init-draft.sql](g:\bishe2\docs\mvp\db-init\supabase-init-draft.sql)

其中：

- `cloudbase-bootstrap-draft.js` 是当前推荐方案的草案
- `supabase-init-draft.sql` 是保留备选方案的草案

## 参考来源

以下为本次结论参考的官方文档，检索时间为 `2026-03-10`：

- CloudBase 概览：https://docs.cloudbase.net/en/guide/intro
- CloudBase 云数据库：https://docs.cloudbase.net/en/database/introduction
- CloudBase 身份认证：https://docs.cloudbase.net/en/authentication/intro
- CloudBase 云函数：https://docs.cloudbase.net/en/functions/intro
- CloudBase 云存储：https://docs.cloudbase.net/en/storage/intro
- CloudBase 安全规则：https://docs.cloudbase.net/en/database/security-rules
- Supabase 数据库：https://supabase.com/docs/guides/database/overview
- Supabase Auth：https://supabase.com/docs/guides/auth
- Supabase Storage：https://supabase.com/docs/guides/storage
- Supabase Realtime：https://supabase.com/docs/guides/realtime

说明：

- “CloudBase 更适合本次小程序 MVP 首发”的结论，是基于上述官方能力边界做出的工程判断。
- “Supabase 本次不作为首发方案”是阶段性选择，不是长期否定。
