<template>
  <view class="detail-page">
    <view class="detail-head">
      <view class="back-chip" @click="goBack">
        <text>返回</text>
      </view>
      <text class="status-badge">{{ modeLabel }}</text>
    </view>

    <view v-if="conversation" class="listing-card card" @click="openListing">
      <image
        class="listing-cover"
        :src="conversation.listing.image_urls?.[0] || '/static/logo.png'"
        mode="aspectFill"
      />
      <view class="listing-body">
        <text class="listing-title">{{ conversation.listing.title }}</text>
        <text class="listing-price">{{ formatPrice(conversation.listing.price) }}</text>
      </view>
    </view>

    <scroll-view
      class="messages-panel"
      scroll-y
      :scroll-into-view="scrollIntoViewId"
    >
      <view
        v-for="message in messages"
        :id="`msg-${message.id}`"
        :key="message.id"
        :class="['message-row', { mine: currentUser && message.sender_openid === currentUser.openid }]"
      >
        <view class="bubble">
          <!-- 文本消息 -->
          <text v-if="message.message_type === 'text'" class="bubble-text">
            {{ message.content }}
          </text>

          <!-- 图片消息 -->
          <view v-else-if="message.message_type === 'image'" class="image-message">
            <image
              :src="message.image_url || message.content"
              mode="aspectFill"
              class="message-image"
              @click="previewImage(message.image_url || message.content)"
            />
            <text v-if="message.content && message.content !== message.image_url" class="image-text">
              {{ message.content }}
            </text>
          </view>

          <!-- 截图消息 -->
          <view v-else-if="message.message_type === 'screenshot'" class="screenshot-message">
            <text class="message-icon">📸</text>
            <image
              :src="message.image_url || message.content"
              mode="aspectFill"
              class="message-image"
              @click="previewImage(message.image_url || message.content)"
            />
            <text class="screenshot-label">截图</text>
          </view>

          <!-- 位置消息 -->
          <view v-else-if="message.message_type === 'location'" class="location-message">
            <view class="location-info">
              <text class="location-title">📍 {{ message.payload?.title || '分享了位置' }}</text>
              <text class="location-address">{{ message.payload?.address || '地址未知' }}</text>
              <text class="location-coords">
                坐标: {{ message.payload?.latitude?.toFixed(4) }}, {{ message.payload?.longitude?.toFixed(4) }}
              </text>
            </view>
          </view>

          <!-- 订单消息 -->
          <view v-else-if="message.message_type === 'order'" class="order-message">
            <view class="order-header">
              <text class="order-icon">💳</text>
              <text class="order-title">订单信息</text>
            </view>
            <view class="order-body">
              <view class="order-row">
                <text class="order-label">商品:</text>
                <text class="order-value">{{ message.payload?.title || '未知商品' }}</text>
              </view>
              <view class="order-row">
                <text class="order-label">价格:</text>
                <text class="order-price">¥{{ formatPrice(message.payload?.price || 0) }}</text>
              </view>
              <view class="order-row">
                <text class="order-label">状态:</text>
                <text class="order-status">{{ formatOrderStatus(message.payload?.status) }}</text>
              </view>
            </view>
          </view>

          <!-- 默认 fallback -->
          <text v-else class="bubble-text">
            [{{ message.message_type }}] {{ message.content }}
          </text>

          <!-- 时间戳 -->
          <text class="bubble-time">{{ formatMessageTime(message.created_at) }}</text>

          <!-- 消息状态（仅为自己的消息显示） -->
          <text v-if="currentUser && message.sender_openid === currentUser.openid" class="message-status">
            {{ getMessageStatusIcon(message.status) }}
          </text>
        </view>
      </view>
    </scroll-view>

    <view class="composer">
      <view class="composer-actions">
        <view class="action-button" @click="chooseImage">
          <text>📷</text>
        </view>
      </view>
      <input
        v-model="inputValue"
        class="composer-input"
        confirm-type="send"
        maxlength="200"
        placeholder="输入你想说的话"
        @confirm="send"
      />
      <view class="composer-button" @click="send">
        <text>{{ sending ? '发送中' : '发送' }}</text>
      </view>
    </view>

    <!-- 上传进度条 -->
    <view v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
      <view class="progress-bar" :style="{ width: uploadProgress + '%' }"></view>
      <text class="progress-text">上传中 {{ uploadProgress }}%</text>
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { ensureSignedIn, getCurrentUser } from '../../services/auth'
import { uploadFiles } from '../../utils/cloudbase'
import { MODE_MOCK } from '../../utils/constants'
import { useAppState } from '../../utils/app-state'
import { formatMessageTime, formatPrice } from '../../utils/format'

const state = useAppState()
const conversationId = ref('')
const conversation = ref(null)
const messages = ref([])
const inputValue = ref('')
const sending = ref(false)
const scrollIntoViewId = ref('')
const uploadProgress = ref(0)

let pollTimer = null

const currentUser = computed(() => getCurrentUser())
const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))

async function refreshConversation() {
  if (!conversationId.value) {
    return
  }

  try {
    conversation.value = await api.conversations.getDetail(conversationId.value)
    await api.conversations.markRead(conversationId.value)
    messages.value = await api.messages.list(conversationId.value)

    await nextTick()
    const lastMessage = messages.value[messages.value.length - 1]
    scrollIntoViewId.value = lastMessage ? `msg-${lastMessage.id}` : ''
  } catch (error) {
    uni.showToast({
      title: error.message || '会话加载失败',
      icon: 'none',
    })
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    refreshConversation()
  }, 10000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }

  uni.reLaunch({
    url: '/pages/conversations/conversations',
  })
}

function openListing() {
  if (!conversation.value?.listing?.id) {
    return
  }

  uni.navigateTo({
    url: `/pages/listing/listing?id=${conversation.value.listing.id}`,
  })
}

async function send() {
  const user = ensureSignedIn(`/pages/conversations/detail?id=${conversationId.value}`)
  if (!user) {
    return
  }

  if (!inputValue.value.trim()) {
    return
  }

  sending.value = true
  try {
    await api.messages.send(conversationId.value, inputValue.value, user.openid)
    inputValue.value = ''
    await refreshConversation()
  } catch (error) {
    uni.showToast({
      title: error.message || '发送失败',
      icon: 'none',
    })
  } finally {
    sending.value = false
  }
}

function previewImage(imageUrl) {
  if (!imageUrl) {
    return
  }
  uni.previewImage({
    urls: [imageUrl],
  })
}

function formatOrderStatus(status) {
  const statusMap = {
    'pending': '待发货',
    'paid': '已支付',
    'completed': '已完成',
    'cancelled': '已取消',
  }
  return statusMap[status] || status || '未知'
}

async function chooseImage() {
  const user = ensureSignedIn(`/pages/conversations/detail?id=${conversationId.value}`)
  if (!user) {
    return
  }

  try {
    const res = await uni.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
    })

    const tempFilePath = res.tempFilePaths[0]
    if (!tempFilePath) {
      return
    }

    // 显示加载提示
    uni.showLoading({
      title: '上传图片中...',
      mask: true,
    })

    uploadProgress.value = 0

    uploadProgress.value = 35

    const uploadResults = await uploadFiles([tempFilePath])
    const imageUrl = uploadResults[0]

    if (!imageUrl) {
      throw new Error('上传失败')
    }

    uploadProgress.value = 100

    // 发送图片消息
    await api.messages.send(
      conversationId.value,
      imageUrl,
      user.openid,
      'image',
      imageUrl
    )

    uploadProgress.value = 0
    await refreshConversation()

    uni.hideLoading()
    uni.showToast({
      title: '图片已发送',
      icon: 'success',
    })
  } catch (error) {
    uploadProgress.value = 0
    uni.hideLoading()
    uni.showToast({
      title: error.message || '上传失败',
      icon: 'none',
    })
  }
}

function getMessageStatusIcon(status) {
  // 消息状态图标
  // sent: ✓（已发送）
  // received: ✓✓（已接收）
  // read: ✓✓（已读蓝色）
  switch (status) {
    case 'read':
      return '✓✓'
    case 'received':
      return '✓✓'
    default:
      return '✓'
  }
}

onLoad((options) => {
  conversationId.value = options.id || ''
  refreshConversation()
  startPolling()
})

onShow(() => {
  if (conversationId.value) {
    startPolling()
  }
})

onHide(() => {
  stopPolling()
})

onUnload(() => {
  stopPolling()
})
</script>

<style scoped lang="scss">
.detail-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 24rpx;
  padding-bottom: calc(156rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  gap: 18rpx;
  background: var(--page-bg);
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.listing-card {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
}

.listing-cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: #f0ede2;
}

.listing-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10rpx;
}

.listing-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 28rpx;
  font-weight: 700;
}

.listing-price {
  color: var(--accent-price);
  font-size: 30rpx;
  font-weight: 800;
}

.messages-panel {
  flex: 1;
  min-height: 0;
}

.message-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 18rpx;
}

.message-row.mine {
  justify-content: flex-end;
}

.bubble {
  display: inline-flex;
  flex-direction: column;
  gap: 10rpx;
  max-width: 76%;
  padding: 22rpx;
  border-radius: 24rpx 24rpx 24rpx 8rpx;
  background: #ffffff;
  position: relative;
}

.message-row.mine .bubble {
  border-radius: 24rpx 24rpx 8rpx 24rpx;
  background: #fff5b2;
}

.message-status {
  position: absolute;
  right: -30rpx;
  bottom: 8rpx;
  font-size: 20rpx;
  color: var(--brand-yellow);
}

.bubble-text {
  color: var(--brand-ink);
  font-size: 28rpx;
  line-height: 1.5;
}

/* 图片消息 */
.image-message {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.message-image {
  width: 280rpx;
  height: 280rpx;
  border-radius: 12rpx;
  object-fit: cover;
}

.image-text {
  color: var(--brand-ink);
  font-size: 26rpx;
  line-height: 1.4;
}

/* 截图消息 */
.screenshot-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.message-icon {
  font-size: 36rpx;
}

.screenshot-label {
  color: var(--text-secondary);
  font-size: 24rpx;
}

/* 位置消息 */
.location-message {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.location-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: rgba(255, 235, 130, 0.2);
  border: 1rpx solid rgba(255, 235, 130, 0.5);
}

.location-title {
  color: var(--brand-ink);
  font-size: 26rpx;
  font-weight: 700;
}

.location-address {
  color: var(--text-secondary);
  font-size: 24rpx;
}

.location-coords {
  color: var(--text-tertiary);
  font-size: 22rpx;
  font-family: monospace;
}

/* 订单消息 */
.order-message {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.order-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 16rpx;
  background: linear-gradient(135deg, #fff5b2 0%, #ffe580 100%);
  border-radius: 12rpx 12rpx 0 0;
  border-bottom: 2rpx solid rgba(34, 34, 34, 0.1);
}

.order-icon {
  font-size: 32rpx;
}

.order-title {
  color: var(--brand-ink);
  font-size: 26rpx;
  font-weight: 700;
}

.order-body {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 16rpx;
  background: rgba(255, 235, 130, 0.1);
  border-radius: 0 0 12rpx 12rpx;
}

.order-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.order-label {
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 600;
  min-width: 80rpx;
}

.order-value {
  color: var(--brand-ink);
  font-size: 24rpx;
  flex: 1;
  text-align: right;
}

.order-price {
  color: var(--accent-price);
  font-size: 26rpx;
  font-weight: 800;
  flex: 1;
  text-align: right;
}

.order-status {
  color: #f5a623;
  font-size: 24rpx;
  font-weight: 600;
  flex: 1;
  text-align: right;
}

.bubble-time {
  align-self: flex-end;
  color: var(--text-tertiary);
  font-size: 20rpx;
}

.composer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  gap: 14rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -16rpx 32rpx rgba(34, 34, 34, 0.08);
}

.composer-actions {
  display: flex;
  gap: 12rpx;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border-radius: 999rpx;
  background: #f0ede2;
  font-size: 40rpx;
}

.action-button:active {
  background: #e8e3d6;
}

.composer-input {
  flex: 1;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #f8f5eb;
  font-size: 26rpx;
}

.composer-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140rpx;
  height: 88rpx;
  border-radius: 999rpx;
  background: var(--brand-yellow);
  font-size: 28rpx;
  font-weight: 800;
}

/* 上传进度条 */
.upload-progress {
  position: fixed;
  right: 0;
  bottom: calc(156rpx + env(safe-area-inset-bottom));
  left: 0;
  height: 4rpx;
  background: #f0ede2;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ffed4e);
  transition: width 0.2s ease;
}

.progress-text {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 22rpx;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.95);
  padding: 0 12rpx;
}
</style>
