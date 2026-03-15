# system-architect-agent 任务包

## 你的职责

你负责把当前 MVP 的技术方案冻结成可以执行的工程结构。

## 输入材料

- [01-p0-pages.md](g:\bishe2\docs\mvp\01-p0-pages.md)
- [02-data-model.md](g:\bishe2\docs\mvp\02-data-model.md)
- [03-api-and-flow.md](g:\bishe2\docs\mvp\03-api-and-flow.md)
- [04-cloudbase-vs-supabase.md](g:\bishe2\docs\mvp\04-cloudbase-vs-supabase.md)
- [05-ui-reference-alignment.md](g:\bishe2\docs\mvp\05-ui-reference-alignment.md)

## 目标

- 输出 CloudBase 版本的工程结构
- 明确云函数拆分
- 明确前后端目录约定
- 明确前端如何调用 CloudBase

## 必做任务

1. 设计最终目录结构
2. 定义 CloudBase 云函数拆分
3. 定义图片上传流程
4. 定义会话与消息的数据读写流程
5. 明确哪些逻辑放前端，哪些逻辑放云函数

## 输出物

- `技术架构冻结文档`
- `目录结构建议`
- `云函数列表`
- `接口与云函数映射表`

## 约束

- 不引入额外重后端
- 不把订单、支付、地址加入 P0
- 不扩展到多城市复杂架构

## 验收标准

- 前端、数据、后台、QA 都能按你的结论独立开工
- 不存在职责模糊的模块
