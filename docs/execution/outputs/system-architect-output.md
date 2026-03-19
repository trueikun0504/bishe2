# System Architect Output

## 技术架构概览

- **前端**：微信小程序（Uni-app） + CloudBase SDK，目录参照 `src/pages/**`  
- **后端**：全部使用 CloudBase 云函数，不引入其他服务器  
- **数据 Schema**：`listings`、`users`、`conversations`、`messages`、`feedback` 等集合  
- **存储**：图片通过 CloudBase 存储上传，返回 URL 存入文档  
- **职责划分**：认证与数据库写操作在云函数；前端负责 UI、缓存、简单校验  


## 建议目录结构

```
/cloudfunctions/
  auth/
    wechatLogin/index.js
    me/index.js
  listings/
    create/index.js
    list/index.js
    detail/index.js
    my/index.js
    status/index.js
  conversations/
    create/index.js
    list/index.js
    detail/index.js
    message/index.js
    read/index.js
  feedback/submit/index.js
  admin/
    listings/
      list/index.js
      approve/index.js
      reject/index.js
      remove/index.js
    users/
      list/index.js
      disable/index.js
    feedback/list/index.js
  uploadImage/index.js
/package.json
/src/
  pages/
    index/
    listing/
    publish/
    conversations/
    me/
    login/
    admin/
  components/
  services/   ← api wrappers
  utils/
/.env
```


## 云函数列表与接口映射表

| 前端接口 | 云函数路径 |
|----------|------------|
| POST `/api/auth/wechat-login` | `auth/wechatLogin` |
| GET `/api/me` | `auth/me` |
| GET `/api/districts` | `utils/districts` (可内置) |
| POST `/api/listings` | `listings/create` |
| GET `/api/listings` | `listings/list` |
| GET `/api/listings/{id}` | `listings/detail` |
| GET `/api/my/listings` | `listings/my` |
| POST `/api/my/listings/{id}/status` | `listings/status` |
| POST `/api/conversations` | `conversations/create` |
| GET `/api/conversations` | `conversations/list` |
| GET `/api/conversations/{id}` | `conversations/detail` |
| POST `/api/conversations/{id}/messages` | `conversations/message` |
| POST `/api/conversations/{id}/read` | `conversations/read` |
| POST `/api/feedback` | `feedback/submit` |
| ...后台接口对应 `admin/*` 云函数 |


## 核心流程说明

- **图片上传**：前端调用 `uploadImage` 云函数 → 函数使用 `cloud.uploadFile` 存储 → 返回 `fileID`/URL → 页面把 URL 填入 `listings` 数据。
- **会话消息**：创建会话/发送消息操作由相应云函数处理，写入 `conversations` 集合与其子集合 `messages`，并更新时间/未读数。


> 所有修改数据库的操作必须经过对应的云函数，保持前后端职责清晰，避免逻辑重叠。
