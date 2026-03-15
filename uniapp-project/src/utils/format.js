export function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createId(prefix) {
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${stamp}-${random}`
}

export function formatPrice(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) {
    return '¥0'
  }
  return `¥${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

export function formatRelativeTime(timestamp) {
  const value = Number(timestamp)
  if (!value) {
    return '刚刚'
  }

  const diff = Date.now() - value
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) {
    return '刚刚'
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)} 分钟前`
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`
  }
  if (diff < 7 * day) {
    return `${Math.floor(diff / day)} 天前`
  }

  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatMessageTime(timestamp) {
  const value = Number(timestamp)
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const isToday = new Date().toDateString() === date.toDateString()

  if (isToday) {
    return `${hours}:${minutes}`
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`
}

export function formatFullTime(timestamp) {
  const value = Number(timestamp)
  if (!value) {
    return '--'
  }

  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export function resolveImage(url) {
  return url || '/static/logo.png'
}

export function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function uniqueById(list = []) {
  const seen = new Map()

  list.forEach((item) => {
    if (!item || !item.id) {
      return
    }
    seen.set(item.id, item)
  })

  return Array.from(seen.values())
}
