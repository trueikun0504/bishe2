<template>
  <view class="page-shell categories-page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">全部分类</text>
      <text class="page-subtitle">浏览不同分类的闲置商品</text>
    </view>

    <!-- 分类筛选 -->
    <view class="category-tabs">
      <scroll-view class="category-tabs-scroll" scroll-x="true">
        <view
          v-for="category in categories"
          :key="category.id"
          class="category-tab"
          :class="{ active: activeCategoryId === category.id }"
          @click="selectCategory(category)"
        >
          <text class="category-icon">{{ category.icon || '📦' }}</text>
          <text class="category-name">{{ category.name }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-section">
      <text class="loading-text">正在加载...</text>
    </view>

    <!-- 商品网格 -->
    <view v-else-if="listings.length" class="grid">
      <ProductCard
        v-for="item in listings"
        :key="item.id || item._id"
        class="grid-item"
        :item="item"
        @select="openListing"
      />
    </view>

    <!-- 空状态 -->
    <EmptyState
      v-else
      title="暂无商品"
      description="当前分类下还没有商品，换个分类试试"
      action-text="去首页逛逛"
      @action="goHome"
    />

    <BottomNav current="categories" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import EmptyState from '../../components/EmptyState.vue'
import ProductCard from '../../components/ProductCard.vue'
import { api } from '../../services/api'
import { useAppState } from '../../utils/app-state'

const state = useAppState()
const loading = ref(false)
const listings = ref([])
const activeCategoryId = ref('')
const categories = ref([
  { id: 'electronics', name: '电子产品', icon: '📱' },
  { id: 'clothing', name: '服饰鞋帽', icon: '👟' },
  { id: 'books', name: '图书教材', icon: '📚' },
  { id: 'sports', name: '运动健身', icon: '🚴' },
  { id: 'home', name: '居家用品', icon: '🏠' },
  { id: 'others', name: '其他', icon: '📦' },
])

// 当前选中的分类
const activeCategory = computed(() => {
  return categories.value.find(cat => cat.id === activeCategoryId.value) || categories.value[0]
})

// 选择分类
function selectCategory(category) {
  activeCategoryId.value = category.id
  loadListings()
}

// 加载商品列表
async function loadListings() {
  if (!activeCategoryId.value) return

  loading.value = true
  try {
    // 这里需要根据分类ID调用API，暂时使用通用接口
    const result = await api.listings.listApproved({
      districtCode: state.selectedDistrictCode,
      keyword: '',
      listingType: 'all',
      page: 1,
      pageSize: 20,
    })
    listings.value = result.items || []
  } catch (error) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
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

// 返回首页
function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
  })
}

// 初始化
function init() {
  if (!activeCategoryId.value && categories.value.length) {
    activeCategoryId.value = categories.value[0].id
  }
  loadListings()
}

onLoad(() => {
  init()
})

onShow(() => {
  // 每次显示时刷新数据
  if (activeCategoryId.value) {
    loadListings()
  }
})
</script>

<style scoped lang="scss">
.categories-page {
  padding-bottom: 172rpx;
}

.page-header {
  margin-bottom: 32rpx;
}

.category-tabs {
  margin-bottom: 32rpx;
}

.category-tabs-scroll {
  white-space: nowrap;
}

.category-tab {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 160rpx;
  height: 160rpx;
  margin-right: 16rpx;
  border-radius: 24rpx;
  background: var(--card-bg);
  box-shadow: var(--shadow-soft);
}

.category-tab.active {
  background: var(--yellow);
}

.category-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.category-name {
  font-size: 24rpx;
  font-weight: 600;
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

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.grid-item {
  width: calc(50% - 9rpx);
}
</style>