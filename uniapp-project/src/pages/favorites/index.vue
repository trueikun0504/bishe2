<template>
  <view class="page-shell favorites-page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">我的收藏</text>
      <text class="page-subtitle">收藏后可以更快回到商品详情，继续联系卖家</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-section">
      <text class="loading-text">正在加载收藏...</text>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="errorText" class="error-section">
      <text class="error-text">{{ errorText }}</text>
      <button class="btn-retry" @click="loadFavorites">重试</button>
    </view>

    <!-- 收藏商品网格 -->
    <view v-else-if="listings.length" class="grid">
      <ProductCard
        v-for="item in listings"
        :key="item.id || item._id"
        class="grid-item"
        :item="item"
        @select="openListing"
      />
      <view class="favorite-actions" v-if="listings.length">
        <text class="favorite-tip">左滑商品可取消收藏 (功能开发中)</text>
      </view>
    </view>

    <!-- 空状态 -->
    <EmptyState
      v-else
      title="你还没有收藏商品"
      description="去首页逛逛，点一下商品详情里的“收藏”，这里就会出现记录"
      action-text="去首页"
      @action="goHome"
    />

    <!-- 返回按钮 -->
    <view class="back-section">
      <button class="btn-back" @click="goBack">返回个人中心</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ProductCard from '../../components/ProductCard.vue'
import EmptyState from '../../components/EmptyState.vue'
import { api } from '../../services/api'

const loading = ref(false)
const errorText = ref('')
const listings = ref([])

// 加载收藏列表
async function loadFavorites() {
  loading.value = true
  errorText.value = ''
  try {
    // 暂时使用已通过的商品列表模拟收藏数据
    // 实际开发中需要调用收藏API
    const result = await api.listings.listApproved({
      districtCode: '',
      keyword: '',
      listingType: 'all',
      page: 1,
      pageSize: 20,
    })
    listings.value = result.items.slice(0, 10) || [] // 模拟部分数据
  } catch (error) {
    errorText.value = error.message || '加载收藏失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 打开商品详情
function openListing(item) {
  const listingId = item?.id || item?._id
  if (!listingId) {
    uni.showToast({ title: '商品ID无效', icon: 'none' })
    return
  }

  uni.navigateTo({
    url: `/pages/listing/listing?id=${listingId}`,
  })
}

// 返回个人中心
function goBack() {
  uni.navigateBack()
}

// 去首页
function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
  })
}

onLoad(() => {
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
  padding: 80rpx 0;
  gap: 24rpx;
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
  flex-wrap: wrap;
  gap: 18rpx;
}

.grid-item {
  width: calc(50% - 9rpx);
}

.favorite-actions {
  width: 100%;
  padding: 32rpx 0;
  text-align: center;
}

.favorite-tip {
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.back-section {
  margin-top: 48rpx;
  padding: 32rpx 0;
  border-top: 1rpx solid var(--line);
}

.btn-back {
  width: 100%;
  padding: 24rpx;
  border-radius: var(--radius-pill);
  background: var(--card-bg);
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 600;
  border: 1rpx solid var(--line);
}
</style>