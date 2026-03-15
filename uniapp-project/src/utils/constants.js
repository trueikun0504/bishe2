export const MODE_MOCK = 'mock'
export const MODE_CLOUDBASE = 'cloudbase'

export const CLOUDBASE_ENV =
  typeof __CLOUDBASE_ENV__ !== 'undefined' ? __CLOUDBASE_ENV__ : ''

// NOTE: In WeChat Mini Program mode, the Node built-in `url` module is not available.
// Avoid using `import.meta.env` fallbacks that may introduce Node-specific runtime code.
export const API_BASE_URL =
  typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__
    ? __API_BASE_URL__
    : 'https://bisetest-8g4u6aw68c5f4e27-1325781869.ap-shanghai.app.tcloudbase.com'

export const STORAGE_KEYS = {
  dataMode: 'LOCAL_TRADER_DATA_MODE',
  currentUser: 'LOCAL_TRADER_CURRENT_USER',
  selectedDistrict: 'LOCAL_TRADER_SELECTED_DISTRICT',
  mockDatabase: 'LOCAL_TRADER_MOCK_DATABASE',
  returnUrl: 'LOCAL_TRADER_RETURN_URL',
}

export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_DISTRICT_CODE = 'chaoyang'
export const DEFAULT_CITY_NAME = '北京'
export const MAX_UPLOAD_IMAGES = 6
