<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  Clock, DollarSign, Calendar, ChevronDown, ChevronUp,
  Star, MessageSquare, TrendingUp, Code2, Timer, Zap,
  Target, Info, Layers, UserCircle, Briefcase, LogIn, CalendarClock
} from 'lucide-vue-next'
import api from '@/api'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const auth = useAuthStore()
const pastShifts = ref<any[]>([])
const loading = ref(true)
const showRaw = ref(false)

const isMarketing = computed(() => auth.user?.role === 'ROLE_MARKETING')

onMounted(async () => {
  try {
    const res = await api.get('/shifts/me/history')
    pastShifts.value = res.data.content || res.data || []
    // Debug: ver estructura de datos
    if (pastShifts.value.length > 0) {
      console.log('🔍 Primer shift:', pastShifts.value[0])
      console.log('🔍 Reports:', pastShifts.value[0].reports)
      console.log('🔍 Model reports:', getModelReports(pastShifts.value[0]))
    }
  } catch (e) {
    pastShifts.value = []
  } finally {
    loading.value = false
  }
})

// --- Helpers ---
const parseJson = (str: any) => {
  if (!str) return []
  if (typeof str !== 'string') return str
  try { return JSON.parse(str) } catch { return [] }
}

const formatDateTime = (ts: string) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-AR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const formatSimpleDate = (ts: string) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

const formatHour = (ts: string) => {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const getScheduleLabel = (shift: any) => {
  if (!shift.scheduleStartTime) return null
  const start = shift.scheduleStartTime?.slice(0, 5)
  const end = shift.scheduleEndTime?.slice(0, 5)
  return end ? `${start} — ${end}` : start
}

const formatDuration = (start: string, end: string) => {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return formatTime(Math.floor(ms / 1000))
}

const formatTime = (secs: number) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const formatMoney = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(val)
}

const efficiencyPct = (shift: any) => {
  if (!shift.startTime || !shift.endTime || !shift.activeTimeSeconds) return 0
  const totalSecs = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 1000
  if (totalSecs <= 0) return 0
  return Math.min(100, Math.round((shift.activeTimeSeconds / totalSecs) * 100))
}

const shiftEarnings = (shift: any) => {
  const reports = shift.reports || []
  return reports.reduce((acc: number, r: any) => acc + (r.earnings || 0), 0)
}

const getModelReports = (shift: any) => {
  const reports = shift.reports || []
  // Filtrar reportes que tienen contenido vendido o spenders (son reportes por modelo)
  return reports.filter((r: any) =>
    r.ofModel || // Si tiene ofModel, es un reporte por modelo
    r.soldContentJson || // Si tiene contenido vendido, es un reporte por modelo
    r.spendersJson || // Si tiene spenders, es un reporte por modelo
    (r.observations && r.observations.startsWith('Modelo:')) // Si las observaciones empiezan con "Modelo:", es un reporte por modelo
  )
}

const getGeneralReport = (shift: any) => {
  const reports = shift.reports || []
  // El reporte general es el que NO tiene contenido/spenders y NO empieza con "Modelo:"
  return reports.find((r: any) =>
    !r.ofModel &&
    !r.soldContentJson &&
    !r.spendersJson &&
    (!r.observations || !r.observations.startsWith('Modelo:'))
  ) || null
}

const totalSpenders = (shift: any) => {
  return getModelReports(shift).reduce((acc: number, r: any) => acc + parseJson(r.spendersJson).length, 0)
}

const totalContent = (shift: any) => {
  return getModelReports(shift).reduce((acc: number, r: any) => acc + parseJson(r.soldContentJson).length, 0)
}

// --- Global Stats ---
const globalStats = computed(() => {
  if (!pastShifts.value.length) return []

  const totalEarningsValue = pastShifts.value.reduce((acc, s) => acc + shiftEarnings(s), 0)
  const totalActiveSecs = pastShifts.value.reduce((acc, s) => acc + (s.activeTimeSeconds || 0), 0)
  const avgEfficiency = Math.round(pastShifts.value.reduce((acc, s) => acc + efficiencyPct(s), 0) / pastShifts.value.length)
  const totalSpendersCount = pastShifts.value.reduce((acc, s) => acc + totalSpenders(s), 0)
  const totalContentCount = pastShifts.value.reduce((acc, s) => acc + totalContent(s), 0)

  if (isMarketing.value) {
    return [
      { l: 'Contenido', v: totalContentCount, i: Layers, c: 'text-indigo-500', sub: 'Total de ítems creados/vendidos', accent: 'bg-indigo-500' },
      { l: 'Sesiones', v: pastShifts.value.length, i: Calendar, c: 'text-blue-500', sub: 'Total de turnos completados', accent: 'bg-blue-500' },
      { l: 'Tiempo Total', v: formatTime(totalActiveSecs), i: Clock, c: 'text-emerald-500', sub: 'Tiempo acumulado de trabajo', accent: 'bg-emerald-500' },
      { l: 'Eficiencia', v: avgEfficiency + '%', i: Target, c: 'text-amber-500', sub: 'Promedio de actividad', accent: 'bg-amber-500' }
    ]
  }

  return [
    { l: 'Total Facturado', v: formatMoney(totalEarningsValue), i: DollarSign, c: 'text-emerald-500', sub: 'Ganancias acumuladas totales', accent: 'bg-emerald-500' },
    { l: 'Tiempo Activo', v: formatTime(totalActiveSecs), i: Clock, c: 'text-blue-500', sub: 'Horas totales cronometradas', accent: 'bg-blue-500' },
    { l: 'Rendimiento', v: avgEfficiency + '%', i: Target, c: 'text-violet-500', sub: 'Eficiencia promedio global', accent: 'bg-violet-500' },
    { l: 'Spenders', v: totalSpendersCount, i: Star, c: 'text-amber-500', sub: 'Total de clientes captados', accent: 'bg-amber-500' }
  ]
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

    <!-- Top Global Stats -->
    <div v-if="!loading && pastShifts.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <TooltipProvider :delay-duration="100">
        <Card v-for="k in globalStats" :key="k.l"
          class="border-border/40 bg-card/50 backdrop-blur-sm hover:border-border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1">
          <CardContent class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-1.5">
                <p class="text-[11px] font-black text-muted-foreground uppercase tracking-[0.15em] leading-none">{{ k.l
                  }}</p>
                <Tooltip>
                  <TooltipTrigger>
                    <Info class="w-3.5 h-3.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent class="text-[10px] font-bold uppercase tracking-wider bg-zinc-900 border-zinc-800">
                    {{ k.sub }}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-100/50 dark:bg-zinc-800/50 shadow-sm group-hover:scale-110 transition-transform duration-500">
                <component :is="k.i" class="w-4.5 h-4.5" :class="k.c" />
              </div>
            </div>
            <p class="text-3xl font-black tabular-nums leading-none tracking-tight">{{ k.v }}</p>
          </CardContent>
          <div
            class="absolute bottom-0 left-0 right-0 h-1 opacity-50 group-hover:opacity-100 transition-all duration-300"
            :class="k.accent" />
        </Card>
      </TooltipProvider>
    </div>

    <!-- Main List Container -->
    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="loading" class="grid gap-4">
        <Card v-for="i in 3" :key="i" class="animate-pulse h-24 border-border/40 bg-muted/20" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!pastShifts.length"
        class="flex flex-col items-center justify-center py-20 text-center bg-card/30 rounded-3xl border-2 border-dashed border-border/40 transition-colors hover:bg-card/50">
        <div class="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-6">
          <Calendar class="w-10 h-10 text-muted-foreground/30" />
        </div>
        <p class="text-xl font-bold text-foreground">Sin historial disponible</p>
        <p class="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
          Tus turnos aparecerán aquí una vez que completes tu primera sesión.
        </p>
      </div>

      <!-- List -->
      <div v-else class="space-y-4">
        <Collapsible v-for="shift in pastShifts" :key="shift.id" v-slot="{ open }">
          <Card :class="cn(
            'transition-all duration-300 border-border/50 hover:border-border/80 group overflow-hidden',
            open ? 'ring-2 ring-primary/10 shadow-lg translate-y-[-2px]' : 'hover:bg-accent/5'
          )">
            <!-- Header -->
            <CardHeader class="p-0">
              <CollapsibleTrigger class="w-full text-left p-5 flex items-center justify-between gap-6 overflow-hidden">
                <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10">

                  <!-- Date & ID -->
                  <div class="flex items-center gap-4 min-w-[180px]">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span class="text-[10px] font-bold text-primary/60 uppercase">{{
                        formatSimpleDate(shift.startTime).split('/')[1] }}</span>
                      <span class="text-lg font-black leading-none text-primary">{{
                        formatSimpleDate(shift.startTime).split('/')[0] }}</span>
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-black truncate leading-none mb-1">Sesión #{{ shift.id }}</p>
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-[10px] uppercase font-bold text-muted-foreground">{{
                          formatDateTime(shift.startTime).split(' ')[0] }}</p>
                        <div v-if="formatHour(shift.startTime)" class="flex items-center gap-1">
                          <LogIn class="w-2.5 h-2.5 text-emerald-500" />
                          <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{{
                            formatHour(shift.startTime) }}</span>
                        </div>
                        <div v-if="getScheduleLabel(shift)" class="flex items-center gap-1">
                          <CalendarClock class="w-2.5 h-2.5 text-blue-500" />
                          <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400">{{
                            getScheduleLabel(shift) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Stats Grid -->
                  <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="flex flex-col">
                      <span
                        class="text-[9px] uppercase font-black text-muted-foreground/60 tracking-wider">Duración</span>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <Timer class="w-3 h-3 text-blue-500" />
                        <span class="text-xs font-bold font-mono">{{ formatDuration(shift.startTime, shift.endTime)
                          }}</span>
                      </div>
                    </div>
                    <div class="flex flex-col">
                      <span
                        class="text-[9px] uppercase font-black text-muted-foreground/60 tracking-wider">Activo</span>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <Zap class="w-3 h-3 text-amber-500" />
                        <span class="text-xs font-bold font-mono">{{ formatTime(shift.activeTimeSeconds || 0) }}</span>
                      </div>
                    </div>
                    <div class="flex flex-col">
                      <span
                        class="text-[9px] uppercase font-black text-muted-foreground/60 tracking-wider">Ganancias</span>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <DollarSign class="w-3 h-3 text-emerald-500" />
                        <span class="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">{{
                          formatMoney(shiftEarnings(shift)) }}</span>
                      </div>
                    </div>
                    <div class="flex flex-col">
                      <span
                        class="text-[9px] uppercase font-black text-muted-foreground/60 tracking-wider">Eficiencia</span>
                      <div class="flex items-center gap-2 mt-0.5">
                        <div class="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden max-w-[40px]">
                          <div class="h-full bg-primary" :style="{ width: efficiencyPct(shift) + '%' }" />
                        </div>
                        <span class="text-[10px] font-black font-mono leading-none">{{ efficiencyPct(shift) }}%</span>
                      </div>
                    </div>
                  </div>

                  <!-- Extras Badge -->
                  <div v-if="shift.isExtraHours" class="shrink-0 hidden lg:block">
                    <Badge
                      class="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-black uppercase">
                      Horas Extras</Badge>
                  </div>
                </div>

                <div class="shrink-0 flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full border border-border flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ChevronDown :class="cn('w-4 h-4 transition-transform duration-300', open && 'rotate-180')" />
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>

            <!-- Expanded Details -->
            <CollapsibleContent>
              <div class="px-5 pb-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <Separator class="opacity-50" />

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

                  <!-- Left Side: Analysis -->
                  <div class="space-y-6">
                    <div>
                      <h4
                        class="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                        <Code2 class="w-3 h-3" />
                        Análisis de Sesión
                      </h4>
                      <div class="grid grid-cols-2 gap-3">
                        <div class="p-3 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/50">
                          <p class="text-[10px] font-bold text-muted-foreground uppercase mb-1">Inicio</p>
                          <p class="text-sm font-black">{{ formatHour(shift.startTime) }}</p>
                          <p class="text-[10px] text-muted-foreground font-medium">{{ formatSimpleDate(shift.startTime)
                            }} · Fact: {{ formatMoney(shift.initialEarnings || 0) }}</p>
                        </div>
                        <div class="p-3 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-border/50">
                          <p class="text-[10px] font-bold text-muted-foreground uppercase mb-1">Fin</p>
                          <p class="text-sm font-black">{{ formatHour(shift.endTime) }}</p>
                          <p class="text-[10px] text-muted-foreground font-medium">{{ formatSimpleDate(shift.endTime) }}
                            · Duración: {{ formatDuration(shift.startTime, shift.endTime) }}</p>
                        </div>
                      </div>
                    </div>

                    <div v-if="getGeneralReport(shift)?.observations" class="space-y-2">
                      <h4
                        class="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <MessageSquare class="w-3.5 h-3.5" />
                        Observaciones Generales
                      </h4>
                      <div
                        class="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                        <p class="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{{
                          getGeneralReport(shift).observations }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Right Side: Model Activity -->
                  <div class="space-y-6">
                    <h4
                      class="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <UserCircle class="w-3 h-3" />
                      Actividad por Modelo
                    </h4>

                    <div v-if="getModelReports(shift).length" class="space-y-3">
                      <div v-for="report in getModelReports(shift)" :key="report.id"
                        class="group/item rounded-2xl border border-border/50 bg-card/50 overflow-hidden hover:border-primary/30 transition-all hover:bg-card">

                        <!-- Mini Header -->
                        <div class="flex items-center justify-between px-4 py-3 border-b border-border/40">
                          <div class="flex items-center gap-3">
                            <div
                              class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-xs">
                              {{ report.ofModel?.name?.charAt(0).toUpperCase() ||
                                (report.observations?.match(/Modelo:\s*(.+)/)?.[1]?.charAt(0).toUpperCase() || 'M') }}
                            </div>
                            <span class="text-sm font-black">{{ report.ofModel?.name ||
                              report.observations?.match(/Modelo:\s*(.+)/)?.[1] || 'Modelo' }}</span>
                          </div>
                          <Badge variant="outline"
                            class="font-bold border-emerald-500/20 text-emerald-600 bg-emerald-500/5">{{
                            formatMoney(report.earnings) }}</Badge>
                        </div>

                        <!-- Content Items -->
                        <div class="p-4 space-y-4">
                          <div v-if="parseJson(report.soldContentJson).length" class="flex flex-wrap gap-1.5">
                            <div v-for="(tag, i) in parseJson(report.soldContentJson)" :key="i"
                              class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted-foreground">
                              {{ tag }}
                            </div>
                          </div>

                          <!-- Spenders List -->
                          <div v-if="parseJson(report.spendersJson).length" class="space-y-1.5">
                            <div v-for="(sp, i) in parseJson(report.spendersJson)" :key="i"
                              class="flex items-center justify-between p-2 rounded-xl bg-zinc-100/30 dark:bg-zinc-900/30 border border-border/30">
                              <div class="flex items-center gap-2">
                                <span class="text-[10px] font-black text-foreground">{{ sp.name || 'Spender' }}</span>
                                <span v-if="sp.username" class="text-[9px] font-bold text-muted-foreground">{{
                                  sp.username }}</span>
                              </div>
                              <span class="text-[10px] font-black text-amber-600 dark:text-amber-400 tabular-nums">${{
                                sp.amount }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-else
                      class="flex flex-col items-center justify-center py-10 border border-dashed border-border/40 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/30 text-center">
                      <UserCircle class="w-10 h-10 text-muted-foreground/20 mb-3" />
                      <p class="text-xs font-semibold text-muted-foreground">Sin actividad por modelo registrada</p>
                      <p class="text-[10px] text-muted-foreground/60 mt-1">No se cargaron reportes específicos en esta
                        sesión</p>
                    </div>
                  </div>

                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>

  </div>
</template>

<style scoped>
.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
</style>