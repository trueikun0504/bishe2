# 微信小程序授权登录 API 文档

## 概述

本文档描述新的微信小程序授权登录 API，用于替换旧的占位实现。新的实现通过服务端调用微信 API 获取用户 openid 和手机号，确保用户标识稳定，不再依赖前端传递敏感信息。

## 环境要求

### 环境变量配置
在根目录 `.env` 文件中配置以下变量：

```bash
# 微信小程序配置
WECHAT_APPID=wxfe68200fc479de54
WECHAT_APPSECRET=your_actual_app_secret_here  # 替换为实际的 AppSecret

# JWT 配置
JWT_SECRET=your_strong_jwt_secret_key_here    # 替换为实际的 JWT 密钥
JWT_EXPIRES_IN=7d                             # Token 有效期，默认7天

# API 基础地址
API_BASE_URL=https://your-api-domain.com      # 替换为实际 API 地址
```

### 依赖安装
在 `admin` 目录下运行：
```bash
cd admin
npm install
```

## API 端点

### 1. 微信登录（获取 openid）

**POST** `/api/mp/auth/login`

接收微信小程序 `wx.login()` 返回的 code，服务端调用微信 `jscode2session` API 获取 openid/unionid，查找或创建用户，并签发 JWT token。

#### 请求头
```
Content-Type: application/json
```

#### 请求体
```json
{
  "code": "081abc123def456ghi789jkl012mno345",
  "nickname": "微信用户昵称（可选）",
  "avatar_url": "https://avatar.url（可选）"
}
```

#### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_1234567890",
      "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
      "unionid": "unionid_if_available",
      "nickname": "微信用户",
      "avatar_url": "https://thirdwx.qlogo.cn/mmopen/vi_32/xxx",
      "role": "user",
      "status": "active",
      "created_at": "2026-03-11T03:14:15.926Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": "7d"
  },
  "message": "",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

#### 错误响应
- `400` - 缺少必要参数
```json
{
  "success": false,
  "data": null,
  "message": "缺少 code 参数",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

- `500` - 服务器内部错误
```json
{
  "success": false,
  "data": null,
  "message": "微信登录失败: 具体错误信息",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

### 2. 绑定手机号

**POST** `/api/mp/auth/phone`

接收微信小程序 `getPhoneNumber()` 返回的 code，服务端调用微信 `getuserphonenumber` API 获取用户手机号并绑定到当前用户。

#### 请求头
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

#### 请求体
```json
{
  "code": "abc123def456ghi789jkl012mno345pqr678"
}
```

#### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_1234567890",
      "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
      "phone_number": "13800138000",
      "phone_verified": true,
      "phone_verified_at": "2026-03-11T03:14:15.926Z"
    },
    "phone_info": {
      "phoneNumber": "13800138000",
      "purePhoneNumber": "13800138000",
      "countryCode": "86"
    }
  },
  "message": "",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

#### 错误响应
- `401` - 未授权
```json
{
  "success": false,
  "data": null,
  "message": "未提供有效的认证令牌",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

- `1003` - 缺少手机号授权 code
```json
{
  "success": false,
  "data": null,
  "message": "缺少手机号授权 code",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

- `1001` - 微信 API 错误
```json
{
  "success": false,
  "data": null,
  "message": "获取手机号失败: 具体错误信息",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

### 3. 获取当前用户信息

**GET** `/api/mp/auth/me`

验证 JWT token，返回当前登录用户的详细信息。

#### 请求头
```
Authorization: Bearer <jwt_token>
```

#### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "id": "user_1234567890",
    "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
    "unionid": "unionid_if_available",
    "nickname": "微信用户",
    "avatar_url": "https://thirdwx.qlogo.cn/mmopen/vi_32/xxx",
    "phone_number": "13800138000",
    "phone_verified": true,
    "role": "user",
    "status": "active",
    "created_at": "2026-03-11T03:14:15.926Z",
    "updated_at": "2026-03-11T03:14:15.926Z"
  },
  "message": "",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

#### 错误响应
- `401` - 未授权
```json
{
  "success": false,
  "data": null,
  "message": "认证令牌无效或已过期",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

- `1002` - 用户不存在
```json
{
  "success": false,
  "data": null,
  "message": "用户不存在",
  "timestamp": "2026-03-11T03:14:15.926Z"
}
```

## 错误码说明

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| 400 | 请求参数无效 | 400 |
| 401 | 未授权/Token 无效 | 401 |
| 403 | 权限不足 | 403 |
| 404 | 资源不存在 | 404 |
| 500 | 服务器内部错误 | 500 |
| 1001 | 微信 API 调用失败 | 500 |
| 1002 | 用户不存在 | 404 |
| 1003 | 缺少手机号授权 code | 400 |
| 1004 | 无效的手机号授权 code | 400 |

## 统一响应格式

所有 API 响应遵循以下格式：
```json
{
  "success": boolean,      // 请求是否成功
  "data": any,            // 响应数据
  "message": string,      // 错误或成功消息
  "timestamp": string     // ISO 8601 时间戳
}
```

## curl 测试命令

### 测试环境准备
```bash
# 启动 admin 服务器
cd admin
npm run dev

# 服务器将在 http://localhost:3001 启动
```

### 1. 测试微信登录
```bash
# 使用模拟的微信 code（实际使用时需要真实的 wx.login() code）
curl -X POST http://localhost:3001/api/mp/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "test_wx_code_123456",
    "nickname": "测试用户",
    "avatar_url": "https://example.com/avatar.jpg"
  }'
```

### 2. 测试获取用户信息
```bash
# 使用上一步返回的 token
curl -X GET http://localhost:3001/api/mp/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. 测试绑定手机号
```bash
# 使用模拟的手机号授权 code
curl -X POST http://localhost:3001/api/mp/auth/phone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "code": "test_phone_code_789012"
  }'
```

## 小程序端集成示例

### 登录流程
```javascript
// 1. 调用 wx.login() 获取 code
wx.login({
  success: async (res) => {
    if (res.code) {
      // 2. 调用登录 API
      const response = await uni.request({
        url: 'https://your-api-domain.com/api/mp/auth/login',
        method: 'POST',
        data: {
          code: res.code,
          nickname: userInfo.nickName, // 可选
          avatar_url: userInfo.avatarUrl // 可选
        }
      });

      if (response.data.success) {
        const { token, user } = response.data.data;

        // 3. 保存 token 到本地存储
        uni.setStorageSync('token', token);
        uni.setStorageSync('user', user);

        console.log('登录成功:', user);
      }
    }
  }
});
```

### 绑定手机号流程
```javascript
// 1. 获取手机号授权
wx.getPhoneNumber({
  success: async (res) => {
    if (res.code) {
      // 2. 调用绑定手机号 API
      const token = uni.getStorageSync('token');
      const response = await uni.request({
        url: 'https://your-api-domain.com/api/mp/auth/phone',
        method: 'POST',
        header: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          code: res.code
        }
      });

      if (response.data.success) {
        console.log('手机号绑定成功:', response.data.data);
      }
    }
  }
});
```

## 数据表结构

### users 集合
```javascript
{
  "_id": "user_1234567890",
  "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",          // 微信 openid
  "unionid": "unionid_if_available",                 // 微信 unionid（可选）
  "nickname": "微信用户",                            // 用户昵称
  "avatar_url": "https://avatar.url",               // 头像 URL
  "phone_number": "13800138000",                    // 手机号
  "pure_phone_number": "13800138000",               // 纯手机号
  "country_code": "86",                             // 国家代码
  "phone_verified": true,                           // 手机号是否已验证
  "phone_verified_at": "2026-03-11T03:14:15.926Z",  // 手机号验证时间
  "role": "user",                                   // 用户角色：user/admin/customer_service
  "status": "active",                               // 用户状态：active/disabled
  "login_type": "weixin",                           // 登录方式：weixin/phone
  "created_at": "2026-03-11T03:14:15.926Z",         // 创建时间
  "updated_at": "2026-03-11T03:14:15.926Z"          // 更新时间
}
```

## 注意事项

1. **安全性**：
   - JWT_SECRET 必须是强随机字符串
   - 生产环境必须使用 HTTPS
   - 微信 AppSecret 必须保密，不可前端暴露

2. **微信 API 限制**：
   - `jscode2session` 调用频率有限制
   - `getPhoneNumber` 需要用户主动触发
   - access_token 有效期为2小时，需要缓存

3. **兼容性**：
   - 旧的 `/user/login-with-weixin` 和 `/user/login-with-phone` API 已标记为弃用
   - 建议尽快迁移到新 API

4. **错误处理**：
   - 所有 API 使用统一错误码
   - 客户端应根据错误码进行相应处理
   - 微信 API 错误需要记录日志以便排查

## 版本历史

- v1.0.0 (2026-03-11): 初始版本，实现真实的微信授权登录

---

**最后更新：2026-03-11**

**注意**：实际部署前，请确保所有环境变量都已正确配置，特别是 `WECHAT_APPSECRET` 和 `JWT_SECRET`。