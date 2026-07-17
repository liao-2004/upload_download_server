<template>
  <div class="big-upload">
    <slot name="Uploadheader" />
    <slot name="Uploadmain" />

    <!-- 隐藏真实 input，由外部控制 -->
    <slot
      name="Uploadbutton"
      :uploading="uploading"
      :onUpload="triggerUpload"
    />

    <slot name="uploadfooler" :progress="progress" :uploading="uploading" />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import axios from 'axios'
import SparkMD5 from 'spark-md5'
import { resumeUpload,SingleUpload,Doneload } from '@/api/Bigfiles'
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
const CONCURRENCY = 3

const uploading = ref(false)
const progress = ref(0)

/* ---------- 暴露给外部 slot ---------- */
const triggerUpload = (files) => {
  if (!files?.length) return
  handleUpload(files)
}

/* 让父组件能调用（可选） */
defineExpose({
  triggerUpload
})

/* ---------- 核心上传逻辑 ---------- */
const handleUpload = async (fileList) => {
  uploading.value = true
  progress.value = 0

  for (const file of fileList) {
    await uploadFile(file)
  }

  uploading.value = false
}

const uploadFile = async (file) => {
  const fileHash = await calcHash(file)
  const chunks = createChunks(file)

  const { data } = await resumeUpload()

  const uploaded = new Set(data.uploaded)
  let uploadedSize = uploaded.size * CHUNK_SIZE

  await asyncPool(CONCURRENCY, chunks, async (chunk) => {
    if (uploaded.has(chunk.index)) return

    const formData = new FormData()
    formData.append('chunk', chunk.chunk)
    formData.append('chunkIndex', chunk.index)
    formData.append('fileHash', fileHash)

    await SingleUpload(uploadedSize,progress,file,formData)
  })
  await Doneload( fileHash,file,chunks)
}

/* ---------- 工具函数 ---------- */
const calcHash = (file) =>
  new Promise(resolve => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    reader.onload = e => {
      spark.append(e.target.result)
      resolve(spark.end())
    }
    reader.readAsArrayBuffer(file.slice(0, 5 * 1024 * 1024))
  })

const createChunks = (file) => {
  const list = []
  let cur = 0
  while (cur < file.size) {
    list.push({
      chunk: file.slice(cur, cur + CHUNK_SIZE),
      index: list.length
    })
    cur += CHUNK_SIZE
  }
  return list
}

const asyncPool = (limit, tasks, iterator) =>
  new Promise(resolve => {
    let i = 0, running = 0, done = 0
    const enqueue = () => {
      while (running < limit && i < tasks.length) {
        running++
        iterator(tasks[i++]).then(() => {
          running--
          done++
          if (done === tasks.length) resolve()
          else enqueue()
        })
      }
    }
    enqueue()
  })
</script>