// 大文件分片上传接口封装，统一走 /api/Big-files（由 Vite 代理 / Nginx 转发到后端）
import axios from 'axios'

const http = axios.create({ baseURL: '/api/Big-files' })

// 查询某文件已上传的分片索引（?fileHash=xxx），返回 { data: { uploaded: [...] } }
export async function resumeUpload(fileHash) {
  const { data } = await http.get('/status', { params: { fileHash } })
  return { data }
}

// 上传单个分片（formData 内含 chunk / chunkIndex / fileHash），返回 axios promise 便于 await
export async function SingleUpload(uploadedSize, progress, file, formData) {
  return http.post('/upload', formData, {
    onUploadProgress(e) {
      // e.loaded 为该分片已上传字节数；uploadedSize 为之前已上传总量
      const total = e.total || 0
      const loaded = uploadedSize + total
      if (file.size > 0) {
        progress.value = +((loaded / file.size) * 100).toFixed(2)
      }
    },
  })
}

// 合并分片
export async function Doneload(fileHash, file, chunks) {
  return http.post('/merge', {
    fileHash,
    fileName: file.name,
    totalChunks: chunks.length,
  })
}

// 下载地址（直接给 <a href> 用）
export function downloadUrl(name) {
  return `/api/Big-files/${encodeURIComponent(name)}/download`
}
