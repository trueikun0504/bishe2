<template>
  <view class="bottom-nav">
    <view
      v-for="item in items"
      :key="item.key"
      :class="['nav-item', { active: current === item.key }]"
      @click="navigate(item)"
    >
      <text class="nav-label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  current: {
    type: String,
    default: 'home',
  },
})

const items = [
  { key: 'home', label: '首页', url: '/pages/index/index' },
  { key: 'categories', label: '分类', url: '/pages/categories/index' },
  { key: 'publish', label: '发布', url: '/pages/publish/publish' },
  { key: 'messages', label: '消息', url: '/pages/conversations/conversations' },
  { key: 'profile', label: '我的', url: '/pages/profile/index' },
]

function navigate(item) {
  if (item.key === props.current) {
    return
  }

  uni.switchTab({
    url: item.url,
  })
}
</script>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  right: 18rpx;
  bottom: 0;
  left: 18rpx;
  display: flex;
  gap: 12rpx;
  padding: 14rpx;
  padding-bottom: calc(14rpx + env(safe-area-inset-bottom));
  border: 1rpx solid rgba(34, 34, 34, 0.04);
  border-radius: 36rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18rpx 48rpx rgba(34, 34, 34, 0.12);
  backdrop-filter: blur(10px);
  z-index: 30;
}

.nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82rpx;
  border-radius: 24rpx;
  color: var(--text-tertiary);
}

.nav-item.active {
  background: var(--brand-yellow);
  color: var(--brand-ink);
}

.nav-label {
  font-size: 26rpx;
  font-weight: 700;
}
</style>

