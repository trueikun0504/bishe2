import { CLOUDBASE_ENV } from './constants'

let cloudbaseInitPromise = null

export function isWeixinMiniProgram() {
  return typeof wx !== 'undefined' && Boolean(wx.cloud)
}

export function canUseCloudBase() {
  return Boolean(CLOUDBASE_ENV) && isWeixinMiniProgram()
}

export async function initCloudBase() {
  if (!canUseCloudBase()) {
    return false
  }

  if (cloudbaseInitPromise) {
    return cloudbaseInitPromise
  }

  cloudbaseInitPromise = Promise.resolve()
    .then(() => {
      wx.cloud.init({
        env: CLOUDBASE_ENV,
        traceUser: true,
      })
      return true
    })
    .catch((error) => {
      console.error('CloudBase init failed:', error)
      cloudbaseInitPromise = null
      return false
    })

  return cloudbaseInitPromise
}

export async function getDatabase() {
  const ready = await initCloudBase()
  if (!ready) {
    throw new Error('CloudBase 当前不可用，请切换到 mock 模式或在微信小程序端运行。')
  }

  return wx.cloud.database()
}

export async function getCommand() {
  const db = await getDatabase()
  return db.command
}

function getFilePath(file) {
  if (!file) {
    return ''
  }

  if (typeof file === 'string') {
    return file
  }

  return file.path || file.tempFilePath || ''
}

function getExtension(filePath) {
  const cleanPath = filePath.split('?')[0]
  const dotIndex = cleanPath.lastIndexOf('.')
  return dotIndex >= 0 ? cleanPath.slice(dotIndex + 1) : 'jpg'
}

export async function uploadFiles(files = []) {
  if (!files.length) {
    return []
  }

  if (!canUseCloudBase()) {
    return files.map((file) => getFilePath(file))
  }

  await initCloudBase()

  const uploads = files.map((file, index) => {
    const filePath = getFilePath(file)

    if (
      !filePath ||
      filePath.startsWith('cloud://') ||
      filePath.startsWith('http://') ||
      filePath.startsWith('https://')
    ) {
      return Promise.resolve({
        fileID: filePath,
      })
    }

    return wx.cloud.uploadFile({
      cloudPath: `listings/${Date.now()}-${index}.${getExtension(filePath)}`,
      filePath,
    })
  })

  const result = await Promise.all(uploads)
  return result.map((item) => item.fileID)
}
