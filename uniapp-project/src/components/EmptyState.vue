<template>
  <view class="empty card">
    <text class="empty-title">{{ title }}</text>
    <text class="empty-text">{{ description }}</text>
    <view v-if="actionText" class="empty-action" @click="$emit('action')">
      <text>{{ actionText }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '这里还没有内容',
  },
  description: {
    type: String,
    default: '先去逛逛，或者切换筛选条件试试。',
  },
  actionText: {
    type: String,
    default: '',
  },
})

defineEmits(['action'])
</script>

<style scoped lang="scss">
.empty {
  padding: 44rpx 30rpx;
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
}

.empty-text {
  display: block;
  margin-top: 14rpx;
  color: var(--text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.empty-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180rpx;
  height: 76rpx;
  margin-top: 24rpx;
  padding: 0 26rpx;
  border-radius: 999rpx;
  background: var(--brand-yellow);
  font-size: 26rpx;
  font-weight: 700;
}
</style>
