<template>
  <view class="page-shell publish-page">
    <view class="header-row">
      <view class="back-chip" @click="goHome">
        <text>杩斿洖棣栭〉</text>
      </view>
      <text class="status-badge">{{ modeLabel }}</text>
    </view>

    <view>
      <text class="page-title">鍙戝竷甯栧瓙</text>
      <text class="page-subtitle">鏀寔鍙戝竷鍑哄敭甯栧拰姹傝喘甯栵紝鏀寔涓婁紶瀹炴媿鍥炬垨鎴浘杈呭姪娌熼€氥€?/text>
    </view>

    <EmptyState
      v-if="!currentUser"
      title="鍏堢櫥褰曞啀鍙戝竷"
      description="褰撳墠鐗堟湰鍏堜娇鐢ㄦ祴璇曡处鍙风櫥褰曪紝淇濊瘉鍙戝笘鍜岃亰澶╅兘鑳芥寕鍒板悓涓€鐢ㄦ埛銆?
      action-text="鍘荤櫥褰?
      @action="goLogin"
    />

    <view v-else class="form-stack">
      <view class="card section-card">
        <text class="field-label">甯栧瓙绫诲瀷</text>
        <view class="type-row">
          <view
            v-for="option in listingTypeOptions"
            :key="option.value"
            class="type-choice"
            :class="{ active: form.listing_type === option.value }"
            @click="form.listing_type = option.value"
          >
            <text class="choice-title">{{ option.label }}</text>
            <text class="choice-desc">{{ option.description }}</text>
          </view>
        </view>
      </view>

      <view class="card section-card">
        <text class="field-label">鏍囬</text>
        <input
          v-model="form.title"
          class="field-input"
          maxlength="40"
          :placeholder="titlePlaceholder"
        />
      </view>

      <view class="card section-card">
        <text class="field-label">鎻忚堪</text>
        <textarea
          v-model="form.description"
          class="field-textarea"
          maxlength="300"
          :placeholder="descriptionPlaceholder"
        />
      </view>

      <view class="card section-card">
        <text class="field-label">{{ priceLabel }}</text>
        <input
          :value="form.price"
          class="field-input price-input"
          type="digit"
          :placeholder="pricePlaceholder"
          placeholder-style="color:#b0b0b0;"
          @input="handlePriceInput"
        />
      </view>

      <view class="card section-card">
        <view class="section-title-row">
          <text class="field-label">鍖哄幙绀惧尯</text>
          <text class="section-value" @click="showDistrictSelector = true">
            {{ selectedDistrictLabel }}
          </text>
        </view>
      </view>

      <view class="card section-card">
        <view class="section-title-row">
          <text class="field-label">鍥剧墖鎴栨埅鍥撅紙鏈€澶?6 寮狅級</text>
          <text class="section-value">{{ imageFiles.length }}/6</text>
        </view>

        <view class="tips-card">
          <text>鍑哄敭甯栧缓璁笂浼犲疄鎷嶅浘锛涙眰璐笘鍙笂浼犲弬鑰冨浘銆佽亰澶╂埅鍥炬垨鍨嬪彿鎴浘銆?/text>
        </view>

        <view class="tips-card" style="margin-top:8rpx;">
          <text>绗竴寮犲浘灏嗕綔涓烘帹鑽愰〉灏侀潰</text>
        </view>

        <view class="image-grid">
          <view class="image-picker" @click="pickImages">
            <text class="picker-text">閫夊浘</text>
          </view>

          <view
            v-for="(image, index) in imageFiles"
            :key="`${image}-${index}`"
            class="image-box"
          >
            <image class="preview-image" :src="image" mode="aspectFill" />
            <view class="remove-tag" @click.stop="removeImage(index)">
              <text>鍒?/text>
            </view>
          </view>
        </view>
      </view>

      <view class="submit-bar">
        <view class="submit-button" @click="submitListing">
          <text>{{ submitting ? '鍙戝竷涓?..' : '鎻愪氦瀹℃牳' }}</text>
        </view>
      </view>
    </view>

    <DistrictSelector
      :visible="showDistrictSelector"
      :districts="districts"
      :current-code="form.district_code"
      @close="showDistrictSelector = false"
      @select="selectDistrict"
    />

    <BottomNav current="publish" />
  </view>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import DistrictSelector from '../../components/DistrictSelector.vue'
import EmptyState from '../../components/EmptyState.vue'
import { api } from '../../services/api'
import { ensureSignedIn, getCurrentUser } from '../../services/auth'
import { MAX_UPLOAD_IMAGES, MODE_MOCK } from '../../utils/constants'
import { setDataMode, setSelectedDistrict, useAppState } from '../../utils/app-state'

const state = useAppState()
const districts = ref([])
const imageFiles = ref([])
const showDistrictSelector = ref(false)
const submitting = ref(false)
const form = reactive({
  listing_type: 'sale',
  title: '',
  description: '',
  price: '',
  district_code: state.selectedDistrictCode,
})

const listingTypeOptions = [
  { value: 'sale', label: '鍑哄敭甯?, description: '鎴戞湁闂茬疆锛屾兂鍦ㄦ湰鍖哄幙鍑哄敭' },
  { value: 'wanted', label: '姹傝喘甯?, description: '鎴戞兂鏀舵煇浠朵笢瑗匡紝绛変汉鏉ヨ仈绯? },
]

const currentUser = computed(() => getCurrentUser())
const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))
const selectedDistrictLabel = computed(() => {
  return districts.value.find((item) => item.code === form.district_code)?.name || '璇烽€夋嫨鍖哄幙'
})
const titlePlaceholder = computed(() => {
  return form.listing_type === 'wanted'
    ? '渚嬪锛氭眰璐?95 鏂板┐鍎挎帹杞?
    : '渚嬪锛氫簩鎵嬪皬绫虫墜鏈?/ 瀹滃涔︽'
})
const descriptionPlaceholder = computed(() => {
  return form.listing_type === 'wanted'
    ? '鍐欐竻闇€姹傘€侀绠椼€佸笇鏈涗氦鏄撳尯鍩燂紝鏀寔涓婁紶鍙傝€冩埅鍥?
    : '鍐欐竻鎴愯壊銆侀厤浠躲€佺憰鐤点€佷氦鏄撴柟寮?
})
const priceLabel = computed(() => (form.listing_type === 'wanted' ? '棰勭畻' : '浠锋牸'))
const pricePlaceholder = computed(() => (form.listing_type === 'wanted' ? '璇疯緭鍏ヤ綘鐨勯绠? : '璇疯緭鍏ュ嚭鍞环鏍?))

function isCloudPermissionError(error) {
  const message = String(error?.message || error?.errMsg || '')
  return message.includes('-601034') || message.includes('娌℃湁鏉冮檺')
}

async function loadDistricts() {
  try {
    districts.value = await api.districts.list()
    if (!form.district_code && districts.value.length) {
      form.district_code = districts.value[0].code
    }
  } catch (error) {
    uni.showToast({
      title: error.message || '鍖哄幙鍔犺浇澶辫触',
      icon: 'none',
    })
  }
}

function goHome() {
  uni.switchTab({
    url: '/pages/index/index',
  })
}

function goLogin() {
  ensureSignedIn('/pages/publish/publish')
}

// add arbitrary image source (data url or local path)
function addImageSrc(src) {
  if (!src) return
  if (imageFiles.value.length >= MAX_UPLOAD_IMAGES) return
  imageFiles.value.push(src)
}

function handleDrop(event) {
  event.preventDefault()
  const files = event.dataTransfer && event.dataTransfer.files
  if (files && files.length) {
    const remain = MAX_UPLOAD_IMAGES - imageFiles.value.length
    Array.from(files)
      .slice(0, remain)
      .forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          addImageSrc(e.target.result)
        }
        reader.readAsDataURL(file)
      })
  }
}

function handlePaste(event) {
  const items = event.clipboardData && event.clipboardData.items
  if (!items) return
  let remain = MAX_UPLOAD_IMAGES - imageFiles.value.length
  for (let i = 0; i < items.length && remain > 0; i++) {
    const item = items[i]
    if (item.type && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => addImageSrc(e.target.result)
        reader.readAsDataURL(file)
        remain--
      }
    }
  }
}

function selectDistrict(code) {
  form.district_code = code
  setSelectedDistrict(code)
  showDistrictSelector.value = false
}

function pickImages() {
  const remain = MAX_UPLOAD_IMAGES - imageFiles.value.length
  if (remain <= 0) {
    uni.showToast({
      title: '鏈€澶氫笂浼?6 寮?,
      icon: 'none',
    })
    return
  }

  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (result) => {
      imageFiles.value = [...imageFiles.value, ...result.tempFilePaths].slice(0, MAX_UPLOAD_IMAGES)
    },
  })
}

function removeImage(index) {
  imageFiles.value.splice(index, 1)
}

function handlePriceInput(event) {
  const raw = String(event?.detail?.value || '')
  const normalized = raw
    .replace(/[^\d.]/g, '')
    .replace(/^\./, '')
    .replace(/(\..*)\./g, '$1')
    .replace(/^(\d+)\.(\d{0,2}).*$/, '$1.$2')
  form.price = normalized
}

function validateForm() {
  if (!form.title.trim()) return '璇峰～鍐欐爣棰?
  if (!form.description.trim()) return '璇峰～鍐欐弿杩?
  if (!form.price || Number(form.price) <= 0) return '璇峰～鍐欐纭噾棰?
  if (!form.district_code) return '璇烽€夋嫨鍖哄幙'
  if (!imageFiles.value.length) return '鑷冲皯涓婁紶 1 寮犲浘鐗囨垨鎴浘'
  return ''
}

async function submitListing() {
  const user = ensureSignedIn('/pages/publish/publish')
  if (!user) {
    return
  }

  const errorText = validateForm()
  if (errorText) {
    uni.showToast({
      title: errorText,
      icon: 'none',
    })
    return
  }

  submitting.value = true
  let downgradedToMock = false
  try {
    try {
      await api.listings.create({
        openid: user.openid,
        listing_type: form.listing_type,
        title: form.title,
        description: form.description,
        price: form.price,
        district_code: form.district_code,
        image_files: imageFiles.value,
      })
    } catch (firstError) {
      if (state.dataMode !== MODE_MOCK && isCloudPermissionError(firstError)) {
        setDataMode(MODE_MOCK)
        downgradedToMock = true
        await api.listings.create({
          openid: user.openid,
          listing_type: form.listing_type,
          title: form.title,
          description: form.description,
          price: form.price,
          district_code: form.district_code,
          image_files: imageFiles.value,
        })
      } else {
        throw firstError
      }
    }

    uni.showToast({
      title: downgradedToMock ? 'Cloud 鏃犳潈闄愶紝宸插垏鎹?Mock 骞舵彁浜? : '宸叉彁浜ゅ鏍?,
      icon: downgradedToMock ? 'none' : 'success',
    })

    form.listing_type = 'sale'
    form.title = ''
    form.description = ''
    form.price = ''
    imageFiles.value = []

    setTimeout(() => {
      uni.switchTab({
        url: '/pages/index/index',
      })
    }, 500)
  } catch (error) {
    uni.showToast({
      title: error.message || '鎻愪氦澶辫触',
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}

onLoad(() => {
  loadDistricts()
})

onShow(() => {
  form.district_code = form.district_code || state.selectedDistrictCode
})

// register DOM event handlers for web build
onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('paste', handlePaste)
    document.addEventListener('drop', handleDrop)
    document.addEventListener('dragover', (e) => e.preventDefault())
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('paste', handlePaste)
    document.removeEventListener('drop', handleDrop)
    document.removeEventListener('dragover', (e) => e.preventDefault())
  }
})
</script>

<style scoped lang="scss">
.publish-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.header-row,
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 144rpx;
  height: 68rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.08);
  font-size: 24rpx;
  font-weight: 700;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.section-card {
  padding: 26rpx;
}

.type-row {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}

.type-choice {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(34, 34, 34, 0.05);
}

.type-choice.active {
  background: rgba(255, 224, 0, 0.26);
  box-shadow: inset 0 0 0 2rpx rgba(34, 34, 34, 0.08);
}

.choice-title {
  font-size: 28rpx;
  font-weight: 800;
}

.choice-desc,
.section-value {
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.tips-card {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: rgba(255, 224, 0, 0.14);
  color: var(--text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.image-picker,
.image-box {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  overflow: hidden;
  border-radius: 24rpx;
}

.image-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 34, 34, 0.06);
}

.picker-text {
  font-size: 28rpx;
  font-weight: 700;
}

.preview-image {
  width: 100%;
  height: 100%;
}

.remove-tag {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42rpx;
  height: 42rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.72);
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}

.submit-bar {
  padding-bottom: 24rpx;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92rpx;
  border-radius: 999rpx;
  background: var(--brand-yellow);
  font-size: 30rpx;
  font-weight: 800;
}

.price-input {
  color: #222222;
  font-size: 30rpx;
  font-weight: 700;
}
</style>


