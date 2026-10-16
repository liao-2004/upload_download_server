<template>
  <BigUpload>
    <template #Uploadheader>
      <h2>上传大型文件</h2>
    </template>

    <template #Uploadmain>
      <p class="hint">从电脑选择文件上传到服务器（支持多选，单文件最大 2GB）。</p>
    </template>

    <template #Uploadbutton="{ onUpload, uploading }">
      <input
        type="file"
        multiple
        :disabled="uploading"
        @change="e => onUpload(e.target.files)"
      />
    </template>

    <template #uploadfooler="{ uploading, progress }">
      <span v-if="uploading" class="hint">
        上传中 {{ progress }}%
      </span>
    </template>
  </BigUpload>
</template>

<script setup>
import BigUpload from './BigUpload.vue'
</script>
<style scoped>
h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
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
.hint {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0.4rem 0;
}
</style>