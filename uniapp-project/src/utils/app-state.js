import { reactive } from 'vue'
import {
  DEFAULT_DISTRICT_CODE,
  MODE_MOCK,
  STORAGE_KEYS,
} from './constants'

function readStorage(key, fallback) {
  try {
    const value = uni.getStorageSync(key)
    return value || fallback
  } catch (error) {
    return fallback
  }
}

const state = reactive({
  dataMode: readStorage(STORAGE_KEYS.dataMode, MODE_MOCK),
  currentUser: readStorage(STORAGE_KEYS.currentUser, null),
  selectedProvinceCode: readStorage(STORAGE_KEYS.selectedProvince, ''),
  selectedCityCode: readStorage(STORAGE_KEYS.selectedCity, ''),
  selectedDistrictCode: readStorage(
    STORAGE_KEYS.selectedDistrict,
    DEFAULT_DISTRICT_CODE,
  ),
  returnUrl: readStorage(STORAGE_KEYS.returnUrl, ''),
})

export function useAppState() {
  return state
}

export function setDataMode(mode) {
  state.dataMode = mode
  uni.setStorageSync(STORAGE_KEYS.dataMode, mode)
}

export function setCurrentUser(user) {
  state.currentUser = user ? { ...user } : null
  if (state.currentUser) {
    uni.setStorageSync(STORAGE_KEYS.currentUser, state.currentUser)
  } else {
    uni.removeStorageSync(STORAGE_KEYS.currentUser)
  }
}

export function setSelectedDistrict(code) {
  state.selectedDistrictCode = code || DEFAULT_DISTRICT_CODE
  uni.setStorageSync(STORAGE_KEYS.selectedDistrict, state.selectedDistrictCode)
}

export function setSelectedScope({ provinceCode = '', cityCode = '', districtCode = '' } = {}) {
  state.selectedProvinceCode = provinceCode
  state.selectedCityCode = cityCode
  state.selectedDistrictCode = districtCode

  if (provinceCode) {
    uni.setStorageSync(STORAGE_KEYS.selectedProvince, provinceCode)
  } else {
    uni.removeStorageSync(STORAGE_KEYS.selectedProvince)
  }

  if (cityCode) {
    uni.setStorageSync(STORAGE_KEYS.selectedCity, cityCode)
  } else {
    uni.removeStorageSync(STORAGE_KEYS.selectedCity)
  }

  if (districtCode) {
    uni.setStorageSync(STORAGE_KEYS.selectedDistrict, districtCode)
  } else {
    uni.removeStorageSync(STORAGE_KEYS.selectedDistrict)
  }
}

export function setReturnUrl(url) {
  state.returnUrl = url || ''
  if (state.returnUrl) {
    uni.setStorageSync(STORAGE_KEYS.returnUrl, state.returnUrl)
  } else {
    uni.removeStorageSync(STORAGE_KEYS.returnUrl)
  }
}

export function consumeReturnUrl() {
  const url = state.returnUrl || ''
  setReturnUrl('')
  return url
}
