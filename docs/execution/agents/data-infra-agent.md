# data-infra-agent 任务包

## 你的职责

你负责把 CloudBase 数据层和初始化脚本真正跑起来。

## 当前仓库事实

- 已安装 `@cloudbase/node-sdk`
- 已安装 `dotenv`
- [.env](g:\bishe2\.env) 已包含 `CLOUDBASE_ENV`
- [init-db.js](g:\bishe2\init-db.js) 是数据库初始化入口
- [query-users.js](g:\bishe2\query-users.js) 可用于查看用户和管理员 open_id
- [cloudbase-bootstrap-draft.js](g:\bishe2\docs\mvp\db-init\cloudbase-bootstrap-draft.js) 可作参考草案

## 输入材料

- [02-data-model.md](g:\bishe2\docs\mvp\02-data-model.md)
- [04-cloudbase-vs-supabase.md](g:\bishe2\docs\mvp\04-cloudbase-vs-supabase.md)
- [cloudbase-bootstrap-draft.js](g:\bishe2\docs\mvp\db-init\cloudbase-bootstrap-draft.js)

## 目标

- 修复并执行 [init-db.js](g:\bishe2\init-db.js)
- 初始化 MVP 测试区县数据
- 输出集合和索引规划
- 给出管理员角色设置说明

## 必做任务

1. 确认 [init-db.js](g:\bishe2\init-db.js) 可运行
2. 让脚本支持：
   - 区县种子数据初始化
   - 集合/索引规划输出
3. 运行 [query-users.js](g:\bishe2\query-users.js) 查看可用账号
4. 说明如何把目标用户设置为 `admin`
5. 执行初始化并记录结果

## 输出物

- 可运行的 [init-db.js](g:\bishe2\init-db.js)
- 初始化执行结果
- CloudBase 集合列表
- 管理员角色设置说明

## 不做内容

- 不扩展到 Supabase 正式实现
- 不做复杂 BI 和统计后台

## 验收标准

- 至少 `districts` 能完成初始化
- 集合规划清晰可见
- 管理员角色设置路径清晰可执行
