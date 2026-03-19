<template>
  <view v-if="visible" class="selector-root">
    <view class="mask" @click="emit('close')" />
    <view class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">{{ title }}</text>
        <text class="sheet-close" @click="emit('close')">关闭</text>
      </view>

      <view class="scope-row">
        <picker
          class="scope-picker"
          :range="provinceOptions"
          range-key="name"
          :value="provinceIndex"
          @change="handleProvinceChange"
        >
          <view class="scope-pill">
            <text class="scope-label">{{ selectedProvinceLabel }}</text>
          </view>
        </picker>

        <picker
          class="scope-picker"
          :range="cityOptions"
          range-key="name"
          :value="cityIndex"
          @change="handleCityChange"
        >
          <view class="scope-pill">
            <text class="scope-label">{{ selectedCityLabel }}</text>
          </view>
        </picker>
      </view>

      <scroll-view scroll-y class="district-list">
        <view
          v-if="allowProvinceSelect"
          :class="['district-item', 'province-item', { active: !currentProvinceCode && !currentCityCode && !currentCode }]"
          @click="emitProvinceSelect"
        >
          <view class="district-copy">
            <text class="district-name">全部省份</text>
            <text class="district-city">全国范围</text>
          </view>
          <text v-if="!currentProvinceCode && !currentCityCode && !currentCode" class="district-check">已选择</text>
        </view>

        <view
          v-if="allowProvinceSelect && selectedProvinceOption && selectedProvinceOption.code"
          :class="['district-item', 'province-item', { active: !!currentProvinceCode && !currentCityCode && !currentCode }]"
          @click="handleProvinceBreadcrumbClick"
        >
          <view class="district-copy">
            <text class="district-name">{{ selectedProvinceOption.name }}</text>
            <text class="district-city">全部城市 / 区县</text>
          </view>
          <text v-if="!!currentProvinceCode && !currentCityCode && !currentCode" class="district-check">已选择</text>
        </view>

        <view
          v-if="allowCitySelect && selectedCityOption"
          :class="['district-item', 'city-item', { active: !currentCode && currentCityCode === selectedCityOption.code }]"
          @click="emitCitySelect"
        >
          <view class="district-copy">
            <text class="district-name">{{ selectedCityOption.name }}</text>
            <text class="district-city">全部区县</text>
          </view>
          <text v-if="!currentCode && currentCityCode === selectedCityOption.code" class="district-check">已选择</text>
        </view>

        <view
          v-for="district in districtOptions"
          :key="district.code"
          :class="['district-item', { active: currentCode === district.code }]"
          @click="emitDistrictSelect(district)"
        >
          <view class="district-copy">
            <text class="district-name">{{ district.name }}</text>
            <text class="district-city">{{ districtMeta(district) }}</text>
          </view>
          <text v-if="currentCode === district.code" class="district-check">已选择</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  currentCode: {
    type: String,
    default: '',
  },
  currentCityCode: {
    type: String,
    default: '',
  },
  currentProvinceCode: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '选择区县',
  },
  districts: {
    type: Array,
    default: () => [],
  },
  allowCitySelect: {
    type: Boolean,
    default: false,
  },
  allowProvinceSelect: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'select'])

const provinceCode = ref('')
const cityCode = ref('')

function normalizeDistricts(items) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item) => ({
      code: String(item.code || '').trim(),
      name: String(item.name || '').trim(),
      city_code: String(item.city_code || '').trim(),
      city_name: String(item.city_name || '').trim(),
      province_code: String(item.province_code || '').trim(),
      province_name: String(item.province_name || '').trim(),
    }))
    .filter((item) => item.code && item.name)
}

function sortByCode(left, right) {
  return String(left.code).localeCompare(String(right.code))
}

const normalizedDistricts = computed(() => normalizeDistricts(props.districts))

const provinceOptions = computed(() => {
  const map = new Map()
  normalizedDistricts.value.forEach((item) => {
    if (!item.province_code || map.has(item.province_code)) {
      return
    }
    map.set(item.province_code, {
      code: item.province_code,
      name: item.province_name || item.province_code,
    })
  })
  return [{ code: '', name: '全部省份' }, ...Array.from(map.values()).sort(sortByCode)]
})

const cityOptions = computed(() => {
  const map = new Map()
  normalizedDistricts.value.forEach((item) => {
    if (provinceCode.value && item.province_code !== provinceCode.value) {
      return
    }
    if (!item.city_code || map.has(item.city_code)) {
      return
    }
    map.set(item.city_code, {
      code: item.city_code,
      name: item.city_name || item.city_code,
    })
  })
  return [{ code: '', name: '全部城市' }, ...Array.from(map.values()).sort(sortByCode)]
})

const districtOptions = computed(() => {
  return normalizedDistricts.value
    .filter((item) => (provinceCode.value ? item.province_code === provinceCode.value : true))
    .filter((item) => (cityCode.value ? item.city_code === cityCode.value : true))
    .sort(sortByCode)
})

const provinceIndex = computed(() => {
  const index = provinceOptions.value.findIndex((item) => item.code === provinceCode.value)
  return index >= 0 ? index : 0
})

const cityIndex = computed(() => {
  const index = cityOptions.value.findIndex((item) => item.code === cityCode.value)
  return index >= 0 ? index : 0
})

const selectedProvinceLabel = computed(() => {
  return provinceOptions.value[provinceIndex.value]?.name || '选择省份'
})

const selectedCityLabel = computed(() => {
  return cityOptions.value[cityIndex.value]?.name || '选择城市'
})

const selectedProvinceOption = computed(() => provinceOptions.value[provinceIndex.value] || null)
const selectedCityOption = computed(() => cityOptions.value[cityIndex.value] || null)

function syncScope() {
  if (props.currentProvinceCode) {
    provinceCode.value = props.currentProvinceCode
  }
  if (props.currentCityCode) {
    cityCode.value = props.currentCityCode
  }

  const selected = normalizedDistricts.value.find((item) => item.code === props.currentCode)
  if (selected) {
    provinceCode.value = selected.province_code || ''
    cityCode.value = selected.city_code || ''
    return
  }

  if (!provinceCode.value && provinceOptions.value.length) {
    provinceCode.value = props.currentProvinceCode || provinceOptions.value[0].code
  }
  if (!cityCode.value && cityOptions.value.length) {
    cityCode.value = props.currentCityCode || cityOptions.value[0].code
  }
}

function handleProvinceChange(event) {
  const nextProvince = provinceOptions.value[Number(event.detail?.value || 0)]
  provinceCode.value = nextProvince?.code || ''
  cityCode.value = ''
}

function handleCityChange(event) {
  const nextCity = cityOptions.value[Number(event.detail?.value || 0)]
  cityCode.value = nextCity?.code || ''
}

function emitCitySelect() {
  if (!selectedCityOption.value) {
    return
  }

  emit('select', {
    type: 'city',
    province_code: provinceCode.value,
    city_code: selectedCityOption.value.code,
    district_code: '',
  })
}

function emitProvinceSelect() {
  // If already at the top level, do nothing.
  if (!props.currentProvinceCode && !props.currentCityCode && !props.currentCode) {
    return
  }

  emit('select', {
    type: 'province',
    province_code: '',
    city_code: '',
    district_code: '',
  })
}

function handleProvinceBreadcrumbClick() {
  // Go up to the top level (select from all provinces)
  provinceCode.value = ''
  cityCode.value = ''
}

function emitDistrictSelect(district) {
  emit('select', {
    type: 'district',
    province_code: district.province_code,
    city_code: district.city_code,
    district_code: district.code,
  })
}

function districtMeta(district) {
  return [district.province_name, district.city_name].filter(Boolean).join(' / ')
}

watch(
  () => [props.currentCode, props.currentCityCode, props.currentProvinceCode, props.visible, props.districts.length],
  () => {
    syncScope()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.selector-root {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.mask {
  position: absolute;
  inset: 0;
  background: var(--mask-bg);
}

.sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - 220rpx);
  max-height: calc(100vh - 220rpx);
  margin: 0 auto;
  padding: 32rpx 24rpx 0;
  border-radius: 36rpx 36rpx 0 0;
  background: #fffdf7;
  box-sizing: border-box;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  gap: 16rpx;
}

.sheet-title {
  font-size: 36rpx;
  font-weight: 800;
}

.sheet-close {
  color: var(--text-tertiary);
  font-size: 24rpx;
  line-height: 1;
  min-width: 88rpx;
  min-height: 88rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.scope-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.scope-picker {
  flex: 1;
  min-width: 0;
}

.scope-pill {
  display: flex;
  align-items: center;
  min-height: 88rpx;
  padding: 0 24rpx;
  border-radius: var(--border-radius-md);
  background: #f4efdd;
  box-sizing: border-box;
}

.scope-label {
  color: var(--brand-ink);
  font-size: 28rpx;
  font-weight: 700;
}

.district-list {
  height: calc(100% - 200rpx);
  min-height: 400rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  box-sizing: border-box;
}

.district-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  min-height: 104rpx;
  padding: 24rpx;
  border-radius: var(--border-radius-lg);
  background: #f8f5eb;
  box-sizing: border-box;
}

.district-item.active {
  background: #fff2a8;
}

.district-copy {
  min-width: 0;
}

.district-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.4;
}

.district-city {
  display: block;
  margin-top: 8rpx;
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.district-check {
  color: var(--brand-ink);
  font-size: 24rpx;
  font-weight: 700;
  min-width: 88rpx;
  text-align: right;
}
</style>
