import { STORAGE_KEYS } from '../utils/constants'
import { cloneDeep } from '../utils/format'

function buildDefaultMockDatabase() {
  const now = Date.now()

  return {
    users: [
      {
        id: 'user-buyer-demo-001',
        openid: 'buyer-demo-001',
        open_id: 'buyer-demo-001',
        nickname: '社区买家阿洛',
        avatar_url: '',
        role: 'user',
        status: 'active',
        created_at: now - 15 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'user-seller-001',
        openid: 'seller-001',
        open_id: 'seller-001',
        nickname: '朝阳王阿姨',
        avatar_url: '',
        role: 'user',
        status: 'active',
        created_at: now - 20 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'user-seller-002',
        openid: 'seller-002',
        open_id: 'seller-002',
        nickname: '海淀小赵',
        avatar_url: '',
        role: 'user',
        status: 'active',
        created_at: now - 18 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'user-wanted-001',
        openid: 'wanted-001',
        open_id: 'wanted-001',
        nickname: '本地求购小林',
        avatar_url: '',
        role: 'user',
        status: 'active',
        created_at: now - 12 * 24 * 60 * 60 * 1000,
      },
    ],
    districts: [
      { code: 'chaoyang', name: '朝阳区', city_code: 'beijing', city_name: '北京' },
      { code: 'haidian', name: '海淀区', city_code: 'beijing', city_name: '北京' },
    ],
    listings: [
      {
        id: 'listing-1001',
        openid: 'seller-001',
        open_id: 'seller-001',
        listing_type: 'sale',
        title: '二手小米 14，12+256G',
        description: '使用半年，屏幕无划痕，附保护壳和充电器，支持当面验机。',
        price: 2299,
        district_code: 'chaoyang',
        status: 'approved',
        image_urls: ['/static/logo.png', '/static/logo.png'],
        created_at: now - 2 * 60 * 60 * 1000,
      },
      {
        id: 'listing-1002',
        openid: 'seller-002',
        open_id: 'seller-002',
        listing_type: 'sale',
        title: '山地自行车 9 成新',
        description: '地铁口可自提，刹车和变速器都正常，适合通勤。',
        price: 780,
        district_code: 'haidian',
        status: 'approved',
        image_urls: ['/static/logo.png', '/static/logo.png', '/static/logo.png'],
        created_at: now - 5 * 60 * 60 * 1000,
      },
      {
        id: 'listing-1003',
        openid: 'seller-001',
        open_id: 'seller-001',
        listing_type: 'sale',
        title: '宜家书桌',
        description: '白色桌面，轻微使用痕迹，适合租房党。',
        price: 160,
        district_code: 'chaoyang',
        status: 'approved',
        image_urls: ['/static/logo.png'],
        created_at: now - 9 * 60 * 60 * 1000,
      },
      {
        id: 'listing-1004',
        openid: 'seller-002',
        open_id: 'seller-002',
        listing_type: 'sale',
        title: 'Switch Lite',
        description: '主机成色好，送保护包和卡盒。',
        price: 880,
        district_code: 'haidian',
        status: 'approved',
        image_urls: ['/static/logo.png'],
        created_at: now - 30 * 60 * 60 * 1000,
      },
      {
        id: 'listing-1005',
        openid: 'seller-001',
        open_id: 'seller-001',
        listing_type: 'sale',
        title: '美的电饭煲 3L',
        description: '搬家出闲置，功能正常，可现场测试。',
        price: 95,
        district_code: 'chaoyang',
        status: 'approved',
        image_urls: ['/static/logo.png'],
        created_at: now - 48 * 60 * 60 * 1000,
      },
      {
        id: 'listing-2001',
        openid: 'wanted-001',
        open_id: 'wanted-001',
        listing_type: 'wanted',
        title: '求购 8 成新儿童安全座椅',
        description: '最好在朝阳北路附近，预算 280 元以内，可上传截图或实拍图沟通细节。',
        price: 280,
        district_code: 'chaoyang',
        status: 'approved',
        image_urls: ['/static/logo.png'],
        created_at: now - 90 * 60 * 1000,
      },
    ],
    listing_images: [
      { id: 'image-1001-1', listing_id: 'listing-1001', image_url: '/static/logo.png', order: 1 },
      { id: 'image-1001-2', listing_id: 'listing-1001', image_url: '/static/logo.png', order: 2 },
      { id: 'image-1002-1', listing_id: 'listing-1002', image_url: '/static/logo.png', order: 1 },
      { id: 'image-1002-2', listing_id: 'listing-1002', image_url: '/static/logo.png', order: 2 },
      { id: 'image-1002-3', listing_id: 'listing-1002', image_url: '/static/logo.png', order: 3 },
      { id: 'image-1003-1', listing_id: 'listing-1003', image_url: '/static/logo.png', order: 1 },
      { id: 'image-1004-1', listing_id: 'listing-1004', image_url: '/static/logo.png', order: 1 },
      { id: 'image-1005-1', listing_id: 'listing-1005', image_url: '/static/logo.png', order: 1 },
      { id: 'image-2001-1', listing_id: 'listing-2001', image_url: '/static/logo.png', order: 1 },
    ],
    conversations: [
      {
        id: 'conv-1001',
        listing_id: 'listing-1001',
        buyer_openid: 'buyer-demo-001',
        seller_openid: 'seller-001',
        last_message: '在的，可以今晚地铁口面交。',
        unread_count: 1,
        updated_at: now - 30 * 60 * 1000,
      },
      {
        id: 'conv-2001',
        listing_id: 'listing-2001',
        buyer_openid: 'wanted-001',
        seller_openid: 'seller-002',
        last_message: '我这边有一台 9 成新安全座椅，可以带实物来看。',
        unread_count: 0,
        updated_at: now - 20 * 60 * 1000,
      },
    ],
    messages: [
      {
        id: 'msg-1001',
        conversation_id: 'conv-1001',
        sender_openid: 'buyer-demo-001',
        content: '你好，这台手机现在还能看吗？',
        created_at: now - 35 * 60 * 1000,
      },
      {
        id: 'msg-1002',
        conversation_id: 'conv-1001',
        sender_openid: 'seller-001',
        content: '在的，可以今晚地铁口面交。',
        created_at: now - 30 * 60 * 1000,
      },
      {
        id: 'msg-2001',
        conversation_id: 'conv-2001',
        sender_openid: 'seller-002',
        content: '我这边有一台 9 成新安全座椅，可以带实物来看。',
        created_at: now - 20 * 60 * 1000,
      },
    ],
    feedback: [],
  }
}

export function ensureMockDatabase() {
  const current = uni.getStorageSync(STORAGE_KEYS.mockDatabase)
  if (current && current.listings) {
    return cloneDeep(current)
  }

  const seeded = buildDefaultMockDatabase()
  uni.setStorageSync(STORAGE_KEYS.mockDatabase, seeded)
  return cloneDeep(seeded)
}

export function getMockDatabase() {
  return ensureMockDatabase()
}

export function saveMockDatabase(database) {
  uni.setStorageSync(STORAGE_KEYS.mockDatabase, cloneDeep(database))
  return getMockDatabase()
}

export function mutateMockDatabase(mutator) {
  const draft = getMockDatabase()
  const next = mutator(draft) || draft
  return saveMockDatabase(next)
}

export function resetMockDatabase() {
  const seeded = buildDefaultMockDatabase()
  uni.setStorageSync(STORAGE_KEYS.mockDatabase, seeded)
  return cloneDeep(seeded)
}
