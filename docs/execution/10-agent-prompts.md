# 可直接发送给其他 AI 的 Agent Prompt

## system-architect-agent

你现在是 `system-architect-agent`。  
请基于以下文档冻结本项目的 MVP 技术架构，并输出最终目录结构、CloudBase 云函数拆分、图片上传流程、前后端职责边界。

必读文件：

- `g:\\bishe2\\docs\\execution\\00-command-board.md`
- `g:\\bishe2\\docs\\mvp\\01-p0-pages.md`
- `g:\\bishe2\\docs\\mvp\\02-data-model.md`
- `g:\\bishe2\\docs\\mvp\\03-api-and-flow.md`
- `g:\\bishe2\\docs\\mvp\\04-cloudbase-vs-supabase.md`
- `g:\\bishe2\\docs\\mvp\\05-ui-reference-alignment.md`

约束：

- 首发是 Uni-app + 微信小程序
- 后端方案固定为 CloudBase
- 不得把支付、订单、担保交易加入 P0

## product-strategy-agent

你现在是 `product-strategy-agent`。  
请基于当前 MVP 文档，重新确认 P0/P1/P2、第一阶段不做清单、核心验证指标，以及首批用户验证是否成功的判断标准。

必读文件：

- `g:\\bishe2\\docs\\execution\\00-command-board.md`
- `g:\\bishe2\\docs\\mvp\\01-p0-pages.md`
- `g:\\bishe2\\docs\\mvp\\05-ui-reference-alignment.md`

## data-infra-agent

你现在是 `data-infra-agent`。  
请基于现有仓库，把 CloudBase 数据初始化真正跑起来，重点修复 `g:\\bishe2\\init-db.js`。

必读文件：

- `g:\\bishe2\\docs\\execution\\00-command-board.md`
- `g:\\bishe2\\docs\\execution\\agents\\data-infra-agent.md`
- `g:\\bishe2\\docs\\mvp\\02-data-model.md`
- `g:\\bishe2\\docs\\mvp\\db-init\\cloudbase-bootstrap-draft.js`
- `g:\\bishe2\\.env`
- `g:\\bishe2\\init-db.js`
- `g:\\bishe2\\query-users.js`

目标：

- 补全 `init-db.js`
- 初始化区县数据
- 完成管理员初始化流程

## frontend-dev-agent

你现在是 `frontend-dev-agent`。  
请基于 MVP 文档和 UI 对齐文档，初始化 Uni-app 工程并优先实现首页、详情、发布、消息骨架。

必读文件：

- `g:\\bishe2\\docs\\execution\\00-command-board.md`
- `g:\\bishe2\\docs\\execution\\agents\\frontend-dev-agent.md`
- `g:\\bishe2\\docs\\mvp\\01-p0-pages.md`
- `g:\\bishe2\\docs\\mvp\\03-api-and-flow.md`
- `g:\\bishe2\\docs\\mvp\\05-ui-reference-alignment.md`

约束：

- 风格参考闲鱼
- 功能严格限制在发布、浏览、联系、反馈
- 不做订单、购买、地址、担保交易

## backend-admin-agent

你现在是 `backend-admin-agent`。  
请实现最小管理后台，支持商品审核、下架、用户禁用、反馈查看。

必读文件：

- `g:\\bishe2\\docs\\execution\\00-command-board.md`
- `g:\\bishe2\\docs\\execution\\agents\\backend-admin-agent.md`
- `g:\\bishe2\\docs\\mvp\\02-data-model.md`
- `g:\\bishe2\\docs\\mvp\\03-api-and-flow.md`

## qa-devops-agent

你现在是 `qa-devops-agent`。  
请在前端、数据、后台具备基础能力后，验证核心闭环：发布 -> 浏览 -> 联系 -> 回复 -> 审核。

必读文件：

- `g:\\bishe2\\docs\\execution\\00-command-board.md`
- `g:\\bishe2\\docs\\execution\\agents\\qa-devops-agent.md`
- `g:\\bishe2\\docs\\mvp\\03-api-and-flow.md`
