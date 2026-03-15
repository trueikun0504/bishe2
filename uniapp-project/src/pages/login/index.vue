<template>
  <view class="page-shell login-page">
    <view class="header-row">
      <view class="back-chip" @tap="goBack">
        <text>返回</text>
      </view>
      <text class="status-badge">{{ modeLabel }}</text>
    </view>

    <view class="card hero-card">
      <text class="card-title">微信授权登录</text>
      <text class="card-subtitle">
        当前登录改为走本地后端接口，不再依赖 CloudBase 云函数权限。
      </text>

      <view class="tips-panel">
        <text class="tips-title">登录前检查</text>
        <text class="tips-item">1. 使用真实小程序 AppID</text>
        <text class="tips-item">2. 本地后端服务已启动</text>
        <text class="tips-item">3. 开发者工具可访问本机 localhost:3001</text>
      </view>

      <button
        class="weixin-login-btn"
        :disabled="submitting"
        :loading="submitting"
        @tap="handleWeixinLogin"
      >
        {{ submitting ? '登录中...' : '微信授权登录' }}
      </button>

      <text class="hint-text">当前登录接口：{{ loginApiUrl }}</text>
    </view>

    <view class="card debug-card">
      <view class="debug-head">
        <text class="card-title">开发调试登录</text>
        <view class="toggle-chip" @tap="showTestMode = !showTestMode">
          <text>{{ showTestMode ? '收起' : '展开' }}</text>
        </view>
      </view>

      <text class="card-subtitle">
        这组入口只用于本地 Mock 联调，不参与真实微信授权。
      </text>

      <view v-if="showTestMode" class="debug-form">
        <text class="field-label">openid</text>
        <input
          v-model="form.openid"
          class="field-input"
          maxlength="32"
          placeholder="例如 buyer-demo-001"
        />

        <text class="field-label">昵称</text>
        <input
          v-model="form.nickname"
          class="field-input"
          maxlength="20"
          placeholder="例如 测试买家"
        />

        <text class="field-label">头像 URL</text>
        <input
          v-model="form.avatar_url"
          class="field-input"
          maxlength="200"
          placeholder="可留空"
        />

        <view class="debug-actions">
          <view class="ghost-action" @tap="fillDemoUser">
            <text>填入示例账号</text>
          </view>
          <view class="primary-action" @tap="handleMockLogin">
            <text>{{ submitting ? '登录中...' : '使用 Mock 登录' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  resolvePostLoginRoute,
  signIn,
  signInWithWeixinAuthorization,
} from '../../services/auth'
import { API_BASE_URL, MODE_MOCK } from '../../utils/constants'
import { useAppState } from '../../utils/app-state'

const state = useAppState()
const redirectPath = ref('')
const submitting = ref(false)
const showTestMode = ref(state.dataMode === MODE_MOCK)
const form = reactive({
  openid: '',
  nickname: '',
  avatar_url: '',
})

const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : '本地联调'))
const loginApiUrl = computed(() => `${API_BASE_URL}/api/mp/auth/login`)

function afterLogin() {
  const nextRoute = resolvePostLoginRoute(redirectPath.value)
  uni.showToast({
    title: '登录成功',
    icon: 'success',
  })

  setTimeout(() => {
    uni.reLaunch({ url: nextRoute })
  }, 350)
}

async function handleWeixinLogin() {
  if (submitting.value) {
    return
  }

  submitting.value = true
  try {
    await signInWithWeixinAuthorization()
    afterLogin()
  } catch (error) {
    uni.showToast({
      title: error.message || '微信登录失败',
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}

async function handleMockLogin() {
  if (submitting.value) {
    return
  }

  submitting.value = true
  try {
    await signIn(form)
    afterLogin()
  } catch (error) {
    uni.showToast({
      title: error.message || 'Mock 登录失败',
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}

function fillDemoUser() {
  form.openid = 'buyer-demo-001'
  form.nickname = '测试买家'
  form.avatar_url = ''
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }

  uni.reLaunch({
    url: '/pages/profile/index',
  })
}

onLoad((options) => {
  redirectPath.value = options.redirect ? decodeURIComponent(options.redirect) : ''
})
</script>

<style scoped lang="scss">
.login-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-bottom: 40rpx;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
}

.back-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 110rpx;
  height: 66rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.08);
  font-size: 24rpx;
  font-weight: 700;
}

.hero-card,
.debug-card {
  padding: 30rpx;
}

.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: var(--brand-ink);
}

.card-subtitle,
.hint-text {
  display: block;
  margin-top: 10rpx;
  color: var(--text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.tips-panel {
  margin-top: 22rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: #f6fbf8;
  border: 2rpx solid rgba(7, 193, 96, 0.12);
}

.tips-title {
  display: block;
  color: #1f7a49;
  font-size: 24rpx;
  font-weight: 700;
}

.tips-item {
  display: block;
  margin-top: 10rpx;
  color: rgba(34, 34, 34, 0.72);
  font-size: 24rpx;
}

.weixin-login-btn {
  margin-top: 24rpx;
  min-height: 92rpx;
  border-radius: 999rpx;
  background: #07c160;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
}

.weixin-login-btn::after {
  border: none;
}

.debug-card {
  border: 2rpx dashed rgba(34, 34, 34, 0.12);
  background: rgba(255, 255, 255, 0.86);
}

.debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.toggle-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  height: 52rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #f3efe2;
  font-size: 22rpx;
  font-weight: 700;
}

.debug-form {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.field-label {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--brand-ink);
}

.field-input {
  width: 100%;
  height: 82rpx;
  padding: 0 24rpx;
  border-radius: 20rpx;
  background: #fbfaf7;
  box-sizing: border-box;
}

.debug-actions {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 6rpx;
}

.ghost-action,
.primary-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.ghost-action {
  background: #f0ede2;
}

.primary-action {
  background: var(--brand-yellow);
}
</style>
