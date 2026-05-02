<script setup>
import { Sun, Moon } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme.js'

const themeStore = useThemeStore()
</script>

<template>
  <button
    id="theme-toggle"
    @click="themeStore.toggleTheme"
    :title="themeStore.isDark ? 'Modo claro' : 'Modo oscuro'"
    class="relative w-8 h-8 flex items-center justify-center rounded-md
           text-muted-foreground hover:text-foreground hover:bg-secondary
           transition-all duration-200"
  >
    <Transition name="icon-flip" mode="out-in">
      <Sun v-if="themeStore.isDark" key="sun" class="w-4 h-4" />
      <Moon v-else key="moon" class="w-4 h-4" />
    </Transition>
  </button>
</template>

<style scoped>
.icon-flip-enter-active,
.icon-flip-leave-active {
  transition: all 0.18s ease;
}
.icon-flip-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}
.icon-flip-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}
</style>
