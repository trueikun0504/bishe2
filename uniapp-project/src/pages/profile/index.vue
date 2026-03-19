<template>
  <view class="page-shell profile-page">
    <view class="page-head">
      <text class="page-title">我的</text>
      <text class="status-badge">Web API</text>
    </view>

    <view v-if="!currentUser" class="card auth-card">
      <text class="auth-title">微信授权登录</text>
      <text class="auth-subtitle">登录后即可读取和 Web 端一致的发布、收藏、会话数据。</text>
      <button
        class="wx-quick-btn"
        :disabled="quickLoginSubmitting"
        :loading="quickLoginSubmitting"
        @tap="handleWeixinQuickLogin"
      >
        微信授权登录
      </button>
    </view>

    <view v-else class="card profile-card">
      <text class="profile-label">当前登录用户</text>
      <view class="user-box">
        <text class="user-name">{{ currentUser.nickname || '微信用户' }}</text>
        <text class="user-id">{{ currentUser.openid || '未记录 openid' }}</text>
      </view>

      <view class="action-row">
        <view class="action-button primary" @tap="goMessages">
          <text>我的消息</text>
        </view>
        <view class="action-button" @tap="goFavorites">
          <text>我的收藏</text>
        </view>
        <view class="action-button" @tap="logout">
          <text>退出登录</text>
        </view>
      </view>
    </view>

    <view v-if="currentUser" class="stat-row">
      <view class="card stat-card">
        <text class="stat-value">{{ myListings.length }}</text>
        <text class="stat-label">我的帖子</text>
      </view>
      <view class="card stat-card">
        <text class="stat-value">{{ approvedCount }}</text>
        <text class="stat-label">在售/展示中</text>
      </view>
      <view class="card stat-card">
        <text class="stat-value">{{ conversations.length }}</text>
        <text class="stat-label">会话数</text>
      </view>
    </view>

    <view v-if="currentUser" class="card profile-card">
      <view class="section-title-row">
        <text class="profile-label">我发布的帖子</text>
        <text class="profile-tip">{{ loading ? '正在同步...' : '与 Web 端一致' }}</text>
      </view>

      <view v-if="errorText" class="error-box">
        <text class="error-text">{{ errorText }}</text>
      </view>

      <view v-else-if="!myListings.length && !loading" class="empty-box">
        <text class="profile-tip">你还没有发布记录，先去发布一个帖子吧。</text>
      </view>

      <view v-else class="listing-list">
        <view
          v-for="item in myListings"
          :key="item.id"
          class="listing-item"
          @tap="openListing(item)"
        >
          <view class="listing-main">
            <text class="listing-title">{{ item.title }}</text>
            <text class="listing-meta">¥{{ Number(item.price || 0) }} · {{ formatStatus(item.status) }}</text>
          </view>
          <view
            v-if="item.status === 'approved' || item.status === 'off_shelf'"
            class="listing-action"
            @tap.stop="toggleStatus(item)"
          >
            <text>{{ item.status === 'off_shelf' ? '重新上架' : '下架' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import {
  getCurrentUser,
  signOut,
  signInWithWeixinAuthorization,
} from '../../services/auth'

const currentUser = computed(() => getCurrentUser())
const quickLoginSubmitting = ref(false)
const loading = ref(false)
const errorText = ref('')
const myListings = ref([])
const conversations = ref([])

const approvedCount = computed(() => {
  return myListings.value.filter((item) => item.status === 'approved').length
})

function formatStatus(value) {
  const map = {
    approved: '已上架',
    off_shelf: '已下架',
    pending_review: '待审核',
    rejected: '已驳回',
    sold: '已售出',
  }
  return map[value] || value || '--'
}

async function loadProfileData() {
  if (!currentUser.value) {
    myListings.value = []
    conversations.value = []
    return
  }

  loading.value = true
  errorText.value = ''
  try {
    const [listingItems, conversationItems] = await Promise.all([
      api.me.listings(),
      api.conversations.list(currentUser.value.openid),
    ])
    myListings.value = Array.isArray(listingItems) ? listingItems : []
    conversations.value = Array.isArray(conversationItems) ? conversationItems : []
  } catch (error) {
    errorText.value = error.message || '加载个人数据失败'
  } finally {
    loading.value = false
  }
}

async function handleWeixinQuickLogin() {
  if (quickLoginSubmitting.value) {
    return
  }

  quickLoginSubmitting.value = true
  try {
    await signInWithWeixinAuthorization()
    uni.showToast({
      title: '登录成功',
      icon: 'success',
    })
    await loadProfileData()
  } catch (error) {
    uni.showToast({
      title: error.message || '微信登录失败',
      icon: 'none',
    })
  } finally {
    quickLoginSubmitting.value = false
  }
}

function logout() {
  signOut()
  myListings.value = []
  conversations.value = []
  uni.showToast({
    title: '已退出登录',
    icon: 'none',
  })
}

function goMessages() {
  uni.switchTab({
    url: '/pages/conversations/conversations',
  })
}

function goFavorites() {
  uni.navigateTo({
    url: '/pages/favorites/index',
  })
}

function openListing(item) {
  if (!item?.id) {
    return
  }
  uni.navigateTo({
    url: `/pages/listing/listing?id=${item.id}`,
  })
}

async function toggleStatus(item) {
  if (!item?.id) {
    return
  }

  const nextStatus = item.status === 'off_shelf' ? 'approved' : 'off_shelf'
  try {
    const updated = await api.me.updateListingStatus(item.id, nextStatus)
    myListings.value = myListings.value.map((entry) =>
      entry.id === item.id
        ? {
            ...entry,
            status: updated?.status || nextStatus,
            review_status: updated?.review_status || updated?.status || nextStatus,
            updated_at: updated?.updated_at || Date.now(),
          }
        : entry,
    )
  } catch (error) {
    uni.showToast({
      title: error.message || '状态更新失败',
      icon: 'none',
    })
  }
}

onLoad(() => {
  loadProfileData()
})

onShow(() => {
  loadProfileData()
})
</script>

<style scoped lang="scss">
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.page-head,
.section-title-row,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.auth-card,
.profile-card {
  padding: 28rpx;
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
.stat-label,
.listing-meta {
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

.user-box {
  margin-top: 16rpx;
}

.user-name {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
}

.action-row {
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.action-button,
.listing-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 82rpx;
  padding: 0 28rpx;
  border-radius: 24rpx;
  background: #f8f5eb;
  font-size: 26rpx;
  font-weight: 700;
}

.action-button.primary,
.listing-action {
  background: var(--brand-yellow);
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.stat-card {
  padding: 24rpx;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
}

.listing-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 18rpx;
}

.listing-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: #f8f5eb;
}

.listing-main {
  flex: 1;
  min-width: 0;
}

.listing-title {
  display: block;
  color: var(--text-primary);
  font-size: 28rpx;
  font-weight: 700;
}

.error-box,
.empty-box {
  margin-top: 18rpx;
}

.error-text {
  color: var(--danger);
  font-size: 24rpx;
}
</style>
