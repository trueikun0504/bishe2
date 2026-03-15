<template>
  <view class="page-shell home-page">
    <TopSearchBar
      v-model="keyword"
      :district-label="districtLabel"
      :mode-label="modeLabel"
      @search="loadListings"
      @select-district="showDistrictSelector = true"
    />

    <view class="filter-tabs">
      <view
        v-for="option in typeOptions"
        :key="option.value"
        class="filter-tab"
        :class="{ active: selectedListingType === option.value }"
        @click="changeType(option.value)"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>

    <view class="category-nav">
      <view
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        @click="handleCategoryClick(category)"
      >
        <text class="category-name">{{ category.name }}</text>
      </view>
    </view>

    <view class="summary-row">
      <text class="summary-text">当前社区：{{ districtLabel }}</text>
      <text class="summary-text">共 {{ listings.length }} 条</text>
    </view>

    <view v-if="loading" class="loading-text">正在加载...</view>

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
      title="暂无数据"
      description="换个筛选条件试试，或先发布一条"
      action-text="去发布"
      @action="goPublish"
    />

    <DistrictSelector
      :visible="showDistrictSelector"
      :districts="districts"
      :current-code="state.selectedDistrictCode"
      @close="showDistrictSelector = false"
      @select="handleDistrictSelect"
    />

    <BottomNav current="home" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import DistrictSelector from '../../components/DistrictSelector.vue'
import EmptyState from '../../components/EmptyState.vue'
import ProductCard from '../../components/ProductCard.vue'
import TopSearchBar from '../../components/TopSearchBar.vue'
import { api } from '../../services/api'
import { MODE_MOCK } from '../../utils/constants'
import { setSelectedDistrict, useAppState } from '../../utils/app-state'

const state = useAppState()
const bootstrapped = ref(false)
const loading = ref(false)
const keyword = ref('')
const listings = ref([])
const districts = ref([])
const showDistrictSelector = ref(false)
const selectedListingType = ref('all')

const categories = ref([
  { id: 'electronics', name: '电子产品' },
  { id: 'clothing', name: '服饰鞋帽' },
  { id: 'books', name: '图书教材' },
  { id: 'sports', name: '运动健身' },
  { id: 'home', name: '居家用品' },
  { id: 'others', name: '其他' },
])

const typeOptions = [
  { value: 'all', label: '全部' },
  { value: 'sale', label: '在售' },
  { value: 'wanted', label: '求购' },
]

const districtLabel = computed(() => {
  return districts.value.find((item) => item.code === state.selectedDistrictCode)?.name || '选择区县'
})

const modeLabel = computed(() => {
  return state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'
})

async function loadDistricts() {
  try {
    districts.value = await api.districts.list()
    if (!state.selectedDistrictCode && districts.value.length) {
      setSelectedDistrict(districts.value[0].code)
    }
  } catch (error) {
    uni.showToast({ title: error.message || '区县加载失败', icon: 'none' })
  }
}

async function loadListings() {
  loading.value = true
  try {
    const result = await api.listings.listApproved({
      districtCode: state.selectedDistrictCode,
      keyword: keyword.value,
      listingType: selectedListingType.value,
      page: 1,
      pageSize: 20,
    })
    listings.value = result.items || []
  } catch (error) {
    uni.showToast({ title: error.message || '帖子加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function bootstrap() {
  await loadDistricts()
  await loadListings()
  bootstrapped.value = true
}

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

async function handleDistrictSelect(code) {
  setSelectedDistrict(code)
  showDistrictSelector.value = false
  await loadListings()
}

function changeType(value) {
  if (selectedListingType.value === value) return
  selectedListingType.value = value
  loadListings()
}

function goPublish() {
  uni.switchTab({
    url: '/pages/publish/publish',
  })
}

function handleCategoryClick(category) {
  if (!category?.name) return
  keyword.value = category.name
  selectedListingType.value = 'all'
  loadListings()
}

onLoad(() => {
  bootstrap()
})

onShow(() => {
  if (bootstrapped.value) {
    loadListings()
  }
})

onPullDownRefresh(() => {
  loadListings()
})
</script>

<style scoped lang="scss">
.home-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.filter-tabs {
  display: flex;
  gap: 16rpx;
  padding: 8rpx 0;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 144rpx;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.08);
  color: var(--text-secondary);
  font-size: 26rpx;
  font-weight: 700;
}

.filter-tab.active {
  background: var(--brand-yellow);
  color: var(--brand-ink);
}

.category-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 78rpx;
  border-radius: 16rpx;
  background: #fff;
}

.category-name {
  font-size: 24rpx;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-text,
.loading-text {
  color: var(--text-tertiary);
  font-size: 24rpx;
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
