<template>
  <view class="page-shell profile-page">
    <view class="page-head">
      <text class="page-title">我的</text>
      <text class="status-badge">{{ currentModeLabel }}</text>
    </view>

    <view v-if="!currentUser" class="card auth-card">
      <text class="auth-title">微信授权登录</text>
      <text class="auth-subtitle">
        登录后即可使用发布、聊天和消息能力，当前走本地后端登录接口。      </text>
      <button
        class="wx-quick-btn"
        :disabled="quickLoginSubmitting"
        :loading="quickLoginSubmitting"
        @tap="handleWeixinQuickLogin"
      >
        微信授权登录
      </button>
      <text class="auth-tip">{{ statusText }}</text>
    </view>

    <view class="card profile-card">
      <text class="profile-label">当前数据模式</text>
      <view class="mode-row">
        <view
          :class="['mode-button', { active: state.dataMode === MODE_MOCK }]"
          @tap="switchMode(MODE_MOCK)"
        >
          <text>Mock</text>
        </view>
        <view
          :class="['mode-button', { active: state.dataMode === MODE_CLOUDBASE }]"
          @tap="switchMode(MODE_CLOUDBASE)"
        >
          <text>CloudBase</text>
        </view>
      </view>
      <text class="profile-tip">{{ statusText }}</text>
    </view>

    <view class="card profile-card">
      <text class="profile-label">褰撳墠登录鐢ㄦ埛</text>
      <view v-if="currentUser" class="user-box">
        <text class="user-name">{{ currentUser.nickname || '微信用户' }}</text>
        <text class="user-id">{{ currentUser.openid || '未记录openid' }}</text>
      </view>
      <text v-else class="profile-tip">你尚未登录，发布和聊天功能会受限。/text>

      <view class="action-row">
        <view
          :class="['action-button', { primary: !currentUser }]"
          @tap="currentUser ? goLoginPage() : handleWeixinQuickLogin()"
        >
          <text>{{ currentUser ? '切换账号' : '微信授权登录' }}</text>
        </view>
        <view v-if="currentUser" class="action-button" @tap="logout">
          <text>退出登录/text>
        </view>
      </view>
    </view>

    <view class="card profile-card">
      <text class="profile-label">快捷入口</text>
      <view class="action-column">
        <view class="list-button" @tap="goMessages">
          <text>我的消息</text>
        </view>
        <view class="list-button" @tap="resetMock">
          <text>重置 Mock 鏁版嵁</text>
        </view>
      </view>
    </view>

    <BottomNav current="profile" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import BottomNav from '../../components/BottomNav.vue'
import { api } from '../../services/api'
import {
  getCurrentUser,
  signOut,
  signInWithWeixinAuthorization,
} from '../../services/auth'
import { API_BASE_URL, CLOUDBASE_ENV, MODE_CLOUDBASE, MODE_MOCK } from '../../utils/constants'
import { setDataMode, useAppState } from '../../utils/app-state'

const state = useAppState()
const currentUser = computed(() => getCurrentUser())
const quickLoginSubmitting = ref(false)

const currentModeLabel = computed(() =>
  state.dataMode === MODE_MOCK ? 'Mock 模式' : 'CloudBase 模式',
)

const statusText = computed(() => {
  const envText = CLOUDBASE_ENV ? `当前云环境：${CLOUDBASE_ENV}` : '未配置CloudBase 环境'
  return `${envText}；登录接口：${API_BASE_URL}/api/mp/auth/login`
})

function switchMode(mode) {
  setDataMode(mode)
  uni.showToast({
    title: mode === MODE_MOCK ? '已切换到 Mock' : '已切换到 CloudBase',
    icon: 'none',
  })
}

async function handleWeixinQuickLogin() {
  if (quickLoginSubmitting.value) {
    return
  }

  quickLoginSubmitting.value = true
  try {
    await signInWithWeixinAuthorization()
    uni.showToast({
      title: '登录鎴愬姛',
      icon: 'success',
    })
  } catch (error) {
    uni.showToast({
      title: error.message || '微信登录澶辫触',
      icon: 'none',
    })
  } finally {
    quickLoginSubmitting.value = false
  }
}

function goLoginPage() {
  uni.navigateTo({
    url: '/pages/login/index',
  })
}

function logout() {
  signOut()
  uni.showToast({
    title: '宸查€€鍑虹櫥褰?,
    icon: 'none',
  })
}

function goMessages() {
  uni.switchTab({
    url: '/pages/conversations/conversations',
  })
}

function resetMock() {
  api.runtime.resetMockDatabase()
  uni.showToast({
    title: 'Mock 鏁版嵁宸查噸缃?,
    icon: 'none',
  })
}
</script>

<style scoped lang="scss">
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.auth-card,
.profile-card {
  padding: 28rpx;
}

.auth-card {
  background: linear-gradient(180deg, #fffdf7 0%, #f7fff9 100%);
  border: 2rpx solid rgba(7, 193, 96, 0.1);
}

.auth-title,
.profile-label {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
}

.auth-subtitle,
.profile-tip,
.user-id,
.auth-tip {
  display: block;
  margin-top: 12rpx;
  color: var(--text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.wx-quick-btn {
  margin-top: 20rpx;
  height: 88rpx;
  border-radius: 16rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 700;
}

.wx-quick-btn::after {
  border: none;
}

.mode-row,
.action-row {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.mode-button,
.action-button,
.list-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82rpx;
  padding: 0 28rpx;
  border-radius: 24rpx;
  background: #f8f5eb;
  font-size: 26rpx;
  font-weight: 700;
}

.mode-button.active,
.action-button.primary {
  background: var(--brand-yellow);
}

.user-box {
  margin-top: 16rpx;
}

.user-name {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
}

.action-column {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.list-button {
  justify-content: flex-start;
}
</style>

