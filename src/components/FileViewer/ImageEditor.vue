<template>
  <div class="img-editor">
    <div class="editor-toolbar">
      <div class="mode-group">
        <button :class="{ active: mode === 'view' }" @click="mode = 'view'">查看</button>
        <button :class="{ active: mode === 'draw' }" :disabled="locked" @click="mode = 'draw'">划线</button>
        <button :class="{ active: mode === 'crop' }" :disabled="locked" @click="mode = 'crop'">裁剪</button>
      </div>
      <div class="tool-group">
        <button title="放大" class="tool" @click="zoom(1.25)">＋</button>
        <button title="缩小" class="tool" @click="zoom(1 / 1.25)">－</button>
        <button class="tool" @click="resetFit">复位</button>
        <button class="tool" :disabled="locked" @click="undoStroke">撤销</button>
      </div>
      <button v-if="cropBox && !locked" class="apply-crop" @click="applyCrop">应用裁剪</button>
      <button :disabled="locked || saving" class="save" @click="onSave">{{ saving ? '保存中…' : '保存图片' }}</button>
    </div>
    <div class="editor-canvas-wrap">
      <canvas
        ref="canvas"
        :width="W"
        :height="H"
        :class="mode"
        @wheel.prevent="onWheel"
        @mousedown="onDown"
        @mousemove="onMove"
        @mouseup="onUp"
        @mouseleave="onUp"
      ></canvas>
    </div>
    <p class="hint">滚轮缩放 · 「查看」模式拖动平移 · 「划线」模式在图上画红线标注 · 「裁剪」模式拖框后点应用裁剪</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { saveImage } from '@/api/files'

const props = defineProps({
  name: { type: String, required: true },
  url: { type: String, required: true },
  locked: { type: Boolean, default: false },
})
const emit = defineEmits(['saved'])

const W = 720
const H = 460

const canvas = ref(null)
let ctx = null
let img = null // HTMLImageElement 或 canvas

const scale = ref(1)
let tx = 0
let ty = 0
const mode = ref('view')
const strokes = ref([]) // 图片像素坐标 [[x,y],...] 数组
const cropBox = ref(null) // 显示坐标 {x,y,w,h}
const saving = ref(false)

let dragging = false
let drawing = false
let cropping = false
let startX = 0
let startY = 0
let lastTx = 0
let lastTy = 0
let curStroke = null
let cropStart = null

function paint() {
  if (!ctx || !img) return
  ctx.fillStyle = '#0b0b0b'
  ctx.fillRect(0, 0, W, H)
  const iw = img.width || img.naturalWidth
  const ih = img.height || img.naturalHeight
  ctx.drawImage(img, tx, ty, iw * scale.value, ih * scale.value)

  // 划线（图片像素坐标 → 显示坐标）
  ctx.strokeStyle = '#ff3b30'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of strokes.value) {
    ctx.beginPath()
    s.forEach((p, i) => {
      const dx = p[0] * scale.value + tx
      const dy = p[1] * scale.value + ty
      if (i === 0) ctx.moveTo(dx, dy)
      else ctx.lineTo(dx, dy)
    })
    ctx.stroke()
  }

  // 裁剪框
  if (cropBox.value) {
    const b = cropBox.value
    ctx.strokeStyle = '#2ee6a8'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.strokeRect(b.x, b.y, b.w, b.h)
    ctx.setLineDash([])
  }
}

function resetFit() {
  if (!img) return
  const iw = img.width || img.naturalWidth
  const ih = img.height || img.naturalHeight
  scale.value = Math.min(W / iw, H / ih)
  tx = (W - iw * scale.value) / 2
  ty = (H - ih * scale.value) / 2
  cropBox.value = null
  paint()
}

function zoom(f) {
  const cx = W / 2
  const cy = H / 2
  const ns = clamp(scale.value * f)
  tx = cx - (cx - tx) * (ns / scale.value)
  ty = cy - (cy - ty) * (ns / scale.value)
  scale.value = ns
  paint()
}

function clamp(s) {
  return Math.max(0.1, Math.min(12, s))
}

function onWheel(e) {
  const rect = canvas.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const f = 1 - e.deltaY * 0.0015
  const ns = clamp(scale.value * f)
  tx = mx - (mx - tx) * (ns / scale.value)
  ty = my - (my - ty) * (ns / scale.value)
  scale.value = ns
  paint()
}

function getPos(e) {
  const rect = canvas.value.getBoundingClientRect()
  return [e.clientX - rect.left, e.clientY - rect.top]
}

function onDown(e) {
  if (!img) return
  const [mx, my] = getPos(e)
  if (mode.value === 'view') {
    dragging = true
    startX = mx
    startY = my
    lastTx = tx
    lastTy = ty
  } else if (mode.value === 'draw') {
    drawing = true
    const ix = (mx - tx) / scale.value
    const iy = (my - ty) / scale.value
    curStroke = [[ix, iy]]
    strokes.value.push(curStroke)
    paint()
  } else if (mode.value === 'crop') {
    cropping = true
    cropStart = [mx, my]
    cropBox.value = null
  }
}

function onMove(e) {
  if (!img) return
  const [mx, my] = getPos(e)
  if (dragging) {
    tx = lastTx + (mx - startX)
    ty = lastTy + (my - startY)
    paint()
  } else if (drawing && curStroke) {
    const ix = (mx - tx) / scale.value
    const iy = (my - ty) / scale.value
    curStroke.push([ix, iy])
    paint()
  } else if (cropping && cropStart) {
    const x = Math.min(cropStart[0], mx)
    const y = Math.min(cropStart[1], my)
    const w = Math.abs(mx - cropStart[0])
    const h = Math.abs(my - cropStart[1])
    cropBox.value = { x, y, w, h }
    paint()
  }
}

function onUp() {
  dragging = false
  drawing = false
  cropping = false
  curStroke = null
  cropStart = null
}

function undoStroke() {
  strokes.value.pop()
  paint()
}

async function applyCrop() {
  if (!cropBox.value || !img) return
  const b = cropBox.value
  const sx = (b.x - tx) / scale.value
  const sy = (b.y - ty) / scale.value
  const sw = Math.max(1, b.w / scale.value)
  const sh = Math.max(1, b.h / scale.value)
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  // 保留落在裁剪区内的划线，并平移到新坐标
  const kept = []
  for (const s of strokes.value) {
    const ns = s
      .filter((p) => p[0] >= sx && p[0] <= sx + sw && p[1] >= sy && p[1] <= sy + sh)
      .map((p) => [p[0] - sx, p[1] - sy])
    if (ns.length) kept.push(ns)
  }
  strokes.value = kept
  await loadImageFromCanvas(c)
  resetFit()
}

function loadImageFromCanvas(c) {
  return new Promise((resolve) => {
    const im = new Image()
    im.onload = () => {
      img = im
      resolve()
    }
    im.src = c.toDataURL('image/png')
  })
}

async function onSave() {
  if (!img) return
  saving.value = true
  try {
    const iw = img.width || img.naturalWidth
    const ih = img.height || img.naturalHeight
    const out = document.createElement('canvas')
    out.width = iw
    out.height = ih
    const octx = out.getContext('2d')
    octx.drawImage(img, 0, 0)
    if (strokes.value.length) {
      octx.strokeStyle = '#ff3b30'
      octx.lineWidth = 2.5
      octx.lineCap = 'round'
      octx.lineJoin = 'round'
      for (const s of strokes.value) {
        octx.beginPath()
        s.forEach((p, i) => {
          if (i === 0) octx.moveTo(p[0], p[1])
          else octx.lineTo(p[0], p[1])
        })
        octx.stroke()
      }
    }
    const blob = await new Promise((r) => out.toBlob(r, 'image/png'))
    await saveImage(props.name, blob)
    emit('saved', props.name)
  } catch (e) {
    alert('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  ctx = canvas.value.getContext('2d')
  await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => {
      img = im
      resetFit()
      resolve()
    }
    im.onerror = reject
    im.src = props.url
  })
})

onBeforeUnmount(() => {
  canvas.value = null
})
</script>

<style scoped>
.img-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem 1rem;
}
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.editor-toolbar button {
  cursor: pointer;
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  border-radius: 6px;
  border: 1px solid var(--color-border, #444);
  background: transparent;
  color: inherit;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.mode-group {
  display: inline-flex;
  border: 1px solid var(--color-border, #444);
  border-radius: 8px;
  overflow: hidden;
}
.mode-group button {
  border: none;
  border-radius: 0;
  padding: 0.35rem 0.9rem;
  color: inherit;
  background: transparent;
  border-right: 1px solid var(--color-border, #444);
}
.mode-group button:last-child {
  border-right: none;
}
.mode-group button:hover {
  background: hsla(160, 100%, 37%, 0.12);
}
.mode-group button.active {
  background: hsla(160, 100%, 37%, 1);
  color: #fff;
}
.tool-group {
  display: inline-flex;
  gap: 0.25rem;
}
.tool {
  min-width: 2rem;
  text-align: center;
}
.apply-crop {
  background: #e0a94f !important;
  border-color: #e0a94f !important;
  color: #1a1a1a !important;
  font-weight: 600;
}
.apply-crop:hover {
  filter: brightness(1.08);
}
.save {
  margin-left: auto;
  background: hsla(160, 100%, 37%, 1) !important;
  color: #fff !important;
  border-color: hsla(160, 100%, 37%, 1) !important;
}
.save:disabled {
  opacity: 0.6;
  cursor: default;
}
.mode-group button:disabled,
.tool:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.editor-canvas-wrap {
  display: flex;
  justify-content: center;
  background: #0b0b0b;
  border-radius: 6px;
  overflow: auto;
}
.editor-canvas-wrap canvas {
  max-width: 100%;
}
.editor-canvas-wrap canvas.draw {
  cursor: crosshair;
}
.editor-canvas-wrap canvas.crop {
  cursor: cell;
}
.hint {
  font-size: 0.78rem;
  opacity: 0.65;
  margin: 0;
}
</style>
