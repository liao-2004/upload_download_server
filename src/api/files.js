// 文件管理接口封装，统一走 /api（由 Vite 代理转发到 Express 后端）

const BASE = '/api/files'

async function handle(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }
  return data
}

// 获取文件列表
export async function listFiles() {
  const res = await fetch(BASE)
  const { files } = await handle(res)
  return files
}

// 上传文件（FileList 或 File[]）
export async function uploadFiles(fileList) {
  const form = new FormData()
  for (const f of fileList) form.append('file', f)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  return handle(res)
}

// 创建文本文件
export async function createFile(name, content) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  })
  return handle(res)
}

// 读取文本内容
export async function readContent(name) {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}/content`)
  return handle(res)
}

// 查询某文件的留言
export async function listComments(name) {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}/comments`)
  const { comments } = await handle(res)
  return comments || []
}

// 新增留言（name 为自定义昵称，可留空；后端会自动记录 IP）
export async function addComment(name, { name: customName, content }) {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: customName, content }),
  })
  return handle(res)
}

// 删除文件
export async function deleteFile(name) {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return handle(res)
}

// 锁定 / 解锁文件
export async function lockFile(name) {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}/lock`, { method: 'POST' })
  return handle(res)
}

export async function unlockFile(name) {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}/unlock`, { method: 'POST' })
  return handle(res)
}

// 批量删除（跳过已锁定的）
export async function deleteMany(names) {
  const res = await fetch(`${BASE}/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  })
  return handle(res)
}

// 全部删除（跳过已锁定的）
export async function deleteAll() {
  const res = await fetch(`${BASE}/delete-all`, { method: 'POST' })
  return handle(res)
}

// 下载地址（直接给 <a href> 用）
export function downloadUrl(name) {
  return `${BASE}/${encodeURIComponent(name)}/download`
}
