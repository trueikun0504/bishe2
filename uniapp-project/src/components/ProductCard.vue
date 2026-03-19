<template>
  <view class="product-card card" @tap="$emit('select', item)">
    <view class="cover-wrap">
      <image class="cover" :src="coverImage" mode="aspectFill" />
      <view class="badge-row">
        <text class="type-badge" :class="item.listing_type === 'wanted' ? 'wanted' : 'sale'">
          {{ item.listing_type === 'wanted' ? '求购' : '在售' }}
        </text>
      </view>
    </view>

    <view class="body">
      <text class="title">{{ item.title }}</text>

      <view class="meta-row">
        <text class="price">
          {{ item.listing_type === 'wanted' ? `预算 ${formatPrice(item.price)}` : formatPrice(item.price) }}
        </text>
        <text class="time">{{ formatRelativeTime(item.created_at) }}</text>
      </view>

      <view class="footer-row">
        <text class="seller">{{ item.seller_nickname || '本地用户' }}</text>
        <text class="district">{{ item.district_name || item.district_code }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { formatPrice, formatRelativeTime, resolveImage } from '../utils/format'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

defineEmits(['select'])

const coverImage = computed(() => resolveImage(props.item.image_urls?.[0]))
</script>

<style scoped lang="scss">
.product-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 2rpx solid transparent;
  border-radius: 24rpx;
  cursor: pointer;
  background: #fff;
  box-sizing: border-box;
}

.product-card:hover {
  border-color: #ff4444;
  box-shadow: 0 12rpx 40rpx rgba(255, 68, 68, 0.25);
  transform: translateY(-6rpx) scale(1.01);
  z-index: 1;
}

.cover-wrap {
  position: relative;
}

.cover {
  width: 100%;
  aspect-ratio: 1 / 1.618;
  background: #f0ede2;
}

.badge-row {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92rpx;
  min-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
}

.type-badge.sale {
  background: rgba(34, 34, 34, 0.82);
}

.type-badge.wanted {
  background: #ff6a2b;
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
}

.title {
  display: -webkit-box;
  overflow: hidden;
  min-height: 88rpx;
  color: var(--brand-ink);
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.meta-row,
.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.price {
  color: var(--accent-price);
  font-size: 36rpx;
  font-weight: 800;
}

.time,
.seller,
.district {
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.seller {
  overflow: hidden;
  max-width: 200rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
