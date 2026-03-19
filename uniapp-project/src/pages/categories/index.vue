<template>
  <view class="page-shell categories-page">
    <view class="page-header page-gutter">
      <text class="page-title">全部分类</text>
      <text class="page-subtitle">浏览不同分类下的闲置商品</text>
    </view>

    <view class="category-tabs page-gutter">
      <scroll-view class="category-tabs-scroll" scroll-x="true" show-scrollbar="false">
        <view
          v-for="category in categories"
          :key="category.id"
          class="category-tab"
          :class="{ active: activeCategoryId === category.id }"
          @tap="selectCategory(category)"
        >
          <text class="category-icon">{{ category.icon || '📦' }}</text>
          <text class="category-name">{{ category.name }}</text>
        </view>
      </scroll-view>
    </view>

    <view v-if="loading" class="loading-section">
      <text class="loading-text">正在加载...</text>
    </view>

    <view v-else-if="listings.length" class="listing-list">
      <ProductCard
        v-for="item in listings"
        :key="item.id || item._id"
        class="listing-item"
        :item="item"
        @select="openListing"
      />
    </view>

    <EmptyState
      v-else
      title="暂无商品"
      description="当前分类下还没有商品，换个分类试试"
      action-text="去首页"
      @action="goHome"
    />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '../../components/EmptyState.vue'
import ProductCard from '../../components/ProductCard.vue'
import { api } from '../../services/api'
import { useAppState } from '../../utils/app-state'

const state = useAppState()
const loading = ref(false)
const listings = ref([])
const activeCategoryId = ref('')
const categories = ref([
  { id: 'cat-1', name: '电子产品', icon: '📱' },
  { id: 'cat-4', name: '服饰鞋帽', icon: '👟' },
  { id: 'cat-9', name: '图书教材', icon: '📚' },
  { id: 'cat-8', name: '运动健身', icon: '🚲' },
  { id: 'cat-7', name: '家居用品', icon: '🧺' },
  { id: 'cat-11', name: '其他', icon: '📦' },
])

const activeCategory = computed(() => {
  return categories.value.find((category) => category.id === activeCategoryId.value) || categories.value[0]
})

async function loadCategories() {
  try {
    const items = await api.categories.list()
    if (Array.isArray(items) && items.length) {
      categories.value = items
    }
  } catch (error) {
    // Keep fallback categories.
  }
}

function selectCategory(category) {
  activeCategoryId.value = category.id
  loadListings()
}

async function loadListings() {
  if (!activeCategory.value?.id) {
    return
  }

  loading.value = true
  try {
    const result = await api.listings.listApproved({
      provinceCode: state.selectedProvinceCode,
      cityCode: state.selectedCityCode,
      districtCode: state.selectedDistrictCode,
      categoryId: activeCategory.value.id,
      keyword: '',
      listingType: 'all',
      page: 1,
      pageSize: 20,
    })
    listings.value = result.items || []
  } catch (error) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    })
  } finally {
    loading.value = false
  }
}

function openListing(item) {
  const listingId = item?.id || item?._id
  if (!listingId) {
    uni.showToast({
      title: '商品 ID 无效',
      icon: 'none',
    })
    return
  }

  uni.navigateTo({
    url: `/pages/listing/listing?id=${listingId}`,
  })
}

function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
  })
}

async function init() {
  await loadCategories()
  if (!activeCategoryId.value && categories.value.length) {
    activeCategoryId.value = categories.value[0].id
  }
  await loadListings()
}

onLoad(() => {
  init()
})

onShow(() => {
  if (activeCategoryId.value) {
    loadListings()
  }
})
</script>

<style scoped lang="scss">
.categories-page {
  --font-size-base: 16px;
  --font-size-lg: 26px;
  --font-size-sm: 14px;

  padding-right: 0;
  padding-bottom: 172rpx;
  padding-left: 0;
}

.page-gutter {
  padding-right: 24rpx;
  padding-left: 24rpx;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 32rpx;
}

.page-title {
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.page-subtitle {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.category-tabs {
  margin-bottom: 28rpx;
}

.category-tabs-scroll {
  white-space: nowrap;
}

.category-tab {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 168rpx;
  height: 168rpx;
  margin-right: 16rpx;
  border-radius: 24rpx;
  background: var(--card-bg);
  box-shadow: var(--shadow-soft);
}

.category-tab.active {
  background: var(--yellow);
}

.category-icon {
  font-size: 40rpx;
  margin-bottom: 14rpx;
}

.category-name {
  font-size: 24rpx;
  font-weight: 700;
}

.loading-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 80rpx 24rpx;
}

.loading-text {
  color: var(--text-tertiary);
  font-size: 28rpx;
}

.listing-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 100%;
}

.listing-item {
  width: 100%;
}

.listing-list :deep(.product-card) {
  width: 100%;
  border-radius: 0;
}
</style>
