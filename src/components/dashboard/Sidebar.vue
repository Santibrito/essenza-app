<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { LogOut, Activity, MessageSquare, Target, Layers, List } from 'lucide-vue-next'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

const props = defineProps<{
  activeTab: string
  isMarketing: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', value: string): void
  (e: 'logout'): void
}>()

const auth = useAuthStore()

const navItems = computed(() => {
  const allItems = [
    { id: 'tracker', label: 'Tracker', icon: Activity },
    { id: 'context', label: 'Bitácora', icon: MessageSquare },
    { id: 'crm', label: 'Marketing Hub', icon: Target, marketingOnly: true },
    { id: 'creative', label: 'Creatividad', icon: Layers, marketingOnly: true },
    { id: 'history', label: 'Mi Historial', icon: List },
  ]
  return allItems.filter(item => !item.marketingOnly || props.isMarketing)
})
</script>

<template>
  <aside class="hidden lg:flex flex-col h-full bg-zinc-900/40 backdrop-blur-xl border-r border-zinc-800/50 transition-all duration-300 shrink-0 w-64 overflow-hidden">
    <!-- Brand -->
    <div class="px-4 pt-4 pb-3 flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
        <span class="text-white text-sm font-black">E</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-black text-white leading-none tracking-tight truncate">Essenza</p>
        <p class="text-[10px] text-zinc-500 leading-none mt-0.5 font-bold uppercase tracking-wider truncate">Chatter App</p>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
      <button 
        v-for="item in navItems" 
        :key="item.id" 
        @click="emit('update:activeTab', item.id)"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group relative overflow-hidden" 
        :class="activeTab === item.id
          ? 'bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/5'
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'">
        <div v-if="activeTab === item.id" class="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />
        <component :is="item.icon" class="w-4 h-4 shrink-0 relative z-10" />
        <span class="text-sm font-semibold flex-1 truncate relative z-10">{{ item.label }}</span>
        <div v-if="activeTab === item.id" class="w-1 h-1 rounded-full bg-emerald-400 shrink-0 animate-pulse relative z-10" />
      </button>
    </nav>

    <!-- User Profile -->
    <div class="px-3 pb-3 pt-2 border-t border-zinc-800/50 space-y-2">
      <div class="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-800/50">
        <Avatar class="w-9 h-9 rounded-lg border-2 border-zinc-700/50 shrink-0 overflow-hidden">
          <AvatarImage :src="auth.user?.profilePictureUrl || auth.user?.profilePictureBase64" class="object-cover" />
          <AvatarFallback class="bg-emerald-500/20 text-emerald-400 text-xs font-black">
            {{ auth.user?.name?.charAt(0) }}
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold text-white leading-tight truncate">{{ auth.user?.name }}</p>
          <p class="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mt-0.5 truncate">
            {{ auth.user?.role?.replace('ROLE_', '') }}
          </p>
        </div>
      </div>

      <button @click="emit('logout')"
        class="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
        <LogOut class="w-4 h-4 shrink-0" />
        <span class="text-xs font-semibold uppercase tracking-wide">Cerrar Sesión</span>
      </button>
    </div>
  </aside>
</template>
