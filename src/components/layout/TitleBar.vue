<script setup>
import { ref, onMounted, onBeforeUnmount, computed, defineAsyncComponent } from 'vue'
import { Minus, X, Maximize2, Minimize2 } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'
import darkLogo from '@/assets/img/logo-full-white.png'
import lightLogo from '@/assets/img/logo-full-dark.png'

const ThemeToggleComponent = defineAsyncComponent(() => import('./ThemeToggle.vue'))

const themeStore = useThemeStore()
const isMaximized = ref(false)

const currentLogo = computed(() => themeStore.isDark ? darkLogo : lightLogo)

const minimize = () => window.electronAPI?.window.minimize()
const toggleMaximize = () => window.electronAPI?.window.maximize()
const close = () => window.electronAPI?.window.close()

let cleanupFn = null

onMounted(async () => {
  if (!window.electronAPI) return
  isMaximized.value = await window.electronAPI.window.isMaximized()
  cleanupFn = window.electronAPI.window.onStateChanged((val) => {
    isMaximized.value = val
  })
})

onBeforeUnmount(() => cleanupFn?.())
</script>

<template>
  <!-- -webkit-app-region: drag → permite arrastrar la ventana -->
  <header class="titlebar h-11 flex items-center justify-between px-4 flex-shrink-0
           bg-card border-b border-border relative select-none" style="-webkit-app-region: drag">
    <!-- Brand -->
    <div class="flex items-center gap-2.5 h-full" style="-webkit-app-region: no-drag">
      <img :src="currentLogo" alt="Essenza Models" class="h-14 w-auto object-contain" />
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
      <ThemeToggleComponent />

      <div class="w-px h-5 bg-border mx-1" />

      <!-- Minimize -->
      <button id="btn-minimize" @click="minimize" title="Minimizar" class="win-btn hover:bg-secondary">
        <Minus class="w-3.5 h-3.5" />
      </button>

      <!-- Maximize / Restore -->
      <button id="btn-maximize" @click="toggleMaximize" :title="isMaximized ? 'Restaurar' : 'Maximizar'"
        class="win-btn hover:bg-secondary">
        <Maximize2 v-if="!isMaximized" class="w-3.5 h-3.5" />
        <Minimize2 v-else class="w-3.5 h-3.5" />
      </button>

      <!-- Close -->
      <button id="btn-close" @click="close" title="Cerrar" class="win-btn hover:bg-destructive hover:text-white">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </header>
</template>

<style scoped>
@reference "@/assets/globals.css";

.win-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:text-foreground;
}
</style>
