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
        <button class="ghost" @click="refresh">刷新</button>
      </div>

      <p v-if="loading" class="hint">加载中…</p>
      <p v-else-if="files.length === 0" class="hint">暂无文件</p>

      <table v-else class="files">
        <thead>
          <tr>
            <th>文件名</th>
            <th>大小</th>
            <th>修改时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in files" :key="f.name">
            <td class="name">{{ f.name }}</td>
            <td>{{ formatSize(f.size) }}</td>
            <td>{{ formatTime(f.modifiedAt) }}</td>
            <td class="actions">
              <button class="ghost" @click="onView(f.name)">查看</button>
              <a class="btn ghost" :href="downloadUrl(f.name)">下载</a>
              <button class="ghost danger" @click="onDelete(f.name)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
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
import { ref, onMounted } from 'vue'
import {
  listFiles,
  uploadFiles,
  createFile,
  readContent,
  deleteFile,
  downloadUrl,
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

async function onDelete(name) {
  if (!confirm(`确定删除「${name}」？`)) return
  try {
    await deleteFile(name)
    notify('ok', '删除成功')
    refresh()
  } catch (e) {
    notify('err', e.message)
  }
}

onMounted(refresh)
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
.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
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
