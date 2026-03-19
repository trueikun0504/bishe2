// 测试微信登录 API
process.env.WECHAT_APPID = 'test';
process.env.WECHAT_APPSECRET = 'test';

const axios = require('axios');

async function testWechatLogin() {
  try {
    const response = await axios.post('http://localhost:3001/api/mp/auth/login', {
      code: 'test_code_123',
      spread_spid: 0,
      avatar: 'https://example.com/avatar.jpg',
      nickName: '测试用户',
      city: '北京',
      country: '中国',
      province: '北京',
      sex: 1,
      type: 'routine'
    });

    console.log('登录成功:', response.data);
  } catch (error) {
    console.error('登录失败:', error.response?.data || error.message);
  }
}

testWechatLogin();