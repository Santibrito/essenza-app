<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Megaphone, X, Bell, AlertTriangle, Info } from 'lucide-vue-next'
import api from '@/api'

const announcements = ref<any[]>([])
const loading = ref(true)
const closedIds = ref<number[]>(JSON.parse(localStorage.getItem('essenza_closed_announcements') || '[]'))

const fetchAnnouncements = async () => {
  try {
    const res = await api.get('/announcements')
    // Sort so Flash appears first
    announcements.value = res.data.sort((a: any, b: any) => (b.isFlash ? 1 : 0) - (a.isFlash ? 1 : 0))
  } catch (err) {
    console.error('Failed to fetch announcements', err)
  } finally {
    loading.value = false
  }
}

const visibleAnnouncements = computed(() => {
  return announcements.value.filter(ann => !closedIds.value.includes(ann.id))
})

const closeAnnouncement = (id: number) => {
  closedIds.value.push(id)
  localStorage.setItem('essenza_closed_announcements', JSON.stringify(closedIds.value))
}

let interval: any = null
onMounted(() => {
  fetchAnnouncements()
  interval = setInterval(fetchAnnouncements, 3000) // Poll every 3s for real-time feel
})
onUnmounted(() => clearInterval(interval))

const getIcon = (type: string) => {
  switch (type) {
    case 'WARNING': return AlertTriangle
    case 'SUCCESS': return Bell
    case 'INFO': return Info
    default: return Megaphone
  }
}

const getStyles = (ann: any) => {
  if (ann.isFlash) {
    return {
      container: 'bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200',
      accent: 'bg-rose-500',
      iconBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-500 text-white'
    }
  }
  switch (ann.type) {
    case 'WARNING':
      return {
        container: 'bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-200',
        accent: 'bg-amber-500',
        iconBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500 text-white'
      }
    case 'SUCCESS':
      return {
        container: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200',
        accent: 'bg-emerald-500',
        iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-500 text-white'
      }
    default:
      return {
        container: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-950 dark:text-indigo-200',
        accent: 'bg-indigo-500',
        iconBg: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        badge: 'bg-indigo-500 text-white'
      }
  }
}
</script>

<template>
  <div v-if="visibleAnnouncements.length > 0" class="space-y-3 mb-6">
    <TransitionGroup 
      name="announcement-list" 
      tag="div" 
      class="space-y-3"
    >
      <div v-for="ann in visibleAnnouncements" :key="ann.id"
        class="relative overflow-hidden group rounded-2xl border backdrop-blur-md transition-all shadow-sm"
        :class="[getStyles(ann).container, ann.isFlash ? 'shadow-lg shadow-rose-500/10' : '']">
        
        <!-- Colored Left Accent -->
        <div class="absolute left-0 top-0 bottom-0 w-1.5" :class="getStyles(ann).accent" />

        <div class="p-4 md:p-5 flex items-center justify-between gap-6">
          <div class="flex items-start gap-4">
            <!-- Icon Container -->
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="getStyles(ann).iconBg">
              <component :is="getIcon(ann.type)" class="w-5 h-5" />
            </div>

            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="ann.isFlash" class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest animate-pulse" :class="getStyles(ann).badge">
                  FLASH ALERT
                </span>
                <span class="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  {{ ann.title || 'COMUNICADO' }}
                </span>
              </div>
              <p class="text-sm md:text-base font-bold leading-snug tracking-tight">
                {{ ann.text }}
              </p>
            </div>
          </div>

          <button @click="closeAnnouncement(ann.id)"
            class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors opacity-40 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Subtle background shine for Flash -->
        <div v-if="ann.isFlash" class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Transición suave para entrada de anuncios */
.announcement-list-enter-active,
.announcement-list-leave-active {
  transition: all 0.5s ease;
}
.announcement-list-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
.announcement-list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

