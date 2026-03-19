<script>
import { initCloudBase } from './utils/cloudbase'
import { ensureMockDatabase } from './services/mock-data'

export default {
  async onLaunch() {
    try {
      ensureMockDatabase()
      await initCloudBase()
    } catch (error) {
      console.error('Mini program launch bootstrap failed:', error)
    }
  },
}
</script>

<style lang="scss">
page {
  --border-radius-sm: 8rpx;
  --border-radius-md: 16rpx;
  --border-radius-lg: 24rpx;
  --border-radius-xl: 32rpx;
  --border-radius-full: 999rpx;

  background: var(--page-bg);
  color: var(--text-primary);
  font-size: 28rpx;
}

/* #ifdef MP-WEIXIN */
/*
  这里去除了对 page > view:first-child 的 transform 缩放。
  这个缩放会导致 position: fixed 的元素（如底部导航）失效（不会固定在视口底部）。
  所以取消此缩放，保持原始显示比例，确保底部导航固定。
*/
/* #endif */

button {
  border-radius: 999rpx;
}

button::after {
  border: none;
}
</style>
