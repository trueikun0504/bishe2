<template>
  <view class="page-shell conversations-page">
    <view class="page-head">
      <view>
        <text class="page-title">消息</text>
        <text class="page-subtitle">会话按最近消息排序，点进去继续聊。</text>
      </view>
      <text class="status-badge">{{ modeLabel }}</text>
    </view>

    <EmptyState
      v-if="!currentUser"
      title="先登录再看消息"
      description="消息和发布都依赖同一个登录用户，登录后才能读取 conversations 和 messages。"
      action-text="去登录"
      @action="goLogin"
    />

    <view v-else-if="conversationList.length" class="conversation-list">
      <view
        v-for="item in conversationList"
        :key="item.id"
        class="conversation-item card"
        @click="openConversation(item.id)"
      >
        <image class="conversation-image" :src="getConversationImage(item.listing_image)" mode="aspectFill" />
        <view class="conversation-body">
          <view class="conversation-top">
            <text class="conversation-title">{{ item.listing_title }}</text>
            <text class="conversation-time">{{ formatMessageTime(item.updated_at) }}</text>
          </view>
          <text class="conversation-peer">{{ item.peer_nickname }}</text>
          <view class="conversation-bottom">
            <text class="conversation-message">{{ formatLastMessage(item) }}</text>
            <text v-if="item.unread_count" class="unread-badge">{{ item.unread_count }}</text>
          </view>
        </view>
      </view>
    </view>

    <EmptyState
      v-else
      title="还没有会话"
      description="从商品详情页点击“聊一聊”后，会话会出现在这里。"
      action-text="去首页"
      @action="goHome"
    />

  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '../../components/EmptyState.vue'
import { api } from '../../services/api'
import { ensureSignedIn, getCurrentUser } from '../../services/auth'
import { MODE_MOCK } from '../../utils/constants'
import { useAppState } from '../../utils/app-state'
import { formatMessageTime, resolveImage } from '../../utils/format'

const state = useAppState()
const conversationList = ref([])

const currentUser = computed(() => getCurrentUser())
const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))

function getConversationImage(imageUrl) {
  return resolveImage(imageUrl)
}

async function loadConversations() {
  if (!currentUser.value) {
    conversationList.value = []
    return
  }

  try {
    conversationList.value = await api.conversations.list(currentUser.value.openid)
  } catch (error) {
    uni.showToast({
      title: error.message || '会话加载失败',
      icon: 'none',
    })
  }
}

function openConversation(id) {
  uni.navigateTo({
    url: `/pages/conversations/detail?id=${id}`,
  })
}

function formatLastMessage(conversation) {
  const msg = String(conversation?.last_message || '').trim()
  if (!msg) {
    return '已创建会话，开始聊吧'
  }
  if (msg.includes('[图片]')) {
    return '发送了图片'
  }
  if (msg.includes('[订单]')) {
    return '分享了订单信息'
  }
  if (msg.includes('[位置]')) {
    return '分享了位置'
  }
  if (msg.startsWith('/uploads/') || msg.includes('http')) {
    return '发送了图片'
  }
  return msg.length > 20 ? `${msg.slice(0, 20)}...` : msg
}

function goLogin() {
  ensureSignedIn('/pages/conversations/conversations')
}

function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
  })
}

onLoad(() => {
  loadConversations()
})

onShow(() => {
  loadConversations()
})
</script>

<style scoped lang="scss">
.conversations-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.conversation-item {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
}

.conversation-image {
  flex-shrink: 0;
  width: 132rpx;
  height: 132rpx;
  border-radius: 24rpx;
  background: #f0ede2;
}

.conversation-body {
  flex: 1;
  min-width: 0;
}

.conversation-top,
.conversation-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.conversation-title {
  overflow: hidden;
  color: var(--brand-ink);
  font-size: 30rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-time,
.conversation-peer {
  color: var(--text-tertiary);
  font-size: 22rpx;
}

.conversation-peer {
  display: block;
  margin-top: 10rpx;
}

.conversation-message {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: var(--brand-yellow);
  font-size: 22rpx;
  font-weight: 800;
}
</style>
