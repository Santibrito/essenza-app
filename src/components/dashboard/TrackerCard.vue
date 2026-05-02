<script setup lang="ts">
import { Coffee, Play, Timer, Pause, Zap, X, Clock, AlertTriangle, CheckCircle2, CalendarClock, Info } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ref, watch, computed } from 'vue'
import { useTimezone } from '@/lib/useTimezone'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

interface DailySummary {
  todayActiveSeconds: number
  todayBreakSeconds: number
  targetSeconds: number
  remainingSeconds: number
  todayShiftCount: number
  dayComplete: boolean
  yesterdayDebtSeconds: number
}

interface ScheduleInfo {
  timezone?: string
  template?: {
    startTime?: string
    endTime?: string
    name?: string
  }
}

const props = defineProps<{
  effectiveWorkSeconds: number
  isWorking: boolean
  isPaused: boolean
  statusLabel: string
  statusDot: string
  shiftStartTime?: string
  dailySummary?: DailySummary
  scheduleInfo?: ScheduleInfo
  isWithinSchedule: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleSidebar'): void
  (e: 'startShift', isExtra: boolean): void
  (e: 'toggleBreak'): void
  (e: 'endShift'): void
}>()

const { formatTime: fmtLocal, convertShiftTime } = useTimezone()

// Timer local para suavidad visual
const displayTime = ref('00:00:00')

const formatSecs = (secs: number): string => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

watch(() => props.effectiveWorkSeconds, (newVal) => {
  displayTime.value = formatSecs(newVal)
}, { immediate: true })

// Lógica de progreso diario
const todayAccumulated = computed(() => {
  if (!props.dailySummary) return props.effectiveWorkSeconds
  const previousShiftsSeconds = props.dailySummary.todayActiveSeconds
  return props.isWorking
    ? previousShiftsSeconds + props.effectiveWorkSeconds
    : previousShiftsSeconds
})

const targetSeconds = computed(() => props.dailySummary?.targetSeconds ?? auth.user?.shiftTargetSeconds ?? 28800)

const formatMetaLabel = (secs: number) => {
  if (secs < 3600) {
    return `${Math.floor(secs / 60)}m`
  }
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
const progressPercent = computed(() => Math.min((todayAccumulated.value / targetSeconds.value) * 100, 100))

const hoursLabel = computed(() => {
  const h = Math.floor(todayAccumulated.value / 3600)
  const m = Math.floor((todayAccumulated.value % 3600) / 60)
  return `${h}h ${m}m`
})

const debtSeconds = computed(() => props.dailySummary?.yesterdayDebtSeconds ?? 0)
const fmtDebt = (secs: number) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const remainingSeconds = computed(() => Math.max(0, targetSeconds.value - todayAccumulated.value))

// Horarios de entrada y asignados
const entryTime = computed(() => {
  if (!props.shiftStartTime) return null
  return fmtLocal(props.shiftStartTime)
})

const assignedStart = computed(() => {
  const t = props.scheduleInfo?.template?.startTime
  const tz = props.scheduleInfo?.timezone
  if (!t || !tz) return null
  return convertShiftTime(t.slice(0, 5), tz)
})

const assignedEnd = computed(() => {
  const t = props.scheduleInfo?.template?.endTime
  const tz = props.scheduleInfo?.timezone
  if (!t || !tz) return null
  return convertShiftTime(t.slice(0, 5), tz)
})
</script>

<template>
  <div
    class="lg:col-span-2 rounded-2xl border border-border bg-card p-6 flex flex-col gap-6 transition-all duration-300 group/card">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
          <Timer class="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <p class="text-sm font-bold text-foreground leading-none">Control de Turno</p>
          <p class="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Tiempo y progreso</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Badge v-if="debtSeconds > 0" variant="outline"
          class="gap-1.5 px-3 py-1 text-[10px] font-black uppercase text-amber-500 border-amber-500/20 bg-amber-500/5">
          <AlertTriangle class="w-3 h-3" />
          Deuda: {{ fmtDebt(debtSeconds) }}
        </Badge>

        <div
          class="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-border/50">
          <span :class="['w-1.5 h-1.5 rounded-full animate-pulse', statusDot]" />
          <span class="text-[10px]  uppercase tracking-wider text-muted-foreground">{{ statusLabel }}</span>
        </div>

        <TooltipProvider :delay-duration="100">
          <Tooltip>
            <TooltipTrigger as-child>
              <button class="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                <Info class="w-3.5 h-3.5 text-muted-foreground/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left"
              class="max-w-[200px] text-[10px] font-medium leading-relaxed bg-zinc-900 border-zinc-800 text-white">
              Controla tu turno: inicia, pausa y finaliza sesiones. El progreso diario se calcula automáticamente.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- Info Section (Antiguo estilo simple) -->
    <div v-if="assignedStart || entryTime"
      class="flex flex-wrap gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-border/40">
      <div v-if="assignedStart" class="flex-1 min-w-[140px] space-y-1">
        <p class="text-[10px]  text-muted-foreground uppercase tracking-widest">Horario Asignado</p>
        <p class="text-xs font-black text-foreground">
          {{ assignedStart }} a {{ assignedEnd }}
        </p>
      </div>
      <div v-if="entryTime" class="flex-1 min-w-[140px] space-y-1 border-l border-border/20 pl-4">
        <p class="text-[10px]  text-muted-foreground uppercase tracking-widest">Hora de Entrada</p>
        <p class="text-xs font-black text-emerald-500">
          {{ entryTime }}
        </p>
      </div>
    </div>

    <!-- Timer Display (Estilo original simple) -->
    <div class="flex flex-col items-center py-2">
      <p class="text-7xl lg:text-8xl font-black tracking-tighter tabular-nums leading-none"
        :class="isWorking ? 'text-foreground' : 'text-zinc-200 dark:text-zinc-800'">
        {{ displayTime }}
      </p>
      <div v-if="(dailySummary?.todayShiftCount ?? 0) > 0" class="mt-4 flex items-center gap-2">
        <Badge variant="secondary" class="text-[9px]  uppercase">{{ (dailySummary?.todayShiftCount ?? 0) }}
          Sesiones Hoy</Badge>
        <span class="text-[11px] font-medium text-muted-foreground">Total: {{ hoursLabel }}</span>
      </div>
    </div>

    <!-- Progress section -->
    <div class="space-y-3">
      <div class="flex items-end justify-between">
        <p class="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Progreso Diario</p>
        <p class="text-sm font-black tabular-nums">
          {{ Math.floor(progressPercent) }}%
          <span class="text-[10px] text-muted-foreground ml-1">Meta: {{ formatMetaLabel(targetSeconds) }}</span>
        </p>
      </div>
      <div class="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden border border-border/10">
        <div class="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
          :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between gap-4 mt-2">
      <template v-if="isWorking">
        <p class="text-xs  text-muted-foreground uppercase tracking-tight flex items-center gap-2">
          <span :class="['w-1.5 h-1.5 rounded-full', isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse']" />
          {{ isPaused ? 'Sesión en pausa' : 'Trabajando' }}
        </p>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="h-9 px-4 border-border/80" @click="emit('toggleBreak')">
            <component :is="isPaused ? Play : Coffee" class="w-4 h-4 mr-2" />
            {{ isPaused ? 'Retomar' : 'Break' }}
          </Button>
          <Button variant="destructive" size="sm" class="h-9 px-4  text-white" @click="emit('endShift')">
            Terminar
          </Button>
        </div>
      </template>
      <template v-else>
        <p class="text-xs  text-muted-foreground uppercase tracking-tight">Offline</p>
        <div class="flex items-center gap-2">
          <Button size="sm" variant="outline" class="h-9 border-border/80 " @click="emit('startShift', true)">

            Horas extras
          </Button>
          <Button 
            size="sm" 
            class="h-9 px-6 tracking-wide" 
            @click="emit('startShift', false)"
            :disabled="remainingSeconds === 0 && !isWithinSchedule"
          >
            <template v-if="(dailySummary?.todayShiftCount ?? 0) === 0">
              Iniciar turno
            </template>
            <template v-else-if="remainingSeconds > 0">
              Continuar jornada
            </template>
            <template v-else-if="!isWithinSchedule">
              Jornada completada
            </template>
            <template v-else>
              Continuar trabajando
            </template>
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>