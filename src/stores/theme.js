import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref('system') // 'light' | 'dark' | 'system'

  const isDark = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value === 'dark'
  })

  function applyTheme() {
    // 1. Inyectar estilo para matar cualquier transición de golpe
    const style = document.createElement('style')
    style.id = 'theme-transition-blocker'
    style.innerHTML = `
      * {
        -webkit-transition: none !important;
        -moz-transition: none !important;
        -ms-transition: none !important;
        -o-transition: none !important;
        transition: none !important;
      }
    `
    document.head.appendChild(style)

    // 2. Aplicar el cambio de clase
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // 3. Esperar a que el navegador procese el cambio de estilo antes de reactivar transiciones
    // Usamos un pequeño delay extra para asegurar que el DOM masivo se haya repintado
    requestAnimationFrame(() => {
      const _ = window.getComputedStyle(style).opacity
      setTimeout(() => {
        const blocker = document.getElementById('theme-transition-blocker')
        if (blocker) blocker.remove()
      }, 20) // 20ms es suficiente para cubrir 1-2 frames adicionales
    })
  }

  function initTheme() {
    const saved = localStorage.getItem('app-theme')
    if (saved) {
      theme.value = saved
    } else {
      theme.value = 'system'
    }

    // Listen for system changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'system') {
        applyTheme()
      }
    })

    applyTheme()
  }

  function toggleTheme() {
    const current = isDark.value ? 'dark' : 'light'
    const next = current === 'dark' ? 'light' : 'dark'
    
    // Manual toggle overrides system
    theme.value = next
    localStorage.setItem('app-theme', next)
    applyTheme()
  }

  function setTheme(newTheme) {
    theme.value = newTheme
    if (newTheme === 'system') {
      localStorage.removeItem('app-theme')
    } else {
      localStorage.setItem('app-theme', newTheme)
    }
    applyTheme()
  }

  return { theme, isDark, initTheme, toggleTheme, setTheme }
})
