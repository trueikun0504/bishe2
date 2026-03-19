<template>
  <view class="page-shell favorites-page">
    <view class="page-header">
      <text class="page-title">我的收藏</text>
      <text class="page-subtitle">和 Web 端保持同一份收藏列表，点开即可继续联系卖家</text>
    </view>

    <EmptyState
      v-if="!currentUser"
      title="先登录再看收藏"
      description="收藏列表跟账号绑定，登录后才能读取和 Web 端一致的数据。"
      action-text="去登录"
      @action="goLogin"
    />

    <view v-else-if="loading" class="loading-section">
      <text class="loading-text">正在加载收藏...</text>
    </view>

    <view v-else-if="errorText" class="error-section">
      <text class="error-text">{{ errorText }}</text>
      <button class="btn-retry" @tap="loadFavorites">重试</button>
    </view>

    <view v-else-if="listings.length" class="grid">
      <ProductCard
        v-for="item in listings"
        :key="item.id || item._id"
        class="grid-item"
        :item="item"
        @select="openListing"
      />
    </view>

    <EmptyState
      v-else
      title="你还没有收藏商品"
      description="去首页逛逛，点一下详情页里的收藏，这里会和 Web 端同步出现记录。"
      action-text="去首页"
      @action="goHome"
    />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import ProductCard from '../../components/ProductCard.vue'
import EmptyState from '../../components/EmptyState.vue'
import { api } from '../../services/api'
import { ensureSignedIn, getCurrentUser } from '../../services/auth'

const loading = ref(false)
const errorText = ref('')
const listings = ref([])
const currentUser = computed(() => getCurrentUser())

async function loadFavorites() {
  if (!currentUser.value) {
    listings.value = []
    return
  }

  loading.value = true
  errorText.value = ''
  try {
    const result = await api.favorites.list({
      page: 1,
      pageSize: 100,
    })
    listings.value = result.items || []
  } catch (error) {
    errorText.value = error.message || '加载收藏失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function openListing(item) {
  const listingId = item?.id || item?._id
  if (!listingId) {
    uni.showToast({ title: '商品 ID 无效', icon: 'none' })
    return
  }

  uni.navigateTo({
    url: `/pages/listing/listing?id=${listingId}`,
  })
}

function goLogin() {
  ensureSignedIn('/pages/favorites/index')
}

function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
  })
}

onLoad(() => {
  loadFavorites()
})

onShow(() => {
  loadFavorites()
})
</script>

<style scoped lang="scss">
.favorites-page {
  padding-bottom: 172rpx;
}

.page-header {
  margin-bottom: 32rpx;
}

.loading-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 80rpx 0;
}

.loading-text {
  color: var(--text-tertiary);
  font-size: 28rpx;
}

.error-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 80rpx 0;
}

.error-text {
  color: var(--danger);
  font-size: 28rpx;
  text-align: center;
}

.btn-retry {
  padding: 16rpx 48rpx;
  border-radius: var(--radius-pill);
  background: var(--yellow);
  color: var(--ink);
  font-size: 26rpx;
  font-weight: 600;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.grid-item {
  width: 100%;
}
</style>
