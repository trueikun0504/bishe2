# 二手交易平台管理后台

基于 `Express + EJS + CloudBase` 的最小管理后台，提供商品审核、用户禁用、反馈查看等功能。

## 功能

- 管理员登录
- 商品审核、拒绝、下架
- 用户禁用、启用
- 反馈列表与详情查看

## 目录结构

```text
admin/
  server.js
  package.json
  routes/
    admin.js
  views/
    layouts/
      main.ejs
    listings/
      index.ejs
      show.ejs
    users/
      index.ejs
    feedback/
      index.ejs
      show.ejs
    login.ejs
    404.ejs
    500.ejs
```

## 本地启动

1. 安装依赖

```bash
cd admin
npm install
```

2. 配置根目录 [.env](g:\bishe2\.env)

```env
CLOUDBASE_ENV=你的CloudBase环境ID
TENCENT_SECRET_ID=你的腾讯云SecretId
TENCENT_SECRET_KEY=你的腾讯云SecretKey
```

3. 启动服务

```bash
npm run dev
```

或：

```bash
npm start
```

默认地址：`http://localhost:3001`

## 登录说明

- 后台登录使用 `users` 集合中 `role=admin` 且 `status=active` 的账号 `open_id`
- 如果还没有管理员账号，可以先运行：

```bash
node query-users.js
```

- 然后执行：

```bash
node set-admin-role.js --open-id 目标用户的open_id
```

## 依赖数据集合

- `users`
- `listings`
- `listing_images`
- `feedback`
- `admin_actions`

建议先运行 [init-db.js](g:\bishe2\init-db.js) 初始化集合和区县数据。

## 常见问题

### 登录失败

- 检查输入的 `open_id` 是否存在于 `users` 集合
- 检查该用户的 `role` 是否为 `admin`
- 检查该用户的 `status` 是否为 `active`

### 数据库连接失败

- 检查 [.env](g:\bishe2\.env) 中的 `CLOUDBASE_ENV`
- 检查 [.env](g:\bishe2\.env) 中的 `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`
- 检查 CloudBase 环境是否可访问

### 页面异常

- 检查服务端日志
- 检查视图模板是否存在
