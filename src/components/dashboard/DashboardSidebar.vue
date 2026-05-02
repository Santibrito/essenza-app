<script setup lang="ts">
import {
  Radio, History, Users, Lightbulb, ClipboardCheck,
  LogOut, X, ChevronRight, Settings, Calendar, Package
} from 'lucide-vue-next'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import ProfileSettingsSheet from '@/components/dashboard/ProfileSettingsSheet.vue'
import packageJson from '../../../package.json'

type TabType = 'tracker' | 'history' | 'crm' | 'creative' | 'context' | 'customs'

const props = defineProps<{
  activeTab: TabType
  isMarketing: boolean
  isContentManager?: boolean
  open?: boolean
  offDays?: string[]
  pendingCustomsCount?: number
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', value: TabType): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:open', value: boolean): void
  (e: 'logout'): void
}>()

const auth = useAuthStore()
const profileOpen = ref(false)
const appVersion = packageJson.version

const sections = [
  {
    label: 'Tiempo Real',
    items: [
      { id: 'tracker' as TabType, label: 'Control de Turno', icon: Radio, color: 'text-emerald-500', bg: 'bg-emerald-500/10', show: true },
      { id: 'history' as TabType, label: props.isContentManager ? 'Customs Pendientes' : 'Mi Rendimiento', icon: History, color: 'text-sky-500', bg: 'bg-sky-500/10', show: !props.isContentManager },
    ]
  },
  {
    label: 'Estrategia Agency',
    items: [
      { id: 'customs' as TabType, label: props.isContentManager ? 'Gestión de Customs' : 'Customs', icon: Package, color: 'text-teal-500', bg: 'bg-teal-500/10', show: !props.isMarketing },
      { id: 'crm' as TabType, label: 'Gestión de Leads', icon: Users, color: 'text-violet-500', bg: 'bg-violet-500/10', show: props.isMarketing },
      { id: 'creative' as TabType, label: 'Muro Creativo', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500/10', show: props.isMarketing },
      { id: 'context' as TabType, label: 'Modelos', icon: ClipboardCheck, color: 'text-rose-500', bg: 'bg-rose-500/10', show: !props.isContentManager && !props.isMarketing },
    ]
  }
]

function selectTab(id: TabType) {
  emit('update:activeTab', id)
  emit('update:open', false)
}
</script>

<template>
  <!-- Mobile overlay -->
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-40 bg-black/40 lg:hidden backdrop-blur-sm"
      @click="emit('update:open', false)" />
  </Transition>

  <!-- Sidebar -->
  <Transition name="slide">
    <aside class="
        fixed lg:sticky top-0 left-0 z-50 lg:z-30
        w-64 h-full flex flex-col overflow-hidden
        bg-white dark:bg-zinc-950
        border-r border-zinc-200 dark:border-zinc-800
        transition-transform duration-300 ease-in-out
      " :class="[
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]">

      <!-- Brand Wrapper -->
      <div class="px-5 pt-6 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8">
            <img src="..\..\..\public\essenza.ico"></img>
          </div>
          <div>
            <p class="text-sm font-black text-zinc-900 dark:text-zinc-50 leading-none tracking-tight uppercase">
              EssenzaModels</p>
            <p
              class="text-[9px] text-zinc-400 dark:text-zinc-500 leading-none mt-1 font-bold uppercase tracking-widest">
              Official Platform</p>
          </div>
        </div>
      </div>

      <div class="mx-5 h-px bg-zinc-100 dark:bg-zinc-800" />

      <!-- Nav -->
      <nav class="flex-1 px-3 overflow-y-auto space-y-5 pb-4 pt-4"
        style="scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.1) transparent;">

        <template v-for="section in sections" :key="section.label">
          <div class="space-y-1">
            <p class="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-2.5 mb-2">
              {{ section.label }}
            </p>
            <ul class="space-y-0.5">
              <li v-for="item in section.items" :key="item.id">
                <button v-if="item.show !== false" @click="selectTab(item.id)"
                  :data-tour="item.id === 'history' && isContentManager ? 'sidebar-customs' : undefined"
                  class="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all duration-200 group"
                  :class="[
                    activeTab === item.id
                      ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 hover:text-zinc-800 dark:hover:text-zinc-200'
                  ]">
                  <span class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all duration-200"
                    :class="activeTab === item.id ? item.bg : 'bg-transparent group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800'">
                    <component :is="item.icon" class="w-3.5 h-3.5 transition-colors"
                      :class="activeTab === item.id ? item.color : 'text-zinc-400 dark:text-zinc-500 group-hover:' + item.color" />
                  </span>

                  <span class="text-sm font-medium flex-1 leading-none">{{ item.label }}</span>
                  
                  <!-- Counter badge for Gestión de Customs -->
                  <span v-if="item.id === 'customs' && isContentManager && pendingCustomsCount > 0"
                    class="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-teal-500 text-white tabular-nums">
                    {{ pendingCustomsCount }}
                  </span>
                  
                  <ChevronRight v-if="activeTab === item.id" class="w-3 h-3 text-zinc-300 dark:text-zinc-700" />
                </button>
              </li>
            </ul>
          </div>
        </template>

        <!-- Día Libre (Movido al footer para visibilidad constante) -->

      </nav>

      <div class="mx-5 h-px bg-zinc-100 dark:bg-zinc-800" />

      <!-- Footer User + Buttons (Diseño Premium unificado) -->
      <div class="p-4 pb-6 space-y-3 shrink-0">
        <!-- User Profile (El diseño que te gustó) -->
        <div
          data-tour="user-menu"
          class="flex items-center gap-3 px-3 py-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/40 relative group/user">
          <span
            class="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 shadow-sm transition-transform duration-300 group-hover/user:scale-105 flex items-center justify-center">
            <img v-if="auth.user?.profilePictureUrl || auth.user?.profilePictureBase64"
              :src="auth.user?.profilePictureUrl || auth.user?.profilePictureBase64"
              class="w-full h-full object-cover" />
            <span v-else
              class="text-xs font-black flex items-center justify-center h-full text-zinc-600 dark:text-zinc-400">
              {{ auth.user?.name?.charAt(0) }}
            </span>
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1 mb-1">
              <p class="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight leading-none">{{
                auth.user?.name }}</p>
              <!-- Badge de Día Libre integrado -->
              <span v-if="offDays && offDays.length > 0"
                class="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-white dark:bg-zinc-800 text-primary border border-primary/20 shadow-sm shrink-0">
                OFF: {{ offDays[0] }}
              </span>
            </div>
            <p class="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest leading-none">
              {{ auth.user?.role?.replace('ROLE_', '') }}
            </p>
          </div>
        </div>

        <!-- Stacked Options (Hover tipo footer) -->
        <div class="space-y-1">
          <button @click="profileOpen = true" class="
              w-full flex items-center gap-3 px-2.5 py-2 rounded-lg
              text-zinc-400 dark:text-zinc-500
              hover:text-primary dark:hover:text-primary
              hover:bg-primary/5
              transition-all duration-150 text-left group
            ">
            <span
              class="w-7 h-7 rounded-md flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-all">
              <Settings class="w-3.5 h-3.5" />
            </span>
            <span class="text-sm font-medium">Configuración</span>
          </button>

          <button @click="emit('logout')" class="
              w-full flex items-center gap-3 px-2.5 py-2 rounded-lg
              text-zinc-400 dark:text-zinc-500
              hover:text-red-600 dark:hover:text-red-400
              hover:bg-red-50 dark:hover:bg-red-500/10
              transition-all duration-150 text-left group
            ">
            <span
              class="w-7 h-7 rounded-md flex items-center justify-center bg-transparent group-hover:bg-red-100 dark:group-hover:bg-red-500/15 transition-all">
              <LogOut class="w-3.5 h-3.5" />
            </span>
            <span class="text-sm font-medium">Cerrar Sesión</span>
          </button>
          
          <!-- App Version -->
          <div class="mt-4 pt-4 border-t border-border/50">
            <div class="px-2.5 py-2 flex items-center justify-between">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Versión</p>
              <p class="text-xs font-black text-foreground tabular-nums">v{{ appVersion }}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </Transition>

  <!-- Profile settings sheet (outside sidebar for proper z-index) -->
  <ProfileSettingsSheet v-model:open="profileOpen" />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>