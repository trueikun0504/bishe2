<template>
  <view class="glass-nav-shell" :style="shellStyle">
    <view class="glass-nav-spacer" :style="{ height: `${safeTopInset}rpx` }"></view>

    <view class="glass-nav" :class="{ 'glass-nav--blur': supportsBackdropBlur }" :style="navStyle">
      <view class="glass-nav__title-row">
        <view class="glass-nav__copy">
          <text class="glass-nav__headline">本地闲置</text>
          <text class="glass-nav__subline">先看本区县，再决定聊不聊、见不见</text>
        </view>
        <text class="glass-nav__mode-chip">{{ modeLabel }}</text>
      </view>

      <view class="glass-nav__search-row">
        <view class="district-pill" hover-class="pressable-hover" hover-stay-time="80" @tap="$emit('select-district')">
          <text class="district-pill__text">{{ districtLabel }}</text>
        </view>
        <input
          class="search-input"
          confirm-type="search"
          :value="modelValue"
          placeholder="搜手机、书桌、自行车、求购需求..."
          @input="onInput"
          @confirm="$emit('search')"
        />
        <view class="search-action" hover-class="pressable-hover-dark" hover-stay-time="80" @tap="$emit('search')">
          <text>搜索</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  districtLabel: {
    type: String,
    default: '选择区县',
  },
  modelValue: {
    type: String,
    default: '',
  },
  modeLabel: {
    type: String,
    default: 'Mock',
  },
})

const emit = defineEmits(['search', 'select-district', 'update:modelValue'])

const statusBarHeight = ref(20)
const capsuleHeight = ref(64)
const capsuleBottom = ref(56)
const supportsBackdropBlur = ref(false)

function pxToRpx(px) {
  const width = Number(uni.getSystemInfoSync?.().windowWidth || 375)
  return Math.round((Number(px || 0) * 750) / width)
}

function initInsets() {
  const systemInfo = uni.getSystemInfoSync ? uni.getSystemInfoSync() : {}
  statusBarHeight.value = Number(systemInfo.statusBarHeight || 20)
  supportsBackdropBlur.value = false

  // #ifdef H5
  supportsBackdropBlur.value =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    (CSS.supports('backdrop-filter', 'blur(20px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(20px)'))
  // #endif

  // #ifdef APP-PLUS
  supportsBackdropBlur.value = true
  // #endif

  // #ifdef MP-WEIXIN
  const menuButton = typeof uni.getMenuButtonBoundingClientRect === 'function'
    ? uni.getMenuButtonBoundingClientRect()
    : null
  if (menuButton && menuButton.height) {
    capsuleHeight.value = pxToRpx(menuButton.height)
    capsuleBottom.value = pxToRpx(menuButton.bottom)
  } else {
    capsuleHeight.value = 64
    capsuleBottom.value = pxToRpx(statusBarHeight.value) + 44
  }
  // #endif

  // #ifndef MP-WEIXIN
  capsuleHeight.value = 72
  capsuleBottom.value = pxToRpx(statusBarHeight.value) + 44
  // #endif
}

initInsets()

const safeTopInset = computed(() => {
  const top = pxToRpx(statusBarHeight.value)
  const capsuleBottomValue = Number(capsuleBottom.value || 0)
  return Math.max(top + 16, capsuleBottomValue + 12)
})

const shellStyle = computed(() => ({
  paddingTop: '0rpx',
}))

const navStyle = computed(() => ({
  backgroundColor: supportsBackdropBlur.value ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.95)',
}))

function onInput(event) {
  emit('update:modelValue', event.detail.value)
}
</script>

<style scoped lang="scss">
.glass-nav-shell {
  position: sticky;
  top: 0;
  z-index: 999;
  margin: 0 -24rpx;
  padding: 0 24rpx 8rpx;
}

.glass-nav-spacer {
  width: 100%;
}

.glass-nav {
  padding: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 0 0 36rpx 36rpx;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.08);
}

.glass-nav--blur {
  /* #ifdef H5 */
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  /* #endif */

  /* #ifdef APP-PLUS */
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  /* #endif */
}

.glass-nav__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.glass-nav__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.glass-nav__headline {
  display: block;
  color: var(--brand-ink);
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.1;
}

.glass-nav__subline {
  display: block;
  margin-top: 10rpx;
  color: rgba(34, 34, 34, 0.68);
  font-size: 24rpx;
  line-height: 1.5;
}

.glass-nav__mode-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.72);
  color: var(--brand-ink);
  font-size: 22rpx;
  font-weight: 700;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.glass-nav__search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
  padding: 14rpx;
  border-radius: var(--border-radius-xl);
  background: rgba(255, 255, 255, 0.68);
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.56);
}

.district-pill,
.search-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  border-radius: var(--border-radius-lg);
  transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
}

.district-pill {
  flex-shrink: 0;
  min-width: 168rpx;
  padding: 0 24rpx;
  background: rgba(255, 248, 214, 0.95);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.district-pill__text {
  overflow: hidden;
  max-width: 180rpx;
  color: var(--brand-ink);
  font-size: 24rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-input {
  flex: 1;
  min-width: 0;
  min-height: 88rpx;
  padding: 0 8rpx;
  color: var(--brand-ink);
  font-size: 28rpx;
  line-height: 40rpx;
}

.search-action {
  flex-shrink: 0;
  min-width: 132rpx;
  padding: 0 28rpx;
  background: rgba(34, 34, 34, 0.92);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.16);
}

.pressable-hover {
  transform: translateY(-4rpx) scale(0.99);
  box-shadow: 0 10rpx 24rpx rgba(0, 0, 0, 0.1);
}

.pressable-hover-dark {
  transform: translateY(-4rpx) scale(0.99);
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.22);
}

/* #ifdef H5 */
.district-pill:hover,
.search-action:hover {
  transform: translateY(-4rpx);
}

.district-pill:hover {
  box-shadow: 0 10rpx 24rpx rgba(0, 0, 0, 0.1);
}

.search-action:hover {
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.22);
}
/* #endif */
</style>
