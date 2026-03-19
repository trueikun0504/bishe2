<template>
  <view class="page-shell publish-page">
    <view class="header-row">
      <view class="back-chip" @click="goHome">
        <text>返回首页</text>
      </view>
      <text class="status-badge">{{ modeLabel }}</text>
    </view>

    <view class="hero-copy">
      <text class="page-title">发布帖子</text>
      <text class="page-subtitle">支持发布出售信息和求购信息，支持上传实拍图或截图辅助沟通。</text>
    </view>

    <EmptyState
      v-if="!currentUser"
      title="先登录再发布"
      description="当前版本需先登录后再发布，确保帖子和聊天都能关联到同一用户。"
      action-text="去登录"
      @action="goLogin"
    />

    <view v-else class="form-stack">
      <view class="card section-card">
        <text class="field-label">帖子类型</text>
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
        <text class="field-label">标题</text>
        <input
          v-model="form.title"
          class="field-input"
          maxlength="40"
          :placeholder="titlePlaceholder"
        />
      </view>

      <view class="card section-card">
        <text class="field-label">描述</text>
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
          <text class="field-label">区县社区</text>
          <text class="section-value" @click="showDistrictSelector = true">
            {{ selectedDistrictLabel }}
          </text>
        </view>
      </view>

      <view class="card section-card">
        <view class="section-title-row">
          <text class="field-label">图片或截图（最多 6 张）</text>
          <text class="section-value">{{ imageFiles.length }}/6</text>
        </view>

        <view class="tips-card">
          <text>出售信息建议上传实拍图，求购信息可上传参考图、聊天截图或型号截图。</text>
        </view>

        <view class="tips-card" style="margin-top:8rpx;">
          <text>第一张图将作为推荐页封面</text>
        </view>

        <view class="image-grid">
          <view class="image-picker" @click="pickImages">
            <text class="picker-text">选图</text>
          </view>

          <view
            v-for="(image, index) in imageFiles"
            :key="`${image}-${index}`"
            class="image-box"
          >
            <image class="preview-image" :src="image" mode="aspectFill" />
            <view class="remove-tag" @click.stop="removeImage(index)">
              <text>删</text>
            </view>
          </view>
        </view>
      </view>

      <view class="submit-bar">
        <view class="submit-button" @click="submitListing">
          <text>{{ submitting ? '发布中...' : '提交审核' }}</text>
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

  </view>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
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
  { value: 'sale', label: '出售', description: '我有闲置，想在本区县出售' },
  { value: 'wanted', label: '求购', description: '我想收某件东西，等人来联系' },
]

const currentUser = computed(() => getCurrentUser())
const modeLabel = computed(() => (state.dataMode === MODE_MOCK ? 'Mock' : 'Cloud'))
const selectedDistrictLabel = computed(() => {
  return districts.value.find((item) => item.code === form.district_code)?.name || '请选择区县'
})
const titlePlaceholder = computed(() => {
  return form.listing_type === 'wanted'
    ? '例如：求购 95 新婴儿推车'
    : '例如：二手小米手机 / 宜家书桌'
})
const descriptionPlaceholder = computed(() => {
  return form.listing_type === 'wanted'
    ? '写清需求、预算、希望交易区域，支持上传参考截图'
    : '写清成色、配件、瑕疵和交易方式'
})
const priceLabel = computed(() => (form.listing_type === 'wanted' ? '预算' : '价格'))
const pricePlaceholder = computed(() => (form.listing_type === 'wanted' ? '请输入你的预算' : '请输入出售价'))

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
      title: error.message || '区县加载失败',
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

function selectDistrict(selection) {
  const code =
    typeof selection === 'string'
      ? selection
      : String(selection?.district_code || '').trim()

  if (!code) {
    return
  }

  form.district_code = code
  setSelectedDistrict(code)
  showDistrictSelector.value = false
}

function pickImages() {
  const remain = MAX_UPLOAD_IMAGES - imageFiles.value.length
  if (remain <= 0) {
    uni.showToast({
      title: '最多上传 6 张',
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
  if (!form.title.trim()) return '请填写标题'
  if (!form.description.trim()) return '请填写描述'
  if (!form.price || Number(form.price) <= 0) return '请填写正确金额'
  if (!form.district_code) return '请选择区县'
  if (!imageFiles.value.length) return '至少上传 1 张图片或截图'
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
      title: downgradedToMock ? 'Cloud 无权限，已切到 Mock 并提交' : '已提交审核',
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
      title: error.message || '提交失败',
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

.header-row {
  margin-top: 8rpx;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 8rpx 4rpx 0;
}

.back-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 168rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(34, 34, 34, 0.08);
  font-size: 24rpx;
  font-weight: 700;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.section-card {
  padding: 32rpx 28rpx;
}

.publish-page :deep(.field-input) {
  min-height: 96rpx;
  padding-top: 26rpx;
  padding-bottom: 26rpx;
  line-height: 44rpx;
}

.publish-page :deep(.field-textarea) {
  min-height: 280rpx;
  padding-top: 24rpx;
  padding-bottom: 24rpx;
  line-height: 44rpx;
}

.type-row {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.type-choice {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-height: 156rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(34, 34, 34, 0.05);
  box-sizing: border-box;
}

.type-choice.active {
  background: rgba(255, 224, 0, 0.26);
  box-shadow: inset 0 0 0 2rpx rgba(34, 34, 34, 0.08);
}

.choice-title {
  font-size: 32rpx;
  font-weight: 800;
}

.choice-desc,
.section-value {
  color: var(--text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.tips-card {
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: rgba(255, 224, 0, 0.14);
  color: var(--text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 20rpx;
}

.image-picker,
.image-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
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
  padding: 8rpx 0 32rpx;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  border-radius: 999rpx;
  background: var(--brand-yellow);
  font-size: 30rpx;
  font-weight: 800;
}

.price-input {
  color: #222222;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 44rpx;
}
</style>


