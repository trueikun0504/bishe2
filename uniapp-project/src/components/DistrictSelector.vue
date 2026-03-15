<template>
  <view v-if="visible" class="selector-root">
    <view class="mask" @click="$emit('close')" />
    <view class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">{{ title }}</text>
        <text class="sheet-close" @click="$emit('close')">关闭</text>
      </view>
      <scroll-view scroll-y class="district-list">
        <view
          v-for="district in districts"
          :key="district.code"
          :class="['district-item', { active: currentCode === district.code }]"
          @click="$emit('select', district.code)"
        >
          <view>
            <text class="district-name">{{ district.name }}</text>
            <text class="district-city">{{ district.city_name }}</text>
          </view>
          <text v-if="currentCode === district.code" class="district-check">已选</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  currentCode: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '选择区县',
  },
  districts: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['close', 'select'])
</script>

<style scoped lang="scss">
.selector-root {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.mask {
  position: absolute;
  inset: 0;
  background: var(--mask-bg);
}

.sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  padding: 30rpx 24rpx 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  border-radius: 36rpx 36rpx 0 0;
  background: #fffdf7;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.sheet-title {
  font-size: 34rpx;
  font-weight: 800;
}

.sheet-close {
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.district-list {
  flex: 1;
}

.district-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #f8f5eb;
}

.district-item.active {
  background: #fff2a8;
}

.district-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
}

.district-city {
  display: block;
  margin-top: 8rpx;
  color: var(--text-tertiary);
  font-size: 22rpx;
}

.district-check {
  color: var(--brand-ink);
  font-size: 24rpx;
  font-weight: 700;
}
</style>
