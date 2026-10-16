<template>
  <main class="fm">
    <h1>文件管理</h1>

    <p v-if="message" :class="['toast', message.type]">{{ message.text }}</p>

    <section class="panels">
      <!-- 上传小文件 -->
      <div class="card">
        <BigUpload>
          <template v-slot:Uploadheader>
            <h2>上传小型文件</h2>
          </template>
          <template v-slot:Uploadmain>
            <p class="hint">从电脑选择文件上传到服务器（支持多选，单文件最大 100MB）。</p>
          </template>
          <template v-slot:Uploadbutton>
            <input
          ref="fileInput"
          type="file"
          multiple
          :disabled="uploading"
          @change="onUpload"
        />
          </template>
          <template v-slot:uploadfooler>
            <span v-if="uploading" class="hint">上传中…</span>
          </template>
        </BigUpload>

        <!-- 上传大文件 -->
        <Upload></Upload>
      </div>

      <!-- 新建文本文件 -->
      <div class="card">
        <h2>新建文本文件</h2>
        <input v-model="newName" placeholder="文件名，如 note.txt" />
        <textarea v-model="newContent" rows="4" placeholder="文件内容（可留空）"></textarea>
        <button @click="onCreate">创建</button>
      </div>
    </section>

    <!-- 文件列表 -->
    <section class="card">
      <div class="list-head">
        <h2>服务器文件</h2>
        <div class="list-head-btns">
          <button class="ghost danger" @click="onDeleteAll">全部删除</button>
          <button class="ghost" @click="refresh">刷新</button>
        </div>
      </div>

      <div v-if="selected.size > 0" class="batch-bar">
        <span class="hint">已选 {{ selected.size }} 个文件</span>
        <button class="ghost danger" @click="onBatchDelete">批量删除</button>
        <button class="ghost" @click="clearSelection">取消选择</button>
      </div>

      <p v-if="loading" class="hint">加载中…</p>
      <p v-else-if="files.length === 0" class="hint">暂无文件</p>

      <div v-else class="table-scroll">
        <table class="files">
        <thead>
          <tr>
            <th class="sel"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
            <th>文件名</th>
            <th>大小</th>
            <th>修改时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="f in files" :key="f.name">
            <tr>
              <td class="sel">
                <input
                  type="checkbox"
                  :checked="selected.has(f.name)"
                  :disabled="f.locked"
                  @change="toggleSelect(f.name)"
                />
              </td>
              <td class="name">
                {{ f.name }}
                <span v-if="f.locked" class="lock-badge">已锁定</span>
              </td>
              <td>{{ formatSize(f.size) }}</td>
              <td>{{ formatTime(f.modifiedAt) }}</td>
              <td class="actions">
                <button class="ghost" @click="onView(f.name)">查看</button>
                <a class="btn ghost" :href="downloadUrl(f.name)">下载</a>
                <button class="ghost" :class="f.locked ? 'lock-on' : ''" @click="onToggleLock(f)">
                  {{ f.locked ? '解锁' : '锁定' }}
                </button>
                <button
                  class="ghost"
                  :style="{border:'0px'}"
                  :class="commentOpen[f.name] ? 'comment-open' : ''"
                  :title="'留言 ' + (f.commentCount || 0)"
                  @click="toggleComments(f.name)"
                >
                  <span class="chev" :style="{fontSize:'26px'}">{{ commentOpen[f.name] ? '▴' : '▾' }}</span>
                  <span v-if="f.commentCount" class="count-badge">{{ f.commentCount }}</span>
                </button>
              </td>
            </tr>
            <!-- 文件下的留言区 -->
            <tr v-if="commentOpen[f.name]" class="comment-row">
              <td colspan="5">
                <div class="comment-box">
                  <div class="comment-head">
                    <span class="hint">留言（{{ (comments[f.name] || []).length }}）</span>
                  </div>

                  <p v-if="commentLoading[f.name]" class="hint">加载留言中…</p>
                  <p v-else-if="(comments[f.name] || []).length === 0" class="hint">暂无留言</p>
                  <ul v-else class="comment-list">
                    <li v-for="c in comments[f.name]" :key="c.id">
                      <div class="comment-meta">
                        <strong class="c-name">{{ c.name || c.ip || '匿名' }}</strong> 
                        <time>{{ formatTime(c.createdAt) }}</time>
                        <button
                          class="del"
                          title="删除这条留言"
                          @click="onDeleteComment(f, c.id)"
                        >×</button>
                      </div>
                      <div class="c-content">{{ c.content }}</div>
                    </li>
                  </ul>

                  <form class="comment-form" @submit.prevent="onComment(f)">
                    <input
                      v-model="draft(f.name).name"
                      placeholder="自定义昵称（可留空，默认显示IP）"
                    />
                    <textarea
                      v-model="draft(f.name).text"
                      rows="2"
                      placeholder="写下留言…"
                    ></textarea>
                    <div class="comment-form-foot">
                      <button class="ghost" :disabled="commentSending[f.name]">
                        {{ commentSending[f.name] ? '发送中…' : '发送' }}
                      </button>
                    </div>
                  </form>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        </table>
      </div>
    </section>

    <!-- 查看弹窗 -->
    <div v-if="viewer" class="modal" @click.self="viewer = null">
      <div class="modal-box">
        <div class="modal-head">
          <h3>{{ viewer.name }}</h3>
          <button class="ghost" @click="viewer = null">关闭</button>
        </div>
        <pre>{{ viewer.content }}</pre>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  listFiles,
  uploadFiles,
  createFile,
  readContent,
  downloadUrl,
  listComments,
  addComment,
  deleteComment,
  lockFile,
  unlockFile,
  deleteMany,
  deleteAll,
} from '@/api/files'
import Upload from '@/components/BigUpload/Upload.vue'
import BigUpload from '@/components/BigUpload/BigUpload.vue'
const files = ref([])
const loading = ref(false)
const message = ref(null) // { type: 'ok' | 'err', text }

// 新建文本文件表单
const newName = ref('')
const newContent = ref('')

// 上传
const fileInput = ref(null)
const uploading = ref(false)

// 查看文件弹窗
const viewer = ref(null) // { name, content } | null

// 批量选择：选中（未锁定）的文件名集合
const selected = reactive(new Set())
const selectedCount = computed(() => selected.size)
const allSelected = computed(
  () => files.value.length > 0 && files.value.every((f) => f.locked || selected.has(f.name)),
)

function toggleSelect(name) {
  if (selected.has(name)) selected.delete(name)
  else selected.add(name)
}

function toggleAll(e) {
  if (e.target.checked) {
    files.value.forEach((f) => {
      if (!f.locked) selected.add(f.name)
    })
  } else {
    selected.clear()
  }
}

function clearSelection() {
  selected.clear()
}

// 锁定 / 解锁
async function onToggleLock(f) {
  try {
    if (f.locked) {
      await unlockFile(f.name)
      f.locked = false
      notify('ok', '已解锁')
    } else {
      await lockFile(f.name)
      f.locked = true
      notify('ok', '已锁定')
    }
  } catch (e) {
    notify('err', e.message)
  }
}

// 批量删除（仅删除选中的、未锁定的文件）
async function onBatchDelete() {
  if (selected.size === 0) return
  if (!confirm(`确定删除选中的 ${selected.size} 个文件？已锁定的文件会被跳过。`)) return
  try {
    const r = await deleteMany([...selected])
    notify('ok', r.message)
    clearSelection()
    refresh()
  } catch (e) {
    notify('err', e.message)
  }
}

// 全部删除（跳过已锁定的文件）
async function onDeleteAll() {
  const total = files.value.length
  if (total === 0) {
    notify('err', '没有可删除的文件')
    return
  }
  const lockedCount = files.value.filter((f) => f.locked).length
  const msg = lockedCount
    ? `共 ${total} 个文件，其中 ${lockedCount} 个已锁定将被跳过。确定删除其余文件？`
    : `确定删除全部 ${total} 个文件？`
  if (!confirm(msg)) return
  try {
    const r = await deleteAll()
    notify('ok', r.message)
    clearSelection()
    refresh()
  } catch (e) {
    notify('err', e.message)
  }
}

// 留言：按文件名保存展开状态、留言列表、草稿、加载/发送状态
const commentOpen = reactive({})
const comments = reactive({})
const commentDraft = reactive({})
const commentLoading = reactive({})
const commentSending = reactive({})

// 取（并初始化）某个文件的留言表单草稿
function draft(name) {
  if (!commentDraft[name]) commentDraft[name] = { name: '', text: '' }
  return commentDraft[name]
}

// 删除一条留言
async function onDeleteComment(f, id) {
  if (!confirm('确定删除这条留言？')) return
  try {
    await deleteComment(f.name, id)
    comments[f.name] = (comments[f.name] || []).filter((c) => c.id !== id)
    f.commentCount = Math.max(0, (f.commentCount || 0) - 1)
    notify('ok', '留言已删除')
  } catch (e) {
    notify('err', e.message)
  }
}

// 展开 / 收起某文件的留言区，首次展开时加载留言
async function toggleComments(name) {
  commentOpen[name] = !commentOpen[name]
  if (commentOpen[name] && !comments[name]) {
    commentLoading[name] = true
    try {
      comments[name] = await listComments(name)
    } catch (e) {
      notify('err', e.message)
    } finally {
      commentLoading[name] = false
    }
  }
}

// 提交留言
async function onComment(f) {
  const name = f.name
  const d = draft(name)
  const text = (d.text || '').trim()
  if (!text) {
    notify('err', '请输入留言内容')
    return
  }
  commentSending[name] = true
  try {
    const c = await addComment(name, { name: (d.name || '').trim(), content: text })
    if (!comments[name]) comments[name] = []
    comments[name].unshift(c) // 后端返回倒序，新留言放最前
    f.commentCount = (f.commentCount || 0) + 1
    d.text = ''
    notify('ok', '留言成功')
  } catch (e) {
    notify('err', e.message)
  } finally {
    commentSending[name] = false
  }
}

function notify(type, text) {
  message.value = { type, text }
  setTimeout(() => {
    if (message.value?.text === text) message.value = null
  }, 3000)
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

async function refresh() {
  loading.value = true
  try {
    files.value = await listFiles()
  } catch (e) {
    notify('err', e.message)
  } finally {
    loading.value = false
  }
}

// 10 秒静默轮询：刷新文件列表 + 已展开的留言区
let pollTimer = null

async function autoRefresh() {
  try {
    files.value = await listFiles()
  } catch (e) {
    // 后台刷新失败静默，不影响用户操作
  }
  const names = Object.keys(commentOpen)
  for (const name of names) {
    if (!commentOpen[name]) continue
    try {
      comments[name] = await listComments(name)
    } catch (e) {
      // 静默
    }
  }
}

onMounted(() => {
  refresh()
  pollTimer = setInterval(autoRefresh, 10000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function onCreate() {
  if (!newName.value.trim()) {
    notify('err', '请输入文件名')
    return
  }
  try {
    await createFile(newName.value.trim(), newContent.value)
    notify('ok', '创建成功')
    newName.value = ''
    newContent.value = ''
    refresh()
  } catch (e) {
    notify('err', e.message)
  }
}

async function onUpload(event) {
  const selected = event.target.files
  if (!selected || selected.length === 0) return
  uploading.value = true
  try {
    const res = await uploadFiles(selected)
    notify('ok', `上传成功：${res.files.length} 个文件`)
    refresh()
  } catch (e) {
    notify('err', e.message)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function onView(name) {
  try {
    viewer.value = await readContent(name)
  } catch (e) {
    notify('err', e.message)
  }
}
</script>

<style scoped>
.fm {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}
h1 {
  font-size: 1.6rem;
  margin-bottom: 1rem;
}
h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}
.panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (max-width: 720px) {
  .panels {
    grid-template-columns: 1fr;
  }
}
.card {
  border: 1px solid var(--color-border, #444);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.hint {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0.4rem 0;
}
input,
textarea {
  display: block;
  width: 100%;
  margin-bottom: 0.6rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border, #444);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  /* 输入框只允许上下拉伸，禁止左右拉伸 */
  resize: vertical;
}
button,
.btn {
  cursor: pointer;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--color-border, #444);
  border-radius: 6px;
  background: hsla(160, 100%, 37%, 1);
  color: #fff;
  font-size: 0.9rem;
  text-decoration: none;
  display: inline-block;
}
button.ghost,
.btn.ghost {
  background: transparent;
  color: inherit;
}
button.danger {
  color: #e05a5a;
  border-color: #e05a5a;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.list-head-btns {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
  padding: 0.5rem 0.7rem;
  border: 1px dashed var(--color-border, #444);
  border-radius: 6px;
}
.batch-bar .hint {
  margin: 0;
}
.files {
  width: 100%;
  border-collapse: collapse;
}
.files th,
.files td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border, #333);
  font-size: 0.9rem;
}
.files .name {
  word-break: break-all;
}
/* 响应式：窄屏时表格整体横向滚动 */
.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
@media (max-width: 760px) {
  .files {
    min-width: 620px;
  }
  .fm {
    padding: 1rem;
  }
  h1 {
    font-size: 1.3rem;
  }
  .actions {
    gap: 0.25rem;
  }
  .actions button,
  .actions .btn {
    padding: 0.3rem 0.6rem;
    font-size: 0.82rem;
  }
}
.files .sel {
  width: 2rem;
  text-align: center;
}
.files input[type='checkbox'] {
  width: auto;
  display: inline-block;
  margin: 0;
  vertical-align: middle;
}
.lock-badge {
  margin-left: 0.4rem;
  font-size: 0.7rem;
  color: #e0a94f;
  border: 1px solid rgba(224, 169, 79, 0.5);
  border-radius: 4px;
  padding: 0 0.35rem;
  white-space: nowrap;
}
button.lock-on {
  color: #e0a94f;
  border-color: rgba(224, 169, 79, 0.6);
}
.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
/* 文件下的留言区 */
.comment-row td {
  background: hsla(160, 100%, 37%, 0.04);
}
.comment-box {
  padding: 0.25rem 0.5rem;
}
.comment-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}
.comment-list {
  list-style: none;
  margin: 0 0 0.6rem;
  padding: 0;
  max-height: 240px;
  overflow: auto;
}
.comment-list li {
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  margin-bottom: 0.4rem;
  background: var(--color-background, #1a1a1a);
}
.comment-meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}
.c-name {
  font-size: 0.85rem;
  color: hsla(160, 100%, 37%, 1);
}
.c-ip {
  opacity: 0.55;
  font-size: 0.75rem;
}
.comment-meta time {
  opacity: 0.6;
  margin-left: auto;
}
.comment-meta .del {
  border: none;
  background: transparent;
  color: #e05a5a;
  cursor: pointer;
  font-size: 1.05rem;
  line-height: 1;
  padding: 0 0.2rem;
  opacity: 0.7;
}
.comment-meta .del:hover {
  opacity: 1;
  background: rgba(224, 90, 90, 0.15);
  border-radius: 4px;
}
.c-content {
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: inherit;
}
.comment-form textarea {
  margin-bottom: 0.5rem;
  resize: vertical; /* 只允许上下拉伸 */
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.comment-form-foot {
  text-align: right;
}
/* 文件行的留言入口：下拉箭头 + 数量徽标 */
.chev {
  font-size: 0.7rem;
  line-height: 1;
  color: #757171;
}
button.comment-open {
  color: hsla(160, 100%, 37%, 1);
  border-color: hsla(160, 100%, 37%, 0.5);
}
.count-badge { 
  font-size: 0.72rem; 
  color: hsla(160, 100%, 37%, 1);
  border-radius: 10px;
  padding: 0 0.4rem;
  line-height: 1.3;
}
.toast {
  padding: 0.6rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}
.toast.ok {
  background: hsla(160, 100%, 37%, 0.15);
  border: 1px solid hsla(160, 100%, 37%, 0.5);
}
.toast.err {
  background: rgba(224, 90, 90, 0.15);
  border: 1px solid rgba(224, 90, 90, 0.5);
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
}
.modal-box {
  background: var(--color-background, #1a1a1a);
  border: 1px solid var(--color-border, #444);
  border-radius: 8px;
  max-width: 800px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border, #444);
}
.modal-box pre {
  padding: 1rem;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
