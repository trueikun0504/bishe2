<template>
  <view class="page-shell conversations-page">
    <view class="page-head">
      <view>
        <text class="page-title">娑堟伅</text>
        <text class="page-subtitle">浼氳瘽鎸夋渶杩戞秷鎭帓搴忥紝鐐硅繘鏉ョ户缁亰銆?/text>
      </view>
      <text class="status-badge">{{ modeLabel }}</text>
    </view>

    <EmptyState
      v-if="!currentUser"
      title="鍏堢櫥褰曞啀鐪嬫秷鎭?
      description="娑堟伅鍜屽彂甯冮兘渚濊禆鍚屼竴涓祴璇?openid锛岀櫥褰曞悗鎵嶈兘璇诲啓 conversations / messages銆?
      action-text="鍘荤櫥褰?
      @action="goLogin"
    />

    <view v-else-if="conversationList.length" class="conversation-list">
      <view
        v-for="item in conversationList"
        :key="item.id"
        class="conversation-item card"
        @click="openConversation(item.id)"
      >
        <image class="conversation-image" :src="item.listing_image" mode="aspectFill" />
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
      title="杩樻病鏈変細璇?
      description="浠庡晢鍝佽鎯呴〉鐐瑰嚮鈥滆亰涓€鑱娾€濆悗锛屼細璇濅細鍑虹幇鍦ㄨ繖閲屻€?
      action-text="鍘婚€涢椤?
      @action="goHome"
    />

    <BottomNav current="messages" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import EmptyState from '../../components/EmptyState.vue'
import { api } from '../../services/api'
import { ensureSignedIn, getCurrentUser } from '../../services/auth'
import { MODE_MOCK } from '../../utils/constants'
import { useAppState } from '../../utils/app-state'
import { formatMessageTime } from '../../utils/format'

const state = useAppState()
const conversationList = ref([])

const currentUser = computed(() => getCurrentUser())
const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))

async function loadConversations() {
  if (!currentUser.value) {
    conversationList.value = []
    return
  }

  try {
    conversationList.value = await api.conversations.list(currentUser.value.openid)
  } catch (error) {
    uni.showToast({
      title: error.message || '浼氳瘽鍔犺浇澶辫触',
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
  if (!conversation.last_message) {
    return '宸插垱寤轰細璇濓紝寮€濮嬭亰鍚?
  }

  const msg = conversation.last_message
  
  // 妫€鏌ユ槸鍚﹀寘鍚秷鎭被鍨嬫寚绀?  if (msg.includes('[鍥剧墖]')) {
    return '鍙戦€佷簡鍥剧墖'
  }
  if (msg.includes('[璁㈠崟]')) {
    return '鍒嗕韩浜嗚鍗曚俊鎭?
  }
  if (msg.includes('[浣嶇疆]')) {
    return '鍒嗕韩浜嗕綅缃?
  }
  if (msg.includes('[鎴浘]')) {
    return '鍙戦€佷簡鎴浘'
  }
  
  // 妫€鏌ユ槸鍚︽槸URL锛堝浘鐗囷級
  if (msg.startsWith('/uploads/') || msg.includes('http')) {
    return '鍙戦€佷簡鍥剧墖'
  }
  
  // 榛樿鏄剧ず鍘熷娑堟伅锛堟埅鏂埌20涓瓧绗︼級
  return msg.length > 20 ? msg.substring(0, 20) + '...' : msg
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

