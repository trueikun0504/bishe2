const cloud = require('wx-server-sdk')
const crypto = require('node:crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function createResponse(success, data = null, message = '') {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
  }
}

function normalizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
}

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function signToken(user) {
  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' })
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = toBase64Url({
    sub: user._id || user.id,
    openid: user.openid,
    role: user.role || 'user',
    iat: issuedAt,
    exp: issuedAt + 7 * 24 * 60 * 60,
    iss: 'cloudbase.weixinAuthLogin',
  })
  const secret = `cloudbase-login:${user.openid}:${user._id || user.id}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

  return `${header}.${payload}.${signature}`
}

async function findUserByOpenid(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get()
  return result.data && result.data[0] ? result.data[0] : null
}

function buildUserUpdates(profile, unionid, openid) {
  const updates = {}
  const nickname = normalizeText(profile.nickName || profile.nickname)
  const avatarUrl = normalizeText(profile.avatarUrl || profile.avatar_url)
  const city = normalizeText(profile.city)
  const country = normalizeText(profile.country)
  const province = normalizeText(profile.province)
  const gender = Number(profile.gender || profile.sex || 0) || 0

  if (nickname) updates.nickname = nickname
  if (avatarUrl) updates.avatar_url = avatarUrl
  if (city) updates.city = city
  if (country) updates.country = country
  if (province) updates.province = province
  if (gender) updates.gender = gender
  if (unionid) updates.unionid = unionid
  if (openid) updates.open_id = openid

  updates.login_type = 'cloudbase_weixin'
  updates.updated_at = new Date()

  return updates
}

function buildUserResponse(user) {
  return {
    id: user._id || user.id,
    openid: user.openid,
    unionid: user.unionid || null,
    nickname: user.nickname || '微信用户',
    avatar_url: user.avatar_url || '',
    role: user.role || 'user',
    status: user.status || 'active',
    created_at: user.created_at || new Date(),
  }
}

exports.main = async (event = {}) => {
  try {
    const context = cloud.getWXContext()
    const openid = context.OPENID
    const unionid = context.UNIONID || null
    const profile = event.profile && typeof event.profile === 'object' ? event.profile : {}

    if (!openid) {
      return createResponse(false, null, '未获取到微信用户身份，请重试')
    }

    let user = await findUserByOpenid(openid)
    let loginType = 'login'

    if (user) {
      const updates = buildUserUpdates(profile, unionid, openid)
      const changedKeys = Object.keys(updates).filter((key) => {
        if (key === 'updated_at') {
          return true
        }
        return updates[key] !== undefined && updates[key] !== user[key]
      })

      if (changedKeys.length) {
        await db.collection('users').doc(user._id).update({ data: updates })
        user = { ...user, ...updates }
      }
    } else {
      loginType = 'register'
      const nickname = normalizeText(profile.nickName || profile.nickname, '微信用户')
      const avatarUrl = normalizeText(profile.avatarUrl || profile.avatar_url)
      const city = normalizeText(profile.city)
      const country = normalizeText(profile.country)
      const province = normalizeText(profile.province)
      const gender = Number(profile.gender || profile.sex || 0) || 0

      const newUser = {
        openid,
        open_id: openid,
        unionid,
        nickname,
        avatar_url: avatarUrl,
        city,
        country,
        province,
        gender,
        role: 'user',
        status: 'active',
        login_type: 'cloudbase_weixin',
        created_at: new Date(),
        updated_at: new Date(),
      }

      const addResult = await db.collection('users').add({ data: newUser })
      user = {
        ...newUser,
        _id: addResult.id || addResult._id,
      }
    }

    return createResponse(
      true,
      {
        user: buildUserResponse(user),
        token: signToken(user),
        type: loginType,
        expires_in: '7d',
      },
      '',
    )
  } catch (error) {
    console.error('cloud weixin auth login failed:', error)
    return createResponse(false, null, error.message || '微信登录失败，请稍后重试')
  }
}
