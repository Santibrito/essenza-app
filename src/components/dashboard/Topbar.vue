<script setup lang="ts">
import { Menu, Search, Command, Radio, HelpCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  activeTab: string
  isWorking: boolean
  isPaused: boolean
  statusLabel: string
  statusColor: string
  shiftTarget: number
}>()

const emit = defineEmits<{
  (e: 'toggleSidebar'): void
  (e: 'startTour'): void
}>()

const formatTime = (secs: number): string => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}h`
}

const getTabLabel = (tab: string) => {
  const labels: Record<string, string> = {
    tracker: 'Tracker Principal',
    history: 'Mi Rendimiento',
    crm: 'Gestión de Leads',
    creative: 'Muro Creativo',
    context: 'Bitácora de Relevo'
  }
  return labels[tab] || tab
}
</script>

<template>
  <header
    class="shrink-0 h-14 flex items-center px-4 md:px-6 gap-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50  sticky top-0 z-30">
    <!-- Mobile menu -->
    <Button @click="emit('toggleSidebar')" variant="ghost" size="icon"
      class="lg:hidden -ml-1 shrink-0 text-muted-foreground hover:text-foreground">
      <Menu class="w-4 h-4" />
    </Button>

    <!-- Breadcrumb Area -->
    <div class="hidden md:flex items-center gap-3 shrink-0">
      <div class="flex flex-col">
        <p class="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Essenza
          Monitor</p>
        <div class="flex items-center gap-2">
          <h1 class="text-xs font-black uppercase tracking-widest text-foreground leading-none">
            {{ getTabLabel(activeTab) }}
          </h1>
          <div v-if="isWorking"
            class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
        </div>
      </div>
    </div>

    <!-- Center Space (Empty/Flexible) -->
    <div class="flex-1" />

    <!-- Right Side: Session Hub -->
    <div class="flex items-center gap-4 shrink-0">
      <!-- Tour Button -->
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button 
              data-tour="help-button"
              @click="emit('startTour')" 
              variant="ghost" 
              size="icon"
              class="text-muted-foreground hover:text-foreground"
            >
              <HelpCircle class="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p class="text-xs">Ver tour de bienvenida</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <!-- Session Capsule -->
      <div
        class="flex items-center gap-4 px-5 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm shadow-sm transition-all hover:bg-white dark:hover:bg-zinc-950">

        <div class="flex flex-col items-end">
          <p class="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Estado</p>
          <span
            :class="['text-[10px] font-black uppercase leading-none tracking-tighter transition-colors', isWorking ? 'text-emerald-500' : 'text-zinc-500']">
            {{ statusLabel }}
          </span>
        </div>

        <Separator orientation="vertical" class="h-5 bg-border/50" />

        <div class="flex flex-col items-center">
          <p class="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Restante</p>
          <span class="text-[10px] font-black tabular-nums text-foreground leading-none">
            {{ formatTime(shiftTarget) }}
          </span>
        </div>

        <Separator orientation="vertical" class="h-5 bg-border/50" />

        <!-- Connection Status -->
        <div class="flex flex-col items-start px-1 group">
          <p class="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Sync</p>
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span class="text-[9px] font-black text-foreground uppercase tracking-tighter leading-none">En Línea</span>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
