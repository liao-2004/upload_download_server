<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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

// ---- 右下角广告弹窗：配置(url/title/text/image/enabled)从后端 /api/ad 拉取 ----
const DEFAULT_AD = {
  enabled: true,
  url: 'https://example.com',
  title: '推广',
  text: '这里放你的推广文案，例如：点击了解最新优惠活动',
  image: '', // 可选：图片路径，如 /api/ad/image/xx.png
}
const ad = ref({ ...DEFAULT_AD })
const showAd = ref(false)
const adImgFailed = ref(false) // 广告图片加载失败时隐藏弹窗，避免残留空黑框
let adTimer = null

// ---- 右下角版本号：从后端 /api/version 拉取 ----
const version = ref('')

function closeAd() {
  showAd.value = false
}

onMounted(async () => {
  // 横幅配置
  try {
    const res = await fetch('/api/notice')
    if (res.ok) {
      const data = await res.json()
      if (data) notice.value = { ...DEFAULT_NOTICE, ...data }
    }
  } catch (e) {
    // 拉取失败时保留默认配置
  }
  // 广告配置
  try {
    const res = await fetch('/api/ad')
    if (res.ok) {
      const data = await res.json()
      if (data) ad.value = { ...DEFAULT_AD, ...data }
    }
  } catch (e) {
    // 拉取失败时保留默认配置
  }
  // 版本号
  try {
    const res = await fetch('/api/version')
    if (res.ok) {
      const data = await res.json()
      if (data && data.version) version.value = data.version
    }
  } catch (e) {
    // 静默
  }
  // 等配置加载完再决定是否弹广告，避免 enabled:false 时仍闪现
  if (ad.value.enabled) {
    adTimer = setTimeout(() => {
      showAd.value = true
    }, 2500)
  }
})

onBeforeUnmount(() => {
  if (adTimer) clearTimeout(adTimer)
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

  <!-- 右下角广告弹窗（可关闭） -->
  <transition name="ad-fade">
    <div v-if="showAd && !adImgFailed" class="ad-pop">
      <button class="ad-close" title="关闭" @click="closeAd">×</button>
      <a :href="ad.url" target="_blank" rel="noopener noreferrer" class="ad-link">
        <img v-if="ad.image" :src="ad.image" class="ad-img" alt="广告图" @error="adImgFailed = true" />
        <div class="ad-overlay">
          <span class="ad-title">{{ ad.title }}</span>
          <span v-if="ad.text" class="ad-text">{{ ad.text }}</span>
        </div>
      </a>
    </div>
  </transition>

  <!-- 右下角版本号 -->
  <div v-if="version" class="version-badge">{{ version }}</div>
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

/* 右下角广告弹窗：图片占满，标题半透明浮层在左下角 */
.ad-pop {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  width: 340px;
  z-index: 1000;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  background: #000;
}
.ad-link {
  position: relative;
  display: block;
  text-decoration: none;
  color: #fff;
}
.ad-img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
}
.ad-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.55rem 0.7rem;
  text-align: left;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  pointer-events: none;
}
.ad-title {
  display: block;
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
}
.ad-text {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.92);
}
.ad-close {
  position: absolute;
  top: 0.35rem;
  right: 0.45rem;
  z-index: 2;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 0.95rem;
  line-height: 1;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ad-close:hover {
  background: rgba(0, 0, 0, 0.6);
}
.ad-fade-enter-active,
.ad-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.ad-fade-enter-from,
.ad-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
/* 右下角版本号 */
.version-badge {
  position: fixed;
  right: 0.6rem;
  bottom: 0.4rem;
  z-index: 900;
  font-size: 0.72rem;
  opacity: 0.55;
  color: inherit;
  user-select: none;
  pointer-events: none;
}
</style>
