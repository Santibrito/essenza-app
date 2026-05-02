<script setup>
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme.js'
import TitleBar from '@/components/layout/TitleBar.vue'
import SplashScreen from '@/components/layout/SplashScreen.vue'
import UpdateBanner from '@/components/layout/UpdateBanner.vue'
import { Toaster, toast } from 'vue-sonner'
import 'vue-sonner/style.css'
const themeStore = useThemeStore()
const showSplash = ref(true)

themeStore.initTheme()

onMounted(() => {
  // Splash duration: 2.4s (matches progress bar animation)
  setTimeout(() => {
    showSplash.value = false
  }, 2600)
})
</script>

<template>
  <Toaster position="top-center" richColors />
  <div class="app-root h-screen flex flex-col overflow-hidden bg-zinc-50 dark:bg-black">
    <Transition name="splash" mode="out-in">

      <!-- Splash Screen -->
      <SplashScreen v-if="showSplash" key="splash" />

      <!-- App Shell -->
      <div v-else key="app" class="flex flex-col h-full">
        <TitleBar />
        <UpdateBanner />

        <main class="flex-1 overflow-hidden ">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" class="h-full" />
            </Transition>
          </RouterView>
        </main>
      </div>

    </Transition>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.app-root {
  font-family: 'Plus Jakarta Sans', sans-serif !important;
}

/* Splash fade-out */
.splash-enter-active,
.splash-leave-active {
  transition: opacity 0.55s ease;
}

.splash-enter-from,
.splash-leave-to {
  opacity: 0;
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
