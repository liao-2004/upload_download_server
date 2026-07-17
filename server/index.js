import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_DIR = path.join(__dirname, 'storage')
const PORT = 3006

// 确保存储目录存在
fs.mkdirSync(STORAGE_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json())

/**
 * 把用户提供的文件名解析成 storage 目录下的安全绝对路径。
 * 阻止路径穿越（../）和绝对路径逃逸。返回 null 表示非法。
 */
function resolveSafe(name) {
  if (typeof name !== 'string' || name.length === 0) return null
  // 只取最后一段文件名，去掉任何目录成分
  const base = path.basename(name)
  if (!base || base === '.' || base === '..') return null
  const full = path.join(STORAGE_DIR, base)
  // 双保险：解析后必须仍在 STORAGE_DIR 内
  if (path.dirname(full) !== STORAGE_DIR) return null
  return full
}

// multer：把上传文件直接写入 storage，保留原始文件名（同名自动加序号）
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    // multer 默认用 latin1 解码，修正中文文件名
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const safeName = path.basename(original)
    cb(null, uniqueName(safeName))
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 单文件 100MB
})

// 若目标文件名已存在，追加 (1)/(2)… 生成不冲突的新名字
function uniqueName(name) {
  let candidate = name
  const ext = path.extname(name)
  const stem = path.basename(name, ext)
  let i = 1
  while (fs.existsSync(path.join(STORAGE_DIR, candidate))) {
    candidate = `${stem} (${i})${ext}`
    i++
  }
  return candidate
}

// --- 路由 ---

// 列出所有文件
app.get('/api/files', async (req, res) => {
  try {
    const names = await fsp.readdir(STORAGE_DIR)
    const files = []
    for (const name of names) {
      const stat = await fsp.stat(path.join(STORAGE_DIR, name))
      if (stat.isFile()) {
        files.push({
          name,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        })
      }
    }
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    res.json({ files })
  } catch (err) {
    res.status(500).json({ error: '读取文件列表失败：' + err.message })
  }
})

// 上传文件（表单字段名 file，支持多选）
app.post('/api/files/upload', upload.array('file', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '没有收到文件' })
  }
  res.json({
    message: '上传成功',
    files: req.files.map((f) => ({ name: f.filename, size: f.size })),
  })
})

// 创建文本文件（body: { name, content }）
app.post('/api/files', async (req, res) => {
  const { name, content = '' } = req.body || {}
  const full = resolveSafe(name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (fs.existsSync(full)) {
    return res.status(409).json({ error: '同名文件已存在' })
  }
  try {
    await fsp.writeFile(full, String(content), 'utf8')
    const stat = await fsp.stat(full)
    res.status(201).json({
      message: '创建成功',
      file: { name: path.basename(full), size: stat.size },
    })
  } catch (err) {
    res.status(500).json({ error: '创建失败：' + err.message })
  }
})

// 查看文件文本内容（仅返回文本，二进制文件请用下载）
app.get('/api/files/:name/content', async (req, res) => {
  const full = resolveSafe(req.params.name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  try {
    const stat = await fsp.stat(full)
    if (stat.size > 5 * 1024 * 1024) {
      return res.status(413).json({ error: '文件过大，请下载查看' })
    }
    const content = await fsp.readFile(full, 'utf8')
    res.json({ name: path.basename(full), size: stat.size, content })
  } catch (err) {
    res.status(500).json({ error: '读取失败：' + err.message })
  }
})

// 下载文件
app.get('/api/files/:name/download', (req, res) => {
  const full = resolveSafe(req.params.name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  res.download(full, path.basename(full))
})

// 删除文件
app.delete('/api/files/:name', async (req, res) => {
  const full = resolveSafe(req.params.name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  try {
    await fsp.unlink(full)
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: '删除失败：' + err.message })
  }
})

// multer 及其他错误统一处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: '上传错误：' + err.message })
  }
  console.error(err)
  res.status(500).json({ error: '服务器错误' })
})

app.listen(PORT, () => {
  console.log(`文件管理后端已启动: http://localhost:${PORT}`)
  console.log(`存储目录: ${STORAGE_DIR}`)
})
