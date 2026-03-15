import {
  API_BASE_URL,
  DEFAULT_PAGE_SIZE,
  MODE_CLOUDBASE,
  MODE_MOCK,
} from '../utils/constants'
import { setDataMode, useAppState } from '../utils/app-state'
import { getDatabase, getCommand, initCloudBase, uploadFiles, canUseCloudBase } from '../utils/cloudbase'
import {
  createId,
  uniqueById,
} from '../utils/format'
import {
  getMockDatabase,
  mutateMockDatabase,
  resetMockDatabase,
} from './mock-data'

function getRuntimeMode() {
  const state = useAppState()
  return state.dataMode || MODE_MOCK
}

function isCloudPermissionError(error) {
  const message = String(error?.message || error?.errMsg || '')
  return message.includes('-601034') || message.includes('没有权限')
}

async function executeWithCloudFallback(worker) {
  try {
    return await worker()
  } catch (error) {
    if (getRuntimeMode() === MODE_CLOUDBASE && isCloudPermissionError(error)) {
      setDataMode(MODE_MOCK)
      return worker()
    }
    throw error
  }
}

async function ensureCloudDatabase() {
  if (getRuntimeMode() !== MODE_CLOUDBASE) {
    throw new Error('当前不在 CloudBase 模式。')
  }

  if (!canUseCloudBase()) {
    throw new Error('CloudBase 仅支持在微信小程序端运行，并且需要配置 CLOUDBASE_ENV。')
  }

  await initCloudBase()
  return getDatabase()
}

function normalizeDocument(document) {
  if (!document) {
    return null
  }

  return {
    ...document,
    id: document.id || document._id,
  }
}

function normalizeListingType(value) {
  return value === 'wanted' ? 'wanted' : 'sale'
}

function normalizeListingDocument(document) {
  if (!document) {
    return null
  }

  return {
    ...document,
    listing_type: normalizeListingType(document.listing_type),
  }
}

function sortByCreatedDesc(left, right) {
  return Number(right.created_at || right.updated_at || 0) - Number(left.created_at || left.updated_at || 0)
}

function sortByCreatedAsc(left, right) {
  return Number(left.created_at || left.updated_at || 0) - Number(right.created_at || right.updated_at || 0)
}

async function findRawDocumentByField(collectionName, fieldName, value) {
  const db = await ensureCloudDatabase()
  const result = await db.collection(collectionName).where({ [fieldName]: value }).limit(1).get()

  if (result.data && result.data.length) {
    return result.data[0]
  }

  if (fieldName === 'id') {
    try {
      const document = await db.collection(collectionName).doc(value).get()
      return document.data
    } catch (error) {
      return null
    }
  }

  return null
}

async function updateRawDocument(collectionName, rawDocument, data) {
  if (!rawDocument || !rawDocument._id) {
    return null
  }

  const db = await ensureCloudDatabase()
  await db.collection(collectionName).doc(rawDocument._id).update({
    data,
  })

  return {
    ...rawDocument,
    ...data,
  }
}

async function listDistrictsInternal() {
  if (getRuntimeMode() === MODE_MOCK) {
    return getMockDatabase().districts
  }

  const db = await ensureCloudDatabase()
  const result = await db.collection('districts').limit(100).get()
  return (result.data || [])
    .map(normalizeDocument)
    .sort((left, right) => String(left.code).localeCompare(String(right.code)))
}

async function getUsersMap(openids = []) {
  const values = Array.from(new Set(openids.filter(Boolean)))
  if (!values.length) {
    return new Map()
  }

  if (getRuntimeMode() === MODE_MOCK) {
    const users = getMockDatabase().users.filter((item) => values.includes(item.openid))
    return new Map(users.map((item) => [item.openid, item]))
  }

  const db = await ensureCloudDatabase()
  const command = await getCommand()
  const result = await db.collection('users').where({ openid: command.in(values) }).get()
  const users = (result.data || []).map(normalizeDocument)
  return new Map(users.map((item) => [item.openid, item]))
}

async function getDistrictMap(codes = []) {
  const districts = await listDistrictsInternal()
  const values = Array.from(new Set(codes.filter(Boolean)))
  const filtered = values.length
    ? districts.filter((item) => values.includes(item.code))
    : districts
  return new Map(filtered.map((item) => [item.code, item]))
}

async function getListingByIdInternal(listingId) {
  if (getRuntimeMode() === MODE_MOCK) {
    const listing = getMockDatabase().listings.find((item) => item.id === listingId)
    return listing ? normalizeListingDocument({ ...listing }) : null
  }

  const raw = await findRawDocumentByField('listings', 'id', listingId)
  return raw ? normalizeListingDocument(normalizeDocument(raw)) : null
}

async function getConversationByIdInternal(conversationId) {
  if (getRuntimeMode() === MODE_MOCK) {
    const conversation = getMockDatabase().conversations.find((item) => item.id === conversationId)
    return conversation ? { ...conversation } : null
  }

  const raw = await findRawDocumentByField('conversations', 'id', conversationId)
  return raw ? normalizeDocument(raw) : null
}

async function resolveListingImages(listing) {
  if (!listing) {
    return []
  }

  if (Array.isArray(listing.image_urls) && listing.image_urls.length) {
    return listing.image_urls
  }

  if (getRuntimeMode() === MODE_MOCK) {
    return getMockDatabase()
      .listing_images
      .filter((item) => item.listing_id === listing.id)
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      .map((item) => item.image_url)
  }

  const db = await ensureCloudDatabase()
  const result = await db
    .collection('listing_images')
    .where({ listing_id: listing.id })
    .orderBy('order', 'asc')
    .get()

  return (result.data || []).map((item) => item.image_url)
}

async function enrichListing(listing) {
  if (!listing) {
    return null
  }

  const [usersMap, districtMap, imageUrls] = await Promise.all([
    getUsersMap([listing.openid]),
    getDistrictMap([listing.district_code]),
    resolveListingImages(listing),
  ])

  const seller = usersMap.get(listing.openid)
  const district = districtMap.get(listing.district_code)

  return {
    ...listing,
    listing_type: normalizeListingType(listing.listing_type),
    image_urls: imageUrls,
    seller_nickname: seller?.nickname || '本地卖家',
    seller_avatar_url: seller?.avatar_url || '',
    district_name: district?.name || listing.district_code,
    city_name: district?.city_name || '',
  }
}

async function upsertUserInternal(user) {
  const payload = {
    id: user.id || `user-${user.openid}`,
    openid: user.openid,
    open_id: user.openid,
    nickname: user.nickname || '新用户',
    avatar_url: user.avatar_url || '',
    role: user.role || 'user',
    status: user.status || 'active',
    created_at: user.created_at || Date.now(),
  }

  if (getRuntimeMode() === MODE_MOCK) {
    const nextDatabase = mutateMockDatabase((database) => {
      const index = database.users.findIndex((item) => item.openid === payload.openid)
      if (index >= 0) {
        database.users[index] = {
          ...database.users[index],
          ...payload,
        }
      } else {
        database.users.unshift(payload)
      }
      return database
    })

    return nextDatabase.users.find((item) => item.openid === payload.openid)
  }

  const existing = await findRawDocumentByField('users', 'openid', payload.openid)
  const db = await ensureCloudDatabase()

  if (existing) {
    const nextPayload = {
      nickname: payload.nickname,
      avatar_url: payload.avatar_url,
      role: payload.role,
      status: payload.status,
    }
    await db.collection('users').doc(existing._id).update({
      data: nextPayload,
    })
    return normalizeDocument({
      ...existing,
      ...nextPayload,
    })
  }

  await db.collection('users').add({
    data: payload,
  })
  return payload
}

async function listApprovedListings({
  districtCode = '',
  keyword = '',
  listingType = 'all',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) {
  const currentPage = Number(page || 1)
  const size = Number(pageSize || DEFAULT_PAGE_SIZE)
  const searchValue = String(keyword || '').trim().toLowerCase()

  if (getRuntimeMode() === MODE_MOCK) {
    const database = getMockDatabase()
    const items = database.listings
      .map(normalizeListingDocument)
      .filter((item) => item.status === 'approved')
      .filter((item) => !districtCode || item.district_code === districtCode)
      .filter((item) => listingType === 'all' || item.listing_type === listingType)
      .filter((item) => {
        if (!searchValue) {
          return true
        }
        return (
          String(item.title).toLowerCase().includes(searchValue) ||
          String(item.description).toLowerCase().includes(searchValue)
        )
      })
      .sort(sortByCreatedDesc)

    const sellerMap = await getUsersMap(items.map((item) => item.openid))
    const districtMap = await getDistrictMap(items.map((item) => item.district_code))
    const paged = items.slice((currentPage - 1) * size, currentPage * size)

    return {
      items: paged.map((item) => ({
        ...item,
        seller_nickname: sellerMap.get(item.openid)?.nickname || '本地卖家',
        district_name: districtMap.get(item.district_code)?.name || item.district_code,
      })),
      page: currentPage,
      pageSize: size,
      total: items.length,
    }
  }

  const db = await ensureCloudDatabase()
  const query = { status: 'approved' }

  if (districtCode) {
    query.district_code = districtCode
  }

  const result = await db
    .collection('listings')
    .where(query)
    .orderBy('created_at', 'desc')
    .limit(200)
    .get()

  const listings = (result.data || [])
    .map(normalizeDocument)
    .map(normalizeListingDocument)
    .filter((item) => listingType === 'all' || item.listing_type === listingType)
    .filter((item) => {
      if (!searchValue) {
        return true
      }

      return [item.title, item.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchValue)
    })
    .sort(sortByCreatedDesc)
  const sellerMap = await getUsersMap(listings.map((item) => item.openid))
  const districtMap = await getDistrictMap(listings.map((item) => item.district_code))
  const paged = listings.slice((currentPage - 1) * size, currentPage * size)

  return {
    items: paged.map((item) => ({
      ...item,
      seller_nickname: sellerMap.get(item.openid)?.nickname || '本地卖家',
      district_name: districtMap.get(item.district_code)?.name || item.district_code,
    })),
    page: currentPage,
    pageSize: size,
    total: listings.length,
  }
}

async function getListingDetail(listingId) {
  const listing = await getListingByIdInternal(listingId)
  if (!listing) {
    throw new Error('商品不存在或已下架。')
  }

  return enrichListing(listing)
}

async function createListing(data) {
  const imageUrls = data.image_urls?.length
    ? data.image_urls
    : await uploadFiles(data.image_files || [])

  const listingPayload = {
    id: createId('listing'),
    openid: data.openid,
    open_id: data.openid,
    title: String(data.title || '').trim(),
    description: String(data.description || '').trim(),
    price: Number(data.price || 0),
    district_code: data.district_code,
    listing_type: normalizeListingType(data.listing_type),
    status: 'pending_review',
    image_urls: imageUrls,
    created_at: Date.now(),
  }

  if (getRuntimeMode() === MODE_MOCK) {
    mutateMockDatabase((database) => {
      database.listings.unshift(listingPayload)
      imageUrls.forEach((imageUrl, index) => {
        database.listing_images.push({
          id: createId('image'),
          listing_id: listingPayload.id,
          image_url: imageUrl,
          order: index + 1,
        })
      })
      return database
    })
    return enrichListing(listingPayload)
  }

  const db = await ensureCloudDatabase()
  await db.collection('listings').add({
    data: listingPayload,
  })

  if (imageUrls.length) {
    await Promise.all(
      imageUrls.map((imageUrl, index) =>
        db.collection('listing_images').add({
          data: {
            id: createId('image'),
            listing_id: listingPayload.id,
            image_url: imageUrl,
            order: index + 1,
          },
        }),
      ),
    )
  }

  return enrichListing(listingPayload)
}

async function listConversations(currentOpenid) {
  if (!currentOpenid) {
    return []
  }

  let conversations = []

  if (getRuntimeMode() === MODE_MOCK) {
    conversations = getMockDatabase().conversations
      .filter(
        (item) =>
          item.buyer_openid === currentOpenid || item.seller_openid === currentOpenid,
      )
      .sort(sortByCreatedDesc)
  } else {
    const db = await ensureCloudDatabase()
    const [buyerResult, sellerResult] = await Promise.all([
      db.collection('conversations').where({ buyer_openid: currentOpenid }).get(),
      db.collection('conversations').where({ seller_openid: currentOpenid }).get(),
    ])

    conversations = uniqueById(
      [...(buyerResult.data || []), ...(sellerResult.data || [])].map(normalizeDocument),
    ).sort(sortByCreatedDesc)
  }

  const listingIds = conversations.map((item) => item.listing_id)
  const peerOpenids = conversations.map((item) =>
    item.buyer_openid === currentOpenid ? item.seller_openid : item.buyer_openid,
  )

  const [usersMap, listings] = await Promise.all([
    getUsersMap(peerOpenids),
    Promise.all(listingIds.map((listingId) => getListingByIdInternal(listingId))),
  ])

  const listingMap = new Map(
    listings.filter(Boolean).map((item) => [item.id, item]),
  )

  return conversations.map((item) => {
    const listing = listingMap.get(item.listing_id)
    const peerOpenid =
      item.buyer_openid === currentOpenid ? item.seller_openid : item.buyer_openid

    return {
      ...item,
      listing_title: listing?.title || '商品已删除',
      listing_image: listing?.image_urls?.[0] || '/static/logo.png',
      listing_price: listing?.price || 0,
      peer_nickname: usersMap.get(peerOpenid)?.nickname || '对方',
      peer_openid: peerOpenid,
    }
  })
}

async function getConversationDetail(conversationId) {
  const conversation = await getConversationByIdInternal(conversationId)
  if (!conversation) {
    throw new Error('会话不存在。')
  }

  const listing = await getListingDetail(conversation.listing_id)
  return {
    ...conversation,
    listing,
  }
}

async function createOrGetConversation(listingId, buyerOpenid, sellerOpenid) {
  if (getRuntimeMode() === MODE_MOCK) {
    const database = getMockDatabase()
    const existing = database.conversations.find(
      (item) =>
        item.listing_id === listingId &&
        item.buyer_openid === buyerOpenid &&
        item.seller_openid === sellerOpenid,
    )

    if (existing) {
      return existing
    }

    const payload = {
      id: createId('conversation'),
      listing_id: listingId,
      buyer_openid: buyerOpenid,
      seller_openid: sellerOpenid,
      last_message: '',
      unread_count: 0,
      updated_at: Date.now(),
    }

    mutateMockDatabase((draft) => {
      draft.conversations.unshift(payload)
      return draft
    })

    return payload
  }

  const db = await ensureCloudDatabase()
  const result = await db
    .collection('conversations')
    .where({
      listing_id: listingId,
      buyer_openid: buyerOpenid,
      seller_openid: sellerOpenid,
    })
    .limit(1)
    .get()

  if (result.data && result.data.length) {
    return normalizeDocument(result.data[0])
  }

  const payload = {
    id: createId('conversation'),
    listing_id: listingId,
    buyer_openid: buyerOpenid,
    seller_openid: sellerOpenid,
    last_message: '',
    unread_count: 0,
    updated_at: Date.now(),
  }

  await db.collection('conversations').add({
    data: payload,
  })

  return payload
}

async function markConversationRead(conversationId) {
  if (getRuntimeMode() === MODE_MOCK) {
    mutateMockDatabase((database) => {
      const target = database.conversations.find((item) => item.id === conversationId)
      if (target) {
        target.unread_count = 0
      }
      return database
    })
    return true
  }

  const rawConversation = await findRawDocumentByField('conversations', 'id', conversationId)
  if (!rawConversation) {
    return false
  }

  await updateRawDocument('conversations', rawConversation, {
    unread_count: 0,
  })
  return true
}

async function listMessages(conversationId) {
  if (getRuntimeMode() === MODE_MOCK) {
    return getMockDatabase().messages
      .filter((item) => item.conversation_id === conversationId)
      .sort(sortByCreatedAsc)
  }

  const db = await ensureCloudDatabase()
  const result = await db
    .collection('messages')
    .where({ conversation_id: conversationId })
    .orderBy('created_at', 'asc')
    .get()

  return (result.data || []).map(normalizeDocument)
}

async function sendMessage(conversationId, content, senderOpenid, messageType = 'text', imageUrl = null) {
  const text = String(content || '').trim()
  if (!text) {
    throw new Error('消息不能为空。')
  }

  const message = {
    id: createId('message'),
    conversation_id: conversationId,
    sender_openid: senderOpenid,
    content: text,
    message_type: messageType,
    created_at: Date.now(),
  }

  // 添加图片 URL（如果有）
  if (messageType === 'image' && imageUrl) {
    message.image_url = imageUrl
  }

  if (getRuntimeMode() === MODE_MOCK) {
    mutateMockDatabase((database) => {
      database.messages.push(message)
      const conversation = database.conversations.find((item) => item.id === conversationId)
      if (conversation) {
        conversation.last_message = messageType === 'image' ? '[图片]' : text
        conversation.updated_at = message.created_at
        conversation.unread_count = Number(conversation.unread_count || 0) + 1
      }
      return database
    })
    return message
  }

  const db = await ensureCloudDatabase()
  await db.collection('messages').add({
    data: message,
  })

  const rawConversation = await findRawDocumentByField('conversations', 'id', conversationId)
  if (rawConversation) {
    const lastMessageDisplay = messageType === 'image' ? '[图片]' : text
    await updateRawDocument('conversations', rawConversation, {
      last_message: lastMessageDisplay,
      updated_at: message.created_at,
      unread_count: Number(rawConversation.unread_count || 0) + 1,
    })
  }

  return message
}

export const api = {
  /**
   * 通用 HTTP 请求方法（用于调用后端 API）
   * @param {Object} options - 请求配置
   * @param {String} options.method - 请求方法 (GET/POST/PUT/DELETE)
   * @param {String} options.url - 请求 URL
   * @param {Object} options.data - 请求数据
   * @returns {Promise<Object>} 响应结果
   */
  async request(options) {
    return new Promise((resolve, reject) => {
      const { method = 'GET', url, data } = options

      const fullUrl = url.startsWith('http')
        ? url
        : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`

      uni.request({
        url: fullUrl,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
        },
        success: (response) => {
          if (response.statusCode === 200 && response.data) {
            resolve(response.data)
          } else {
            reject(new Error(response.data?.message || '请求失败'))
          }
        },
        fail: (error) => {
          reject(new Error(error.errMsg || '网络请求失败'))
        },
      })
    })
  },

  runtime: {
    getMode() {
      return getRuntimeMode()
    },
    getApiBaseUrl() {
      return API_BASE_URL
    },
    canUseCloudBase,
    resetMockDatabase,
  },
  districts: {
    list: (...args) => executeWithCloudFallback(() => listDistrictsInternal(...args)),
  },
  users: {
    upsert: (...args) => executeWithCloudFallback(() => upsertUserInternal(...args)),
  },
  listings: {
    listApproved: (...args) => executeWithCloudFallback(() => listApprovedListings(...args)),
    getDetail: (...args) => executeWithCloudFallback(() => getListingDetail(...args)),
    create: (...args) => executeWithCloudFallback(() => createListing(...args)),
  },
  conversations: {
    list: (...args) => executeWithCloudFallback(() => listConversations(...args)),
    getDetail: (...args) => executeWithCloudFallback(() => getConversationDetail(...args)),
    createOrGet: (...args) => executeWithCloudFallback(() => createOrGetConversation(...args)),
    markRead: (...args) => executeWithCloudFallback(() => markConversationRead(...args)),
  },
  messages: {
    list: (...args) => executeWithCloudFallback(() => listMessages(...args)),
    send: (...args) => executeWithCloudFallback(() => sendMessage(...args)),
  },
}
