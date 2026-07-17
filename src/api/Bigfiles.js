// 文件管理接口封装，统一走 /api（由 Vite 代理转发到 Express 后端）

const BASE = '/api/Big-files'

// 上传文件（FileList 或 File[]）
export async function uploadFiles(fileList) {
  const form = new FormData()
  for (const f of fileList) form.append('file', f)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  return handle(res)
}

export async function resumeUpload() {
    const res = fetch(`${BASE}/status`, { method: 'get',  params: { fileHash } })
    return
}

export async function SingleUpload(uploadedSize,progress,file,formData) {
    axios.post(`${BASE}/upload`, formData, {
      onUploadProgress(e) {
        uploadedSize += e.loaded
        progress.value = +(uploadedSize / file.size * 100).toFixed(2)
      }
    })
}

export async function Doneload( fileHash,file,chunks){
    axios.post(`${BASE}/merge`, {
    fileHash,
    fileName: file.name,
    totalChunks: chunks.length
  })
}
// 下载地址（直接给 <a href> 用）
export function downloadUrl(name) {
  return `${BASE}/${encodeURIComponent(name)}/download`
}
