<template>
  <view class="page-shell home-page">
    <TopSearchBar
      v-model="keyword"
      :district-label="districtLabel"
      :mode-label="modeLabel"
      @search="loadListings"
      @select-district="showDistrictSelector = true"
    />

    <view class="summary-row">
      <text class="summary-label">当前位置</text>
      <text class="summary-value" number-of-lines="1">{{ districtLabel }}</text>
      <text class="summary-count">当前 {{ listings.length }} 个在售</text>
    </view>

    <view class="category-tabs">
      <view
        v-for="option in typeOptions"
        :key="option.value"
        class="category-tab"
        :class="{ active: selectedListingType === option.value }"
        @tap="changeType(option.value)"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>

    <view class="quick-section">
      <view class="quick-header">
        <text class="section-title">热门品类</text>
        <text class="section-link" @tap="handleShowAllCategories">{{ isCategoriesExpanded ? '收起' : '更多' }}</text>
      </view>
      <view class="quick-grid">
        <view
          v-for="category in displayCategories"
          :key="category.id"
          class="quick-card"
          :style="{ backgroundColor: category.color }"
          @tap="handleCategoryClick(category)"
          hover-class="quick-card-hover"
          hover-stay-time="80"
        >
          <text class="quick-icon">{{ category.icon || '🪧' }}</text>
          <text class="quick-name">{{ category.name }}</text>
          <text class="quick-sub">{{ category.subtitle || '一键进入' }}</text>
        </view>
      </view>
    </view>

    <view class="waterfall-section">
      <view v-if="loading" class="loading-wrapper">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="listings.length" class="masonry-grid">
        <view
          v-for="item in listings"
          :key="item.id || item._id"
          class="masonry-item"
          @tap="openListing(item)"
        >
          <image
            class="masonry-image"
            :src="getListingCover(item)"
            mode="aspectFill"
          />
          <view class="masonry-badge" v-if="item.listing_type">
            {{ item.listing_type === 'wanted' ? '求购' : '出售' }}
          </view>
          <view class="masonry-meta">
            <text class="masonry-title" number-of-lines="2">{{ item.title }}</text>
            <view class="masonry-price-row">
              <text class="masonry-price">{{ formatPrice(item.price) }}</text>
              <text class="masonry-location" number-of-lines="1">
                {{ item.district_name || item.city_name || '全国' }}
              </text>
            </view>
            <view class="masonry-footer">
              <text class="masonry-seller" number-of-lines="1">
                {{ item.seller_nickname || '本地用户' }}
              </text>
              <text class="masonry-caption">
                {{ item.listing_type === 'wanted' ? '关注' : '马上购' }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <EmptyState
        v-else
        title="暂无商品"
        description="换个关键词试试，或立即发布新物品"
        action-text="发布物品"
        @action="goPublish"
      />
    </view>

    <DistrictSelector
      :visible="showDistrictSelector"
      :districts="districts"
      :current-code="state.selectedDistrictCode"
      :current-city-code="state.selectedCityCode"
      :current-province-code="state.selectedProvinceCode"
      :allow-city-select="true"
      :allow-province-select="true"
      @close="showDistrictSelector = false"
      @select="handleDistrictSelect"
    />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import DistrictSelector from '../../components/DistrictSelector.vue'
import EmptyState from '../../components/EmptyState.vue'
import TopSearchBar from '../../components/TopSearchBar.vue'
import { api } from '../../services/api'
import { MODE_MOCK } from '../../utils/constants'
import { formatPrice, resolveImage } from '../../utils/format'
import { setSelectedScope, useAppState } from '../../utils/app-state'

const state = useAppState()
const bootstrapped = ref(false)
const loading = ref(false)
const keyword = ref('')
const listings = ref([])
const districts = ref([])
const showDistrictSelector = ref(false)
const selectedListingType = ref('all')
const isCategoriesExpanded = ref(false)

const typeOptions = [
  { value: 'all', label: '推荐' },
  { value: 'sale', label: '特价' },
  { value: 'wanted', label: '求购' },
]

const categoryPalette = ['#fff5d9', '#d6ebff', '#f8e7ff', '#ffe8d3', '#ddf5e8']

const categories = ref([
  { id: 'cat-1', name: '二手手机', icon: '📱' },
  { id: 'cat-4', name: '家电数码', icon: '🖥️' },
  { id: 'cat-9', name: '潮流装备', icon: '👟' },
  { id: 'cat-8', name: '家居家装', icon: '🛋️' },
  { id: 'cat-7', name: '母婴玩具', icon: '🧸' },
  { id: 'cat-11', name: '其他', icon: '📦' },
])

const districtLabel = computed(() => {
  const district = districts.value.find((item) => item.code === state.selectedDistrictCode)
  if (district) {
    return district.name
  }

  const city = districts.value.find((item) => item.city_code === state.selectedCityCode)
  if (city) {
    return `${city.city_name} 路 全市`
  }

  const province = districts.value.find((item) => item.province_code === state.selectedProvinceCode)
  if (province) {
    return `${province.province_name} 路 全省`
  }

  return '选择区域'
})

const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))

const decoratedCategories = computed(() =>
  categories.value.map((item, index) => ({
    ...item,
    color: categoryPalette[index % categoryPalette.length],
    subtitle: item.subtitle || '热门推荐',
  })),
)

const displayCategories = computed(() => {
  if (isCategoriesExpanded.value) {
    return decoratedCategories.value
  }
  return decoratedCategories.value.slice(0, 6)
})

function getListingCover(listing) {
  const url = listing?.image_urls?.[0] || listing?.cover_image_url || listing?.coverImage || ''
  return resolveImage(url)
}

async function loadDistricts() {
  try {
    districts.value = await api.districts.list()
    if (state.selectedDistrictCode) {
      const selected = districts.value.find((item) => item.code === state.selectedDistrictCode)
      if (selected) {
        setSelectedScope({
          provinceCode: selected.province_code,
          cityCode: selected.city_code,
          districtCode: selected.code,
        })
        return
      }
    }

    // if (!state.selectedCityCode && districts.value.length) {
    //   const first = districts.value[0]
    //   setSelectedScope({
    //     provinceCode: first.province_code,
    //     cityCode: first.city_code,
    //     districtCode: '',
    //   })
    // }
  } catch (error) {
    uni.showToast({ title: error.message || '城市列表加载失败', icon: 'none' })
  }
}

async function loadCategories() {
  try {
    const items = await api.categories.list()
    if (Array.isArray(items) && items.length) {
      categories.value = items
    }
  } catch (error) {
    // Keep fallback categories when API categories are unavailable.
  }
}

async function loadListings() {
  loading.value = true
  try {
    const result = await api.listings.listApproved({
      provinceCode: state.selectedProvinceCode,
      cityCode: state.selectedCityCode,
      districtCode: state.selectedDistrictCode,
      keyword: keyword.value,
      listingType: selectedListingType.value,
      page: 1,
      pageSize: 20,
    })
    listings.value = result.items || []
  } catch (error) {
    uni.showToast({ title: error.message || '商品加载失败', icon: 'none' })
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function bootstrap() {
  await loadCategories()
  await loadDistricts()
  await loadListings()
  bootstrapped.value = true
}

function openListing(item) {
  const listingId = item?.id || item?._id
  if (!listingId) {
    uni.showToast({ title: '商品ID缺失', icon: 'none' })
    return
  }

  uni.navigateTo({
    url: `/pages/listing/listing?id=${listingId}`,
  })
}

async function handleDistrictSelect(selection) {
  if (!selection) {
    return
  }

  if (typeof selection === 'string') {
    const district = districts.value.find((item) => item.code === selection)
    if (!district) {
      return
    }
    setSelectedScope({
      provinceCode: district.province_code,
      cityCode: district.city_code,
      districtCode: district.code,
    })
  } else {
    setSelectedScope({
      provinceCode: selection.province_code || '',
      cityCode: selection.city_code || '',
      districtCode: selection.district_code || '',
    })
  }

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

function handleShowAllCategories() {
  isCategoriesExpanded.value = !isCategoriesExpanded.value
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
  gap: 16rpx;
  padding: 0 24rpx 160rpx;
  background-color: #f5f7fa;
  border-radius: var(--border-radius-xl);
  overflow: hidden;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}

.summary-label {
  font-size: 24rpx;
  color: #6b6f74;
}

.summary-value {
  flex: 1;
  font-size: 26rpx;
  font-weight: 700;
  color: #111111;
}

.summary-count {
  font-size: 22rpx;
  color: #999999;
}

.category-tabs {
  display: flex;
  gap: 12rpx;
  overflow-x: auto;
  padding-bottom: 6rpx;
}

.category-tab {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border-radius: var(--border-radius-full);
  background: rgba(255, 255, 255, 0.7);
  color: #737a85;
  font-size: 24rpx;
  font-weight: 600;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.category-tab.active {
  background: #ffde00;
  color: #332e20;
  border-color: rgba(255, 222, 0, 0.7);
  box-shadow: 0 8rpx 16rpx rgba(255, 222, 0, 0.25);
}

.quick-section {
  background: #ffffff;
  padding: 20rpx;
  border-radius: 32rpx;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.05);
}

.quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.section-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1c1c1c;
}

.section-link {
  font-size: 22rpx;
  color: #1677ff;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.quick-card {
  background: #f3f4f7;
  border-radius: var(--border-radius-xl);
  padding: 18rpx 12rpx;
  min-height: 160rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.08);
}

.quick-card-hover {
  transform: translateY(-6rpx);
}

.quick-icon {
  font-size: 30rpx;
}

.quick-name {
  font-size: 24rpx;
  font-weight: 700;
  margin-top: 6rpx;
}

.quick-sub {
  font-size: 20rpx;
  color: #5d5d5d;
}

.waterfall-section {
  position: relative;
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60rpx 0;
}

.loading-text {
  font-size: 24rpx;
  color: #8f8f95;
}

.masonry-grid {
  column-count: 2;
  column-gap: 16rpx;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 16rpx;
  background: #ffffff;
  border-radius: var(--border-radius-xl);
  overflow: hidden;
  box-shadow: 0 14rpx 30rpx rgba(0, 0, 0, 0.05);
}

.masonry-image {
  width: 100%;
  height: 360rpx;
  background: #e5e7eb;
}

.masonry-badge {
  position: absolute;
  top: 14rpx;
  left: 14rpx;
  padding: 6rpx 14rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 14rpx;
  font-size: 20rpx;
  color: #ff5000;
  font-weight: 700;
}

.masonry-meta {
  padding: 18rpx 16rpx 22rpx;
}

.masonry-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1d1d1d;
  line-height: 1.3;
}

.masonry-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.masonry-price {
  font-size: 30rpx;
  font-weight: 800;
  color: #ff5000;
}

.masonry-location {
  font-size: 22rpx;
  color: #9b9b9b;
}

.masonry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.masonry-seller {
  font-size: 22rpx;
  color: #666666;
}

.masonry-caption {
  font-size: 20rpx;
  color: #1677ff;
  font-weight: 700;
}

/* #ifdef H5 */
.category-tab:hover,
.quick-card:hover {
  transform: translateY(-4rpx);
  box-shadow: 0 14rpx 30rpx rgba(0, 0, 0, 0.12);
}
/* #endif */
</style>
