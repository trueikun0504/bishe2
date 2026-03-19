import {
  consumeReturnUrl,
  setCurrentUser,
  setDataMode,
  setReturnUrl,
  useAppState,
} from '../utils/app-state'
import { api } from './api'
import { API_BASE_URL, MODE_MOCK } from '../utils/constants'

const TOKEN_STORAGE_KEY = 'LOCAL_TRADER_AUTH_TOKEN'
const USER_STORAGE_KEY = 'LOCAL_TRADER_CURRENT_USER'

function storageGet(key, fallback = '') {
  try {
    const value = uni.getStorageSync(key)
    return value || fallback
  } catch (error) {
    return fallback
  }
}

function storageSet(key, value) {
  try {
    if (value === null || value === undefined || value === '') {
      uni.removeStorageSync(key)
      return
    }

    uni.setStorageSync(key, value)
  } catch (error) {
    console.error(`storage write failed for ${key}:`, error)
  }
}

function getAppId() {
  if (typeof uni.getAccountInfoSync !== 'function') {
    return ''
  }

  try {
    return String(uni.getAccountInfoSync()?.miniProgram?.appId || '').trim()
  } catch (error) {
    return ''
  }
}

function getPlatform() {
  if (typeof uni.getSystemInfoSync !== 'function') {
    return ''
  }

  try {
    return String(uni.getSystemInfoSync()?.platform || '').trim().toLowerCase()
  } catch (error) {
    return ''
  }
}

function isLocalApiBaseUrl() {
  return /localhost|127\.0\.0\.1/i.test(API_BASE_URL)
}

function saveAuth(user, token) {
  const payload = token ? { ...user, token } : { ...user }
  setCurrentUser(payload)
  storageSet(USER_STORAGE_KEY, payload)
  storageSet(TOKEN_STORAGE_KEY, token || '')
}

async function getWeixinCode() {
  const result = await new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: resolve,
      fail: reject,
    })
  })

  if (!result?.code) {
    throw new Error('获取微信登录 code 失败，请重试')
  }

  return result.code
}

async function getWeixinProfile() {
  if (typeof uni.getUserProfile !== 'function') {
    return {}
  }

  try {
    const result = await new Promise((resolve, reject) => {
      uni.getUserProfile({
        desc: '用于完善账号信息',
        success: resolve,
        fail: reject,
      })
    })

    return result?.userInfo || {}
  } catch (error) {
    console.warn('getUserProfile failed, continue with empty profile:', error)
    return {}
  }
}

async function ensureBackendReady() {
  const appId = getAppId()
  if (!appId || appId.includes('tourist')) {
    throw new Error('请使用真实小程序 AppID 运行当前项目')
  }

  if (isLocalApiBaseUrl() && getPlatform() !== 'devtools') {
    throw new Error('当前登录走本地后端，真机无法访问 localhost，请先在开发者工具中调试')
  }
}

export function getAuthToken() {
  return storageGet(TOKEN_STORAGE_KEY, '')
}

export function getCurrentUser() {
  return useAppState().currentUser
}

export function getCurrentRouteWithQuery() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]

  if (!current || !current.route) {
    return '/pages/index/index'
  }

  const query = current.options
    ? Object.entries(current.options)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
    : ''

  return query ? `/${current.route}?${query}` : `/${current.route}`
}

export async function signInWithWeixinAuthorization() {
  await ensureBackendReady()

  const code = await getWeixinCode()
  const profile = await getWeixinProfile()

  const response = await api.request({
    method: 'POST',
    url: '/api/mp/auth/login',
    data: {
      code,
      avatar: profile.avatarUrl || '',
      nickName: profile.nickName || profile.nickname || '',
      city: profile.city || '',
      country: profile.country || '',
      province: profile.province || '',
      sex: profile.gender || profile.sex || 0,
      type: 'routine',
      client_platform: getPlatform(),
    },
  })

  if (!response?.success) {
    throw new Error(response?.message || '微信登录失败，请稍后重试')
  }

  const user = response?.data?.user
  const token = response?.data?.token

  if (!user || !token) {
    throw new Error('登录接口返回的数据不完整')
  }

  saveAuth(user, token)
  return user
}

export async function signIn(profile) {
  const openid = String(profile?.openid || '').trim()
  if (!openid) {
    throw new Error('请输入测试 openid')
  }

  setDataMode(MODE_MOCK)

  const user = await api.users.upsert({
    id: `user-${openid}`,
    openid,
    nickname: String(profile?.nickname || '测试用户').trim(),
    avatar_url: String(profile?.avatar_url || '').trim(),
    role: 'user',
    status: 'active',
    login_type: 'mock',
    created_at: Date.now(),
  })

  saveAuth(user, `mock-token-${openid}`)
  return user
}

export function signOut() {
  storageSet(TOKEN_STORAGE_KEY, '')
  storageSet(USER_STORAGE_KEY, '')
  setCurrentUser(null)
}

export function ensureSignedIn(redirectUrl) {
  const currentUser = getCurrentUser()
  if (currentUser) {
    return currentUser
  }

  const target = redirectUrl || getCurrentRouteWithQuery()
  setReturnUrl(target)
  uni.navigateTo({
    url: `/pages/login/index?redirect=${encodeURIComponent(target)}`,
  })
  return null
}

export function resolvePostLoginRoute(queryRedirect = '') {
  return queryRedirect || consumeReturnUrl() || '/pages/index/index'
}
