<template>
  <view class="top-search card">
    <view class="title-row">
      <view>
        <text class="headline">本地闲置</text>
        <text class="subline">先看本区县，再决定聊不聊、见不见</text>
      </view>
      <text class="mode-chip">{{ modeLabel }}</text>
    </view>

    <view class="search-row">
      <view class="district-pill" @click="$emit('select-district')">
        <text>{{ districtLabel }}</text>
      </view>
      <input
        class="search-input"
        confirm-type="search"
        :value="modelValue"
        placeholder="搜手机、书桌、自行车、求购需求"
        @input="onInput"
        @confirm="$emit('search')"
      />
      <view class="search-action" @click="$emit('search')">
        <text>搜索</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
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

function onInput(event) {
  emit('update:modelValue', event.detail.value)
}
</script>

<style scoped lang="scss">
.top-search {
  padding: 26rpx;
  background: linear-gradient(135deg, #ffe000 0%, #ffd44d 100%);
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.headline {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.1;
}

.subline {
  display: block;
  margin-top: 10rpx;
  color: rgba(34, 34, 34, 0.72);
  font-size: 22rpx;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.34);
  font-size: 22rpx;
  font-weight: 700;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
  padding: 10rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.72);
}

.district-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120rpx;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 22rpx;
  background: rgba(34, 34, 34, 0.08);
  font-size: 24rpx;
  font-weight: 700;
}

.search-input {
  flex: 1;
  height: 72rpx;
  padding: 0 8rpx;
  color: var(--brand-ink);
  font-size: 26rpx;
}

.search-action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 110rpx;
  height: 72rpx;
  border-radius: 22rpx;
  background: var(--brand-ink);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}
</style>
