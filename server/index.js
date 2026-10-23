import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_DIR = path.join(__dirname, 'storage')
const PORT = 3008

// 确保存储目录存在
fs.mkdirSync(STORAGE_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json())
// 启用信任代理，便于拿到 X-Forwarded-For 中的真实客户端 IP
app.set('trust proxy', true)

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

// 锁定状态持久化（不放入 storage，避免出现在文件列表）
const LOCKS_FILE = path.join(__dirname, 'locks.json')

async function loadLocks() {
  try {
    const raw = await fsp.readFile(LOCKS_FILE, 'utf8')
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
}

async function saveLocks(data) {
  await fsp.writeFile(LOCKS_FILE, JSON.stringify(data, null, 2), 'utf8')
}

// 留言以 JSON 文件持久化在 server 目录下（不放入 storage，避免出现在文件列表）
const COMMENTS_FILE = path.join(__dirname, 'comments.json')

// 顶部横幅配置（放在 server 根目录，和 comments.json 同级）
const NOTICE_FILE = path.join(__dirname, 'notice.json')
const DEFAULT_NOTICE = {
  url: 'https://www.aliyun.com/benefit?tid=product&utm_content=se_1023591267',
  content: '服务至2026年12月1日到期、请及时续费，以免影响正常使用，谢谢配合！',
  highlight: '2026年12月1日',
}

// 右下角广告配置（放在 server 根目录）
const AD_FILE = path.join(__dirname, 'ad.json')
// 广告图片目录：server/public（图片放这里，通过 /api/ad/image/:name 供前端加载）
const AD_IMG_DIR = path.join(__dirname, 'public')
const DEFAULT_AD = {
  enabled: true,
  url: 'https://example.com',
  title: '推广',
  text: '这里放你的推广文案，例如：点击了解最新优惠活动',
  image: '', // 可选：图片路径，如 /api/ad/image/xx.png
}

async function loadComments() {
  try {
    const raw = await fsp.readFile(COMMENTS_FILE, 'utf8')
    return JSON.parse(raw) || {}
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
}

async function saveComments(data) {
  await fsp.writeFile(COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf8')
}

// 列出所有文件
app.get('/api/files', async (req, res) => {
  try {
    const names = await fsp.readdir(STORAGE_DIR)
    const locks = await loadLocks()
    const comments = await loadComments()
    const files = []
    for (const name of names) {
      const stat = await fsp.stat(path.join(STORAGE_DIR, name))
      if (stat.isFile()) {
        files.push({
          name,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          locked: !!locks[name],
          commentCount: (comments[name] || []).length,
        })
      }
    }
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    res.json({ files })
  } catch (err) {
    res.status(500).json({ error: '读取文件列表失败：' + err.message })
  }
})

// 顶部横幅配置
app.get('/api/notice', async (req, res) => {
  try {
    const raw = await fsp.readFile(NOTICE_FILE, 'utf8')
    const data = JSON.parse(raw)
    res.json({ ...DEFAULT_NOTICE, ...data })
  } catch (e) {
    if (e.code === 'ENOENT') return res.json(DEFAULT_NOTICE)
    res.status(500).json({ error: '读取横幅配置失败：' + e.message })
  }
})

// 右下角广告配置
app.get('/api/ad', async (req, res) => {
  try {
    const raw = await fsp.readFile(AD_FILE, 'utf8')
    const data = JSON.parse(raw)
    res.json({ ...DEFAULT_AD, ...data })
  } catch (e) {
    if (e.code === 'ENOENT') return res.json(DEFAULT_AD)
    res.status(500).json({ error: '读取广告配置失败：' + e.message })
  }
})

// 广告图片：从 server/public 目录按文件名返回（防路径穿越）
app.get('/api/ad/image/:name', (req, res) => {
  const name = path.basename(req.params.name)
  if (!name || name === '.' || name === '..') {
    return res.status(400).json({ error: '文件名非法' })
  }
  const full = path.join(AD_IMG_DIR, name)
  if (path.dirname(full) !== AD_IMG_DIR) {
    return res.status(400).json({ error: '文件名非法' })
  }
  if (!fs.existsSync(full)) return res.status(404).json({ error: '图片不存在' })
  res.sendFile(full)
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

// 在线编辑并保存文本文件内容（body: { content }）
app.put('/api/files/:name/content', async (req, res) => {
  const full = resolveSafe(req.params.name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  const { content = '' } = req.body || {}
  try {
    await fsp.writeFile(full, String(content), 'utf8')
    const stat = await fsp.stat(full)
    res.json({ message: '保存成功', name: path.basename(full), size: stat.size })
  } catch (err) {
    res.status(500).json({ error: '保存失败：' + err.message })
  }
})

// 在线编辑图片后保存回原文件（multipart: field 'image'）
app.post('/api/files/:name/image', async (req, res) => {
  const full = resolveSafe(req.params.name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  try {
    const mem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single('image')
    mem(req, res, async (err) => {
      if (err) return res.status(500).json({ error: '图片接收失败：' + err.message })
      if (!req.file || !req.file.buffer) return res.status(400).json({ error: '未收到图片数据' })
      try {
        await fsp.writeFile(full, req.file.buffer)
        const stat = await fsp.stat(full)
        res.json({ message: '图片已保存', name: path.basename(full), size: stat.size })
      } catch (e) {
        res.status(500).json({ error: '图片保存失败：' + e.message })
      }
    })
  } catch (err) {
    res.status(500).json({ error: '图片保存失败：' + err.message })
  }
})

// 下载文件
app.get('/api/files/:name/download', (req, res) => {
  const full = resolveSafe(req.params.name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  res.download(full, path.basename(full))
})

// 锁定文件
app.post('/api/files/:name/lock', async (req, res) => {
  const name = path.basename(req.params.name)
  const full = resolveSafe(name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  try {
    const locks = await loadLocks()
    locks[name] = true
    await saveLocks(locks)
    res.json({ message: '已锁定', name })
  } catch (err) {
    res.status(500).json({ error: '锁定失败：' + err.message })
  }
})

// 解锁文件
app.post('/api/files/:name/unlock', async (req, res) => {
  const name = path.basename(req.params.name)
  const full = resolveSafe(name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  try {
    const locks = await loadLocks()
    delete locks[name]
    await saveLocks(locks)
    res.json({ message: '已解锁', name })
  } catch (err) {
    res.status(500).json({ error: '解锁失败：' + err.message })
  }
})

// 删除单个文件（已锁定的拒绝删除）
app.delete('/api/files/:name', async (req, res) => {
  const name = path.basename(req.params.name)
  const full = resolveSafe(name)
  if (!full) return res.status(400).json({ error: '文件名非法' })
  if (!fs.existsSync(full)) return res.status(404).json({ error: '文件不存在' })
  try {
    const locks = await loadLocks()
    if (locks[name]) {
      return res.status(409).json({ error: '文件已锁定，请先解锁再删除' })
    }
    await fsp.unlink(full)
    delete locks[name]
    // 同步删除该文件的留言
    const allComments = await loadComments()
    if (allComments[name]) {
      delete allComments[name]
      await saveComments(allComments)
    }
    await saveLocks(locks)
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: '删除失败：' + err.message })
  }
})

// 批量删除（body: { names: [] }，跳过不存在的和已锁定的）
app.post('/api/files/batch-delete', async (req, res) => {
  const { names } = req.body || {}
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: '未指定要删除的文件' })
  }
  try {
    const locks = await loadLocks()
    const allComments = await loadComments()
    const deleted = []
    const skipped = []
    let commentsChanged = false
    for (const raw of names) {
      const name = path.basename(String(raw))
      const full = resolveSafe(name)
      if (!full) {
        skipped.push({ name, reason: '文件名非法' })
        continue
      }
      if (!fs.existsSync(full)) {
        skipped.push({ name, reason: '文件不存在' })
        continue
      }
      if (locks[name]) {
        skipped.push({ name, reason: '已锁定' })
        continue
      }
      await fsp.unlink(full)
      delete locks[name]
      // 同步删除该文件的留言
      if (allComments[name]) {
        delete allComments[name]
        commentsChanged = true
      }
      deleted.push(name)
    }
    if (commentsChanged) await saveComments(allComments)
    await saveLocks(locks)
    res.json({ message: `删除成功 ${deleted.length} 个`, deleted, skipped })
  } catch (err) {
    res.status(500).json({ error: '批量删除失败：' + err.message })
  }
})

// 全部删除（跳过已锁定的）
app.post('/api/files/delete-all', async (req, res) => {
  try {
    const names = await fsp.readdir(STORAGE_DIR)
    const locks = await loadLocks()
    const allComments = await loadComments()
    let deleted = 0
    const skipped = []
    let commentsChanged = false
    for (const name of names) {
      const full = path.join(STORAGE_DIR, name)
      const stat = await fsp.stat(full).catch(() => null)
      if (!stat || !stat.isFile()) continue
      if (locks[name]) {
        skipped.push(name)
        continue
      }
      await fsp.unlink(full)
      delete locks[name]
      // 同步删除该文件的留言
      if (allComments[name]) {
        delete allComments[name]
        commentsChanged = true
      }
      deleted++
    }
    if (commentsChanged) await saveComments(allComments)
    await saveLocks(locks)
    res.json({ message: `已删除 ${deleted} 个文件`, deleted, skipped })
  } catch (err) {
    res.status(500).json({ error: '全部删除失败：' + err.message })
  }
})

// --- 留言功能 ---

// 获取客户端真实 IP（优先 X-Forwarded-For，其次 socket 地址）
function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return (req.socket && req.socket.remoteAddress) || req.ip || ''
}

// 查询某文件下的留言（按时间倒序）
app.get('/api/files/:name/comments', async (req, res) => {
  const name = req.params.name
  try {
    const all = await loadComments()
    const list = (all[name] || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json({ comments: list })
  } catch (err) {
    res.status(500).json({ error: '读取留言失败：' + err.message })
  }
})

// 新增留言（body: { name?, content }），自动记录发送人 IP
app.post('/api/files/:name/comments', async (req, res) => {
  const name = req.params.name
  const { name: customName, content } = req.body || {}
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '留言内容不能为空' })
  }
  try {
    const all = await loadComments()
    if (!Array.isArray(all[name])) all[name] = []
    const comment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: typeof customName === 'string' ? customName.trim() : '',
      ip: clientIp(req),
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }
    all[name].push(comment)
    await saveComments(all)
    res.status(201).json({ message: '留言成功', comment })
  } catch (err) {
    res.status(500).json({ error: '留言失败：' + err.message })
  }
})

// --- 大文件分片上传 ---
// 分片暂存目录（不放 storage，避免出现在文件列表）
const CHUNKS_DIR = path.join(__dirname, 'chunks')

// 分片用内存暂存，路由里再写盘（这样 body 里 fileHash/chunkIndex 一定已解析）
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 单分片最大 50MB
})

// 文件哈希只保留安全字符，防止路径穿越
function safeHash(h) {
  return String(h || '').replace(/[^a-zA-Z0-9_-]/g, '')
}

// 上传单个分片（multipart：chunk 文件 + fileHash + chunkIndex）
app.post('/api/Big-files/upload', chunkUpload.single('chunk'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到分片' })
  const fileHash = safeHash(req.body.fileHash)
  const chunkIndex = Number(req.body.chunkIndex)
  if (!fileHash) return res.status(400).json({ error: '缺少 fileHash' })
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return res.status(400).json({ error: 'chunkIndex 非法' })
  }
  try {
    const dir = path.join(CHUNKS_DIR, fileHash)
    fs.mkdirSync(dir, { recursive: true })
    await fsp.writeFile(path.join(dir, String(chunkIndex)), req.file.buffer)
    res.json({ ok: true, chunkIndex })
  } catch (err) {
    res.status(500).json({ error: '分片保存失败：' + err.message })
  }
})

// 查询某文件已上传的分片索引（?fileHash=xxx）
app.get('/api/Big-files/status', async (req, res) => {
  const fileHash = safeHash(req.query.fileHash)
  if (!fileHash) return res.status(400).json({ error: '缺少 fileHash' })
  const dir = path.join(CHUNKS_DIR, fileHash)
  let uploaded = []
  try {
    const names = await fsp.readdir(dir)
    uploaded = names
      .filter((n) => /^\d+$/.test(n))
      .map(Number)
      .sort((a, b) => a - b)
  } catch (e) {
    // 目录不存在 → 视为 0 个分片
  }
  res.json({ uploaded })
})

// 合并分片（body: { fileHash, fileName, totalChunks }）
app.post('/api/Big-files/merge', async (req, res) => {
  const fileHash = safeHash(req.body.fileHash)
  const fileName = path.basename(String(req.body.fileName || ''))
  if (!fileHash) return res.status(400).json({ error: '缺少 fileHash' })
  if (!fileName || fileName === '.' || fileName === '..') {
    return res.status(400).json({ error: 'fileName 非法' })
  }
  const dir = path.join(CHUNKS_DIR, fileHash)
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: '分片不存在，请重新上传' })
  }
  try {
    const total = Number(req.body.totalChunks) || (await fsp.readdir(dir)).length
    const destFull = path.join(STORAGE_DIR, uniqueName(fileName))
    const out = fs.createWriteStream(destFull)
    for (let i = 0; i < total; i++) {
      const chunkFile = path.join(dir, String(i))
      if (!fs.existsSync(chunkFile)) {
        out.destroy()
        await fsp.unlink(destFull).catch(() => {})
        return res.status(400).json({ error: `缺少第 ${i} 个分片，无法合并` })
      }
      await new Promise((resolve, reject) => {
        const rs = fs.createReadStream(chunkFile)
        rs.on('error', reject)
        out.on('error', reject)
        rs.pipe(out, { end: false })
        rs.on('end', resolve)
      })
    }
    await new Promise((resolve, reject) => {
      out.on('finish', resolve)
      out.on('error', reject)
      out.end()
    })
    // 合并成功后清理分片目录
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {})
    const stat = await fsp.stat(destFull)
    res.json({ message: '合并成功', file: { name: path.basename(destFull), size: stat.size } })
  } catch (err) {
    res.status(500).json({ error: '合并失败：' + err.message })
  }
})

// 删除某文件下的一条留言
app.delete('/api/files/:name/comments/:id', async (req, res) => {
  const name = req.params.name
  const id = req.params.id
  try {
    const all = await loadComments()
    const list = all[name] || []
    const idx = list.findIndex((c) => c.id === id)
    if (idx === -1) return res.status(404).json({ error: '留言不存在' })
    list.splice(idx, 1)
    if (list.length === 0) delete all[name]
    await saveComments(all)
    res.json({ message: '留言已删除' })
  } catch (err) {
    res.status(500).json({ error: '删除留言失败：' + err.message })
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
