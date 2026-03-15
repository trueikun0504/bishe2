# Agent Commander 指挥板

## 项目目标

在 `区/县` 范围内，最小化实现一个可运行的本地二手交易 MVP，用于验证：

- 用户是否愿意发布本地二手商品
- 用户是否愿意浏览并主动联系卖家
- 平台是否能形成 `发布 -> 浏览 -> 联系 -> 回复` 的核心闭环

## 当前主脑决策

- 首发形态：`Uni-app + 微信小程序`
- 后端方案：`CloudBase`
- UI 风格：参考闲鱼，但严格收缩到 MVP 功能边界
- 当前不做：
  - 支付
  - 订单
  - 地址管理
  - 担保交易
  - 客服系统
  - 推荐算法

## 当前仓库现状

已存在：

- [01-p0-pages.md](g:\bishe2\docs\mvp\01-p0-pages.md)
- [02-data-model.md](g:\bishe2\docs\mvp\02-data-model.md)
- [03-api-and-flow.md](g:\bishe2\docs\mvp\03-api-and-flow.md)
- [04-cloudbase-vs-supabase.md](g:\bishe2\docs\mvp\04-cloudbase-vs-supabase.md)
- [05-ui-reference-alignment.md](g:\bishe2\docs\mvp\05-ui-reference-alignment.md)
- [cloudbase-bootstrap-draft.js](g:\bishe2\docs\mvp\db-init\cloudbase-bootstrap-draft.js)
- [supabase-init-draft.sql](g:\bishe2\docs\mvp\db-init\supabase-init-draft.sql)
- [package.json](g:\bishe2\package.json)
- [.env](g:\bishe2\.env)
- [init-db.js](g:\bishe2\init-db.js)
- [query-users.js](g:\bishe2\query-users.js)

当前已知问题：

- [init-db.js](g:\bishe2\init-db.js) 仍是半成品，占位注释未替换完成
- `.env` 目前只有 `CLOUDBASE_ENV`
- 仓库里还没有 Uni-app 项目骨架
- 还没有 CloudBase 云函数目录
- 还没有管理后台工程

## 缺失 Agent

你需要用其他 AI 来充当这些 Agent：

- `system-architect-agent`
- `product-strategy-agent`
- `data-infra-agent`
- `frontend-dev-agent`
- `backend-admin-agent`
- `qa-devops-agent`

对应任务说明已写在 [agents](g:\bishe2\docs\execution\agents) 目录。

## 执行阶段

### 阶段 A：架构冻结

负责人：

- `system-architect-agent`
- `product-strategy-agent`

目标：

- 锁定 P0 功能、不做清单、页面范围、接口边界、CloudBase 实施方式

交付：

- 架构冻结结论
- 最终目录结构
- 云函数拆分方案

### 阶段 B：数据与基础服务

负责人：

- `data-infra-agent`

目标：

- 修复并执行数据库初始化
- 建立种子区县数据
- 建立 CloudBase 集合与最小权限策略

交付：

- 可运行的 [init-db.js](g:\bishe2\init-db.js)
- 集合初始化结果
- 管理员角色设置方案

### 阶段 C：用户端 MVP

负责人：

- `frontend-dev-agent`

目标：

- 初始化 Uni-app 项目
- 实现首页、详情、发布、消息、我的、反馈等 P0 页面
- 接入 CloudBase 登录、数据库和存储

交付：

- Uni-app 工程
- 可跑通的核心页面
- 与 CloudBase 打通的 P0 闭环

### 阶段 D：管理后台 MVP

负责人：

- `backend-admin-agent`

目标：

- 实现商品审核、下架、用户禁用、反馈查看

交付：

- 管理后台工程
- 后台登录与基础页面

### 阶段 E：联调、验证与部署

负责人：

- `qa-devops-agent`

目标：

- 跑通发布、浏览、联系、回复、审核链路
- 输出冒烟测试结果
- 产出预发布部署说明

交付：

- 闭环测试报告
- 预发布环境说明

## 并行关系

### 可以并行

- `system-architect-agent` 和 `product-strategy-agent`
- `data-infra-agent` 和 `frontend-dev-agent`
  - 前提：数据模型不再大改

### 需要串行卡点

1. 架构冻结后，前端和数据再正式开工
2. 数据初始化完成后，前端再接真实环境
3. 前端与后台都具备可用页面后，QA 再做闭环测试

## 优先级最高的实际任务

### Top 1

修复并补全 [init-db.js](g:\bishe2\init-db.js)，让 CloudBase 集合与测试区县数据先落地。

### Top 2

初始化 Uni-app 工程，并完成：

- 首页
- 商品详情
- 发布页
- 消息页骨架

### Top 3

做最小后台，至少支持：

- 审核通过商品
- 下架商品
- 禁用用户

## 主脑验收标准

只有同时满足下面 6 条，才算第一版 MVP 可用：

1. 用户能登录
2. 用户能发布商品
3. 审核通过后首页能看到商品
4. 买家能进入详情并发起联系
5. 卖家能看到消息并回复
6. 管理员能审核和下架

## 推荐执行顺序

1. 分配 `system-architect-agent`
2. 分配 `data-infra-agent`
3. 分配 `frontend-dev-agent`
4. 分配 `backend-admin-agent`
5. 分配 `qa-devops-agent`

## 备注

主脑不会把参考产品的全部能力纳入第一阶段。  
后续所有实现必须以本指挥板和 `docs/mvp` 下文档为准。
