<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'

// 顶部滚动公告横幅：配置(url/content/highlight)从后端 /api/notice 拉取，关闭后缓存 1 小时
const NOTICE_KEY = 'notice_dismissed'
const HIDE_MS = 60 * 60 * 1000 // 1 小时
const DEFAULT_NOTICE = {
  url: 'https://www.aliyun.com/benefit?tid=product&utm_content=se_1023591267',
  content: '服务至2026年12月1日到期、请及时续费，以免影响正常使用，谢谢配合！',
  highlight: '2026年12月1日',
}
const notice = ref({ ...DEFAULT_NOTICE })
const dismissedAt = Number(localStorage.getItem(NOTICE_KEY) || 0)
const showNotice = ref(!dismissedAt || Date.now() - dismissedAt > HIDE_MS)

// 把 content 按 highlight 切成片段，用于渲染红字高亮
const noticeSegments = computed(() => {
  const { content, highlight } = notice.value
  if (!highlight) return [{ text: content, highlight: false }]
  const parts = content.split(highlight)
  const segs = []
  parts.forEach((p, i) => {
    if (p) segs.push({ text: p, highlight: false })
    if (i < parts.length - 1) segs.push({ text: highlight, highlight: true })
  })
  return segs
})

function onNoticeClick() {
  window.open(notice.value.url, '_blank')
}

function closeNotice() {
  showNotice.value = false
  localStorage.setItem(NOTICE_KEY, String(Date.now()))
}

onMounted(async () => {
  try {
    const res = await fetch('/api/notice')
    if (res.ok) {
      const data = await res.json()
      if (data) notice.value = { ...DEFAULT_NOTICE, ...data }
    }
  } catch (e) {
    // 拉取失败时保留默认配置
  }
})
</script>

<template>
  <!-- 顶部滚动公告横幅（贴顶全宽，可关闭，点击跳转） -->
  <div v-if="showNotice" class="notice-bar" @click="onNoticeClick">
    <div class="notice-track">
      <span class="notice-text">
        <span
          v-for="(seg, i) in noticeSegments"
          :key="i"
          :class="seg.highlight ? 'notice-date' : ''"
          >{{ seg.text }}</span
        >
      </span>
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
