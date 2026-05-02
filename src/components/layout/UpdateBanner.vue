<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-vue-next'

const state = ref('idle') // 'idle' | 'downloading' | 'ready' | 'error'
const updateInfo = ref(null)
const dismissed = ref(false)
const downloadProgress = ref(0)
const message = ref('')

let cleanupStatus = null
let cleanupProgress = null

onMounted(() => {
  if (!window.electronAPI?.updater) return

  cleanupStatus = window.electronAPI.updater.onStatusChange(({ type, info, message: msg }) => {
    if (type === 'available') {
      updateInfo.value = info
      state.value = 'downloading'
      dismissed.value = false
      message.value = msg || `Descargando v${info?.version}...`
    } else if (type === 'ready') {
      updateInfo.value = info
      state.value = 'ready'
      dismissed.value = false
      message.value = msg || `v${info?.version} lista para instalar`
    } else if (type === 'error') {
      state.value = 'error'
      dismissed.value = false
      message.value = msg || 'Error al buscar actualizaciones'
    }
  })

  cleanupProgress = window.electronAPI.updater.onProgress(({ percent }) => {
    downloadProgress.value = percent
  })
})

onUnmounted(() => {
  cleanupStatus?.()
  cleanupProgress?.()
})

function installNow() {
  window.electronAPI.updater.installNow()
}

function checkNow() {
  window.electronAPI.updater.checkNow()
  state.value = 'downloading'
  message.value = 'Buscando actualizaciones...'
  dismissed.value = false
}

function dismiss() {
  dismissed.value = true
}
</script>

<template>
  <Transition name="banner">
    <div
      v-if="!dismissed && state !== 'idle'"
      class="update-banner"
      :class="{ 
        'is-ready': state === 'ready',
        'is-error': state === 'error'
      }"
    >
      <div class="banner-content">
        <div class="banner-icon">
          <RefreshCw v-if="state === 'downloading'" class="icon spin" :size="15" />
          <CheckCircle v-else-if="state === 'ready'" class="icon" :size="15" />
          <AlertCircle v-else-if="state === 'error'" class="icon" :size="15" />
          <Download v-else class="icon" :size="15" />
        </div>

        <div class="banner-text">
          <span>{{ message }}</span>
          <div v-if="state === 'downloading' && downloadProgress > 0" class="progress-bar">
            <div class="progress-fill" :style="{ width: `${downloadProgress}%` }"></div>
          </div>
        </div>

        <div class="banner-actions">
          <button v-if="state === 'ready'" class="btn-install" @click="installNow">
            Instalar ahora
          </button>
          <button v-if="state === 'error'" class="btn-retry" @click="checkNow">
            Reintentar
          </button>
          <button class="btn-dismiss" @click="dismiss" title="Cerrar">
            <X :size="13" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.update-banner {
  position: relative;
  z-index: 100;
  background: linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
  padding: 0;
  overflow: hidden;
}

.update-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.07), transparent);
  animation: shimmer 2.5s ease-in-out infinite;
}

.update-banner.is-ready {
  background: linear-gradient(90deg, #0d1f12 0%, #0a2e1a 50%, #0d2e1a 100%);
  border-bottom-color: rgba(16, 185, 129, 0.4);
}

.update-banner.is-ready::before {
  background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.07), transparent);
}

.update-banner.is-error {
  background: linear-gradient(90deg, #2d1b1b 0%, #3d1a1a 50%, #2d1b1b 100%);
  border-bottom-color: rgba(239, 68, 68, 0.4);
}

.update-banner.is-error::before {
  background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.07), transparent);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  position: relative;
  z-index: 1;
}

.banner-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.icon {
  color: #818cf8;
}

.is-ready .icon {
  color: #34d399;
}

.is-error .icon {
  color: #f87171;
}

.spin {
  animation: spin 1.4s linear infinite;
}

.banner-text {
  flex: 1;
  font-size: 12px;
  color: #a5b4fc;
  line-height: 1.4;
}

.is-ready .banner-text {
  color: #6ee7b7;
}

.is-error .banner-text {
  color: #fca5a5;
}

.progress-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #818cf8;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.is-ready .progress-fill {
  background: #34d399;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-install, .btn-retry {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
  border: 1px solid;
}

.btn-install {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.btn-install:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.7);
  color: #a7f3d0;
}

.btn-retry {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.btn-retry:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.7);
  color: #fca5a5;
}

.btn-dismiss {
  background: transparent;
  border: none;
  color: #4b5563;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.btn-dismiss:hover {
  color: #9ca3af;
}

/* Transition */
.banner-enter-active {
  animation: slideDown 0.3s ease-out;
}
.banner-leave-active {
  animation: slideUp 0.25s ease-in forwards;
}

@keyframes slideDown {
  from { max-height: 0; opacity: 0; }
  to   { max-height: 60px; opacity: 1; }
}

@keyframes slideUp {
  from { max-height: 60px; opacity: 1; }
  to   { max-height: 0; opacity: 0; }
}

@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
