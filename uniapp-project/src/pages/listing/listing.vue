<template>
  <view class="listing-page">
    <view v-if="loading" class="body-card card loading-card">
      <text class="loading-text">正在加载商品详情...</text>
    </view>

    <view v-else-if="detail" class="detail-layout">
      <view class="hero card">
        <view class="hero-top">
          <view class="back-chip" @click="goBack">
            <text>返回</text>
          </view>
          <view class="hero-top-right">
            <text class="gallery-counter">{{ activeImageDisplay }}</text>
            <text class="status-badge">{{ modeLabel }}</text>
          </view>
        </view>

        <view class="gallery-shell">
          <scroll-view
            v-if="detail.image_urls?.length > 1"
            class="thumb-strip"
            scroll-y
            show-scrollbar="false"
          >
            <view class="thumb-list">
              <view
                v-for="(image, index) in detail.image_urls"
                :key="`thumb-${detail.id}-${index}`"
                :class="['thumb-item', { active: index === activeImageIndex }]"
                @click="setActiveImage(index)"
              >
                <image class="thumb-image" :src="getListingImage(image)" mode="aspectFill" />
                <view class="thumb-mask">
                  <text class="thumb-index">{{ index + 1 }}</text>
                </view>
              </view>
            </view>
          </scroll-view>

          <swiper
            v-if="detail.image_urls?.length"
            class="gallery"
            circular
            :current="activeImageIndex"
            @change="handleGalleryChange"
          >
            <swiper-item
              v-for="(image, index) in detail.image_urls"
              :key="`${detail.id}-${index}`"
            >
              <view class="gallery-stage" @click="previewImage(index)">
                <image
                  class="gallery-image"
                  :src="getListingImage(image)"
                  mode="widthFix"
                />
              </view>
            </swiper-item>
          </swiper>

          <view v-else class="gallery gallery-empty">
            <image class="gallery-image" src="/static/logo.png" mode="aspectFit" />
          </view>
        </view>

        <view class="gallery-footer">
          <text class="gallery-hint">点击图片放大查看</text>
          <text class="gallery-tip">担保交易 区县见面 先聊后买</text>
        </view>
      </view>

      <view class="content">
        <view class="body-card card">
          <view class="badge-line">
            <text class="type-badge" :class="detail.listing_type === 'wanted' ? 'wanted' : 'sale'">
              {{ detail.listing_type === 'wanted' ? '求购' : '在售' }}
            </text>
            <text class="meta-text">{{ detail.district_name }}</text>
          </view>

          <view class="headline-row">
            <text class="title">{{ detail.title }}</text>
            <text class="price">{{ priceText }}</text>
          </view>

          <view class="meta-grid">
            <text class="meta-text">{{ formatFullTime(detail.created_at) }}</text>
            <text class="meta-text">
              {{ detail.listing_type === 'wanted' ? '发布求购者' : '发布卖家' }}：{{ detail.seller_nickname }}
            </text>
          </view>

          <text class="description">{{ detail.description }}</text>
        </view>

        <view class="seller-card card">
          <text class="seller-title">{{ detail.listing_type === 'wanted' ? '需求说明' : '交易提示' }}</text>
          <text class="seller-name">
            {{ detail.listing_type === 'wanted' ? '先确认成色、价格和见面地点' : detail.seller_nickname }}
          </text>
          <text class="seller-tip">
            {{ detail.listing_type === 'wanted'
              ? '如果你手里有对应商品，可以直接发送图片、截图或型号信息。'
              : '先聊清楚配件、验货方式和面交时间，再决定是否成交。' }}
          </text>
        </view>
      </view>
    </view>

    <view class="cta-bar">
      <view class="cta-meta">
        <text class="cta-price">{{ detail ? priceText : '--' }}</text>
        <text class="cta-text">{{ ctaHint }}</text>
      </view>
      <view class="cta-button" @click="startConversation">
        <text>{{ ctaButtonText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { ensureSignedIn } from '../../services/auth'
import { MODE_MOCK } from '../../utils/constants'
import { useAppState } from '../../utils/app-state'
import { formatFullTime, formatPrice, resolveImage } from '../../utils/format'

const state = useAppState()
const loading = ref(true)
const listingId = ref('')
const detail = ref(null)
const activeImageIndex = ref(0)

const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))
const activeImageDisplay = computed(() => {
  const total = detail.value?.image_urls?.length || 0
  return total ? `${activeImageIndex.value + 1} / ${total}` : '0 / 0'
})
const priceText = computed(() => {
  if (!detail.value) {
    return '--'
  }

  return detail.value.listing_type === 'wanted'
    ? `预算 ${formatPrice(detail.value.price)}`
    : formatPrice(detail.value.price)
})
const ctaButtonText = computed(() => {
  return detail.value?.listing_type === 'wanted' ? '我有货源' : '聊一聊'
})
const ctaHint = computed(() => {
  return detail.value?.listing_type === 'wanted'
    ? '先发图和报价，再约线下面交'
    : '先沟通，再决定是否面交'
})

function getListingImage(url) {
  return resolveImage(url)
}

async function loadDetail() {
  if (!listingId.value) {
    return
  }

  loading.value = true
  try {
    detail.value = await api.listings.getDetail(listingId.value)
    activeImageIndex.value = 0
  } catch (error) {
    uni.showToast({
      title: error.message || '详情加载失败',
      icon: 'none',
    })
  } finally {
    loading.value = false
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }

  uni.switchTab({
    url: '/pages/index/index',
  })
}

function previewImage(index) {
  if (!detail.value?.image_urls?.length) {
    return
  }

  const fullUrls = detail.value.image_urls.map(url => resolveImage(url))
  uni.previewImage({
    current: index,
    urls: fullUrls,
  })
}

function setActiveImage(index) {
  activeImageIndex.value = index
}

function handleGalleryChange(event) {
  activeImageIndex.value = Number(event?.detail?.current || 0)
}

async function startConversation() {
  if (!detail.value) {
    return
  }

  const user = ensureSignedIn(`/pages/listing/listing?id=${listingId.value}`)
  if (!user) {
    return
  }

  if (user.openid === detail.value.openid) {
    uni.showToast({
      title: '这是你自己发布的商品',
      icon: 'none',
    })
    return
  }

  const buyerOpenid = detail.value.listing_type === 'wanted' ? detail.value.openid : user.openid
  const sellerOpenid = detail.value.listing_type === 'wanted' ? user.openid : detail.value.openid

  try {
    const conversation = await api.conversations.createOrGet(
      detail.value.id,
      buyerOpenid,
      sellerOpenid,
    )

    uni.navigateTo({
      url: `/pages/conversations/detail?id=${conversation.id}`,
    })
  } catch (error) {
    uni.showToast({
      title: error.message || '创建会话失败',
      icon: 'none',
    })
  }
}

onLoad((options) => {
  listingId.value = options.id || ''
  loadDetail()
})
</script>

<style scoped lang="scss">
.listing-page {
  min-height: 100vh;
  padding-bottom: calc(144rpx + env(safe-area-inset-bottom));
  background: var(--page-bg);
}

.loading-card {
  margin: 24rpx;
}

.detail-layout {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 24rpx;
}

.hero {
  padding: 24rpx;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.hero-top-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
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

.gallery-shell {
  display: flex;
  gap: 18rpx;
  align-items: flex-start;
}

.gallery {
  flex: 1;
  min-width: 0;
  min-height: 760rpx;
  overflow: hidden;
  border-radius: 28rpx;
  background: #f6f1e4;
  box-sizing: border-box;
}

.gallery-stage,
.gallery-empty {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: linear-gradient(180deg, #f5efe1 0%, #efe7d3 100%);
}

.gallery-image {
  display: block;
  width: 100%;
  max-width: none;
}

.thumb-strip {
  flex: 0 0 120rpx;
  max-height: 760rpx;
}

.thumb-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.thumb-item {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  overflow: hidden;
  border: 3rpx solid transparent;
  border-radius: 18rpx;
  background: #efe7d3;
  opacity: 0.78;
}

.thumb-item.active {
  border-color: var(--brand-yellow);
  opacity: 1;
  transform: translateY(-4rpx);
  box-shadow: 0 14rpx 32rpx rgba(34, 34, 34, 0.12);
}

.thumb-image {
  width: 100%;
  height: 100%;
}

.thumb-mask {
  position: absolute;
  right: 10rpx;
  bottom: 10rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.64);
}

.thumb-index {
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}

.gallery-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 16rpx;
}

.gallery-counter,
.gallery-hint,
.gallery-tip {
  font-size: 22rpx;
}

.gallery-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 104rpx;
  height: 50rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.08);
  color: var(--brand-ink);
  font-weight: 700;
}

.gallery-hint,
.gallery-tip,
.meta-text,
.seller-tip,
.loading-text,
.cta-text {
  color: var(--text-tertiary);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.body-card,
.seller-card {
  padding: 28rpx;
}

.badge-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 108rpx;
  height: 46rpx;
  padding: 0 18rpx;
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

.headline-row {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.title {
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1.25;
}

.price,
.cta-price {
  color: var(--accent-price);
  font-size: 44rpx;
  font-weight: 900;
}

.meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 20rpx;
}

.meta-text,
.seller-tip,
.loading-text,
.cta-text {
  font-size: 24rpx;
}

.description {
  display: block;
  margin-top: 26rpx;
  color: var(--text-secondary);
  font-size: 28rpx;
  line-height: 1.8;
}

.seller-title {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.seller-name {
  display: block;
  margin-top: 12rpx;
  font-size: 34rpx;
  font-weight: 700;
}

.cta-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -18rpx 40rpx rgba(34, 34, 34, 0.08);
}

.cta-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.cta-button {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 240rpx;
  height: 92rpx;
  border-radius: 999rpx;
  background: var(--brand-yellow);
  font-size: 30rpx;
  font-weight: 800;
}

@media (min-width: 960px) {
  .detail-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.32fr) minmax(380px, 0.68fr);
    align-items: start;
    gap: 24rpx;
  }

  .hero {
    position: sticky;
    top: 24rpx;
    padding: 28rpx;
  }

  .gallery {
    min-height: 980rpx;
  }

  .thumb-strip {
    flex-basis: 132rpx;
    max-height: 980rpx;
  }

  .thumb-item {
    width: 132rpx;
    height: 132rpx;
  }
}
</style>
