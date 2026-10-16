<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'

// 顶部滚动公告横幅（关闭后缓存 1 小时，到期自动重新出现）
const NOTICE_KEY = 'notice_dismissed'
const HIDE_MS = 60 * 60 * 1000 // 1 小时
const NOTICE_URL = 'https://www.aliyun.com/benefit?tid=product&utm_content=se_1023591267'
const dismissedAt = Number(localStorage.getItem(NOTICE_KEY) || 0)
const showNotice = ref(!dismissedAt || Date.now() - dismissedAt > HIDE_MS)

function onNoticeClick() {
  window.open(NOTICE_URL, '_blank')
}

function closeNotice() {
  showNotice.value = false
  localStorage.setItem(NOTICE_KEY, String(Date.now()))
}
</script>

<template>
  <!-- 顶部滚动公告横幅（贴顶全宽，可关闭，点击跳转） -->
  <div v-if="showNotice" class="notice-bar" @click="onNoticeClick">
    <div class="notice-track">
      <span class="notice-text">服务至<span class="notice-date">2026年12月1日</span>到期、请及时续费，以免影响正常使用，谢谢配合！</span>
    </div>
    <button class="notice-close" title="关闭" @click.stop="closeNotice">×</button>
  </div>

  <RouterView />
</template>

<style>
/* 顶部滚动公告横幅：贴顶、全宽 */
.notice-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  overflow: hidden;
  height: 2.4rem;
  line-height: 2.4rem;
  background: linear-gradient(90deg, #fff3cf, #ffdf9e);
  border-bottom: 1px solid #f0c060;
  cursor: pointer;
}
.notice-track {
  display: flex;
  white-space: nowrap;
  animation: notice-scroll 30s linear infinite;
}
.notice-bar:hover .notice-track {
  animation-play-state: paused;
}
.notice-text {
  padding-right: 4rem;
  font-size: 0.92rem;
  color: #7a4e00;
  flex-shrink: 0;
}
.notice-date {
  color: #e02020;
  font-weight: 700;
}
@keyframes notice-scroll {
  from {
    transform: translateX(100vw); /* 从页面右边缘出发 */
  }
  to {
    transform: translateX(-20vw); /* 扫到左侧后很快回右，缩短空档 */
  }
}
.notice-close {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #7a4e00;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.4rem;
  opacity: 0.7;
}
.notice-close:hover {
  opacity: 1;
  background: rgba(122, 78, 0, 0.12);
  border-radius: 4px;
}
/* 给页面留出横幅高度，避免遮挡内容 */
body {
  padding-top: 2.4rem;
}
</style>
