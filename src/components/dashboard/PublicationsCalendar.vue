<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  ChevronLeft, ChevronRight, Plus, Instagram, X,
  Calendar, Loader2, AlertTriangle, Trash2, Sparkles, ExternalLink,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  usePublications,
  CONTENT_TYPE_LABELS,
  STATUS_LABELS,
} from '@/lib/usePublications'
import { useIgPosts } from '@/lib/useIgPosts'
import IgScheduleModal from '@/components/dashboard/IgScheduleModal.vue'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  assignedModels?: { id: number; name: string; alias?: string }[]
}>()

const { getCalendar: getOldCalendar, cancel: cancelOld } = usePublications()
const { getCalendar: igGetCalendar, cancel: cancelIg } = useIgPosts()

// ── Item normalizado para el calendario (mezcla legacy + cuentas IG nuevas) ────
interface CalItem {
  key: string
  rawId: number
  isIg: boolean
  title: string
  contentType: string
  scheduledAt: string
  status: string
  caption?: string
  link?: string
  errorMessage?: string
  photoUrl?: string
  postUrl?: string
}

// ── Modal de programación (cuentas IG nuevas) ──────────────────────────────────
const showSchedule = ref(false)
const scheduleDate = ref<string | undefined>(undefined)
function openSchedule(date?: Date) {
  scheduleDate.value = date ? formatDateInput(date) : undefined
  showSchedule.value = true
}

// ── Calendar state ────────────────────────────────────────────────────────────
const today = new Date()
const currentYear  = ref(today.getFullYear())
const currentMonth = ref(today.getMonth() + 1) // 1-based

const items = ref<CalItem[]>([])
const calendarLoading = ref(false)

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

// ── Calendar grid (semana empieza en lunes) ────────────────────────────────────
const calendarDays = computed(() => {
  const year  = currentYear.value
  const month = currentMonth.value
  const jsFirst = new Date(year, month - 1, 1).getDay() // 0=Dom
  const leading = (jsFirst + 6) % 7                       // 0=Lun
  const daysInMonth = new Date(year, month, 0).getDate()

  const days: { date: Date | null; items: CalItem[] }[] = []
  for (let i = 0; i < leading; i++) days.push({ date: null, items: [] })

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dayItems = items.value
      .filter(p => {
        const pd = new Date(p.scheduledAt)
        return pd.getFullYear() === year && pd.getMonth() + 1 === month && pd.getDate() === d
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    days.push({ date, items: dayItems })
  }
  return days
})

const monthCount = computed(() => items.value.length)

function isToday(date: Date | null) {
  return !!date && date.toDateString() === today.toDateString()
}
function isPast(date: Date | null) {
  if (!date) return false
  const d = new Date(date); d.setHours(23, 59, 59)
  return d < today
}
function prevMonth() {
  if (currentMonth.value === 1) { currentMonth.value = 12; currentYear.value-- }
  else currentMonth.value--
}
function nextMonth() {
  if (currentMonth.value === 12) { currentMonth.value = 1; currentYear.value++ }
  else currentMonth.value++
}
function goToday() {
  currentYear.value  = today.getFullYear()
  currentMonth.value = today.getMonth() + 1
}

async function loadCalendar() {
  calendarLoading.value = true
  try {
    const [oldPubs, igPosts] = await Promise.all([
      getOldCalendar(currentYear.value, currentMonth.value).catch(() => []),
      igGetCalendar(currentYear.value, currentMonth.value).catch(() => []),
    ])
    const ig: CalItem[] = (igPosts || []).map((p: any) => ({
      key: 'ig' + p.id,
      rawId: p.id,
      isIg: true,
      title: p.handle ? '@' + p.handle : (p.modelName || 'Cuenta IG'),
      contentType: p.contentType,
      scheduledAt: p.scheduledAt,
      status: p.status,
      caption: p.caption,
      link: p.link,
      errorMessage: p.errorMessage,
      photoUrl: p.profilePhotoUrl,
      postUrl: p.postUrl,
    }))
    const legacy: CalItem[] = (oldPubs || []).map((p: any) => ({
      key: 'old' + p.id,
      rawId: p.id,
      isIg: false,
      title: p.modelName,
      contentType: p.contentType,
      scheduledAt: p.scheduledAt,
      status: p.status,
      caption: p.caption,
      link: p.customLink,
      errorMessage: p.errorMessage,
    }))
    items.value = [...ig, ...legacy]
  } catch (e: any) {
    toast.error('Error al cargar el calendario', { description: e.message })
  } finally {
    calendarLoading.value = false
  }
}

watch([currentYear, currentMonth], loadCalendar)
onMounted(loadCalendar)

// ── Day detail panel ──────────────────────────────────────────────────────────
const selectedDay = ref<{ date: Date; items: CalItem[] } | null>(null)
function selectDay(day: { date: Date | null; items: CalItem[] }) {
  if (!day.date) return
  selectedDay.value = { date: day.date, items: day.items }
}
function syncSelectedDay() {
  if (!selectedDay.value) return
  const d = selectedDay.value.date
  selectedDay.value = {
    date: d,
    items: items.value.filter(p => new Date(p.scheduledAt).toDateString() === d.toDateString())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
  }
}

// ── Cancel ──────────────────────────────────────────────────────────────────────
async function cancelItem(it: CalItem) {
  try {
    if (it.isIg) await cancelIg(it.rawId)
    else await cancelOld(it.rawId)
    toast.success('Publicación cancelada')
    await loadCalendar()
    syncSelectedDay()
  } catch (e: any) {
    toast.error('No se pudo cancelar', { description: e.message })
  }
}

async function onScheduled() {
  await loadCalendar()
  syncSelectedDay()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function contentLabel(ct: string) {
  return (CONTENT_TYPE_LABELS as any)[ct] || ct
}
function statusLabel(s: string) {
  return (STATUS_LABELS as any)[s] || s
}
// Punto de color por estado
const DOT: Record<string, string> = {
  PENDING:    'bg-amber-400',
  PROCESSING: 'bg-blue-400',
  PUBLISHED:  'bg-emerald-500',
  FAILED:     'bg-red-500',
  CANCELLED:  'bg-zinc-300 dark:bg-zinc-600',
}
function dot(s: string) { return DOT[s] || 'bg-zinc-300' }
const CHIP: Record<string, string> = {
  PENDING:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PROCESSING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUBLISHED:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  FAILED:     'bg-red-500/10 text-red-600 dark:text-red-400',
  CANCELLED:  'bg-zinc-400/10 text-zinc-500 line-through',
}
function chip(s: string) { return CHIP[s] || 'bg-zinc-400/10 text-zinc-500' }
</script>

<template>
  <div class="flex gap-6 h-full min-h-0">

    <!-- ── CALENDAR ──────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <div>
            <h2 class="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">
              {{ MONTH_NAMES[currentMonth - 1] }}
              <span class="text-zinc-400 dark:text-zinc-600 font-bold">{{ currentYear }}</span>
            </h2>
            <p class="text-[11px] text-zinc-400 font-semibold mt-1">
              {{ monthCount }} publicación{{ monthCount !== 1 ? 'es' : '' }} este mes
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="prevMonth"
              class="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button @click="goToday"
              class="h-7 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              Hoy
            </button>
            <button @click="nextMonth"
              class="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Leyenda de estados -->
          <div class="hidden lg:flex items-center gap-3 text-[10px] font-bold text-zinc-400">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400"></span>Pendiente</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Publicado</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-red-500"></span>Fallido</span>
          </div>
          <Button @click="openSchedule()"
            class="gap-2 h-9 shadow-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 hover:from-violet-700 hover:to-fuchsia-700">
            <Sparkles class="w-4 h-4" />
            <span class="text-sm font-semibold">Programar publicación</span>
          </Button>
        </div>
      </div>

      <!-- Day names -->
      <div class="grid grid-cols-7 mb-2">
        <div v-for="(day, i) in DAY_NAMES" :key="day"
          :class="['text-center text-[10px] font-black uppercase tracking-widest py-2',
                   i >= 5 ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-400 dark:text-zinc-600']">
          {{ day }}
        </div>
      </div>

      <!-- Calendar grid -->
      <div class="relative flex-1">
        <div v-if="calendarLoading" class="absolute inset-0 flex items-center justify-center bg-background/60 z-10 rounded-xl">
          <Loader2 class="w-6 h-6 animate-spin text-primary" />
        </div>

        <div class="grid grid-cols-7 gap-1.5">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            @click="day.date && selectDay(day)"
            :class="[
              'group min-h-[120px] rounded-xl border p-1.5 transition-all duration-150 flex flex-col',
              day.date ? 'cursor-pointer hover:border-violet-400/50 hover:shadow-sm' : 'opacity-0 pointer-events-none',
              isToday(day.date)
                ? 'border-violet-400/60 bg-violet-500/[0.04]'
                : 'border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30',
              selectedDay?.date?.toDateString() === day.date?.toDateString()
                ? 'border-violet-500 ring-1 ring-violet-500/30' : '',
              isPast(day.date) && !isToday(day.date) ? 'opacity-60' : '',
            ]"
          >
            <!-- Day number -->
            <div class="flex items-center justify-between mb-1 px-0.5">
              <span :class="isToday(day.date)
                ? 'w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-black'
                : 'text-xs font-black leading-none text-zinc-600 dark:text-zinc-400'">
                {{ day.date?.getDate() }}
              </span>
              <button
                v-if="day.date"
                @click.stop="openSchedule(day.date)"
                class="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition-all"
                title="Programar en este día"
              >
                <Plus class="w-3 h-3" />
              </button>
            </div>

            <!-- Chips -->
            <div class="space-y-1 overflow-hidden">
              <div
                v-for="it in day.items.slice(0, 3)"
                :key="it.key"
                :class="['flex items-center gap-1 text-[9px] font-bold px-1.5 py-1 rounded-md', chip(it.status)]"
              >
                <span :class="['w-1.5 h-1.5 rounded-full shrink-0', dot(it.status)]"></span>
                <span class="tabular-nums shrink-0">{{ formatTime(it.scheduledAt) }}</span>
                <span class="truncate opacity-80">{{ it.title }}</span>
              </div>
              <div v-if="day.items.length > 3" class="text-[9px] font-bold text-zinc-400 px-1.5 pt-0.5">
                +{{ day.items.length - 3 }} más
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── DAY DETAIL PANEL ──────────────────────────────────────────────── -->
    <Transition name="slide-panel">
      <div v-if="selectedDay"
        class="w-72 shrink-0 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">

        <!-- Panel header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <p class="text-sm font-black text-zinc-900 dark:text-zinc-50 capitalize">
              {{ selectedDay.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
            </p>
            <p class="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
              {{ selectedDay.items.length }} publicación{{ selectedDay.items.length !== 1 ? 'es' : '' }}
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="openSchedule(selectedDay.date)"
              class="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center hover:bg-violet-500/20 transition-colors" title="Programar">
              <Plus class="w-3.5 h-3.5" />
            </button>
            <button @click="selectedDay = null"
              class="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 transition-colors">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div v-if="selectedDay.items.length === 0"
            class="flex flex-col items-center justify-center h-32 text-zinc-400 gap-2">
            <Calendar class="w-8 h-8 opacity-30" />
            <p class="text-xs font-medium">Sin publicaciones</p>
            <button @click="openSchedule(selectedDay.date)" class="text-xs text-violet-600 font-semibold hover:underline">
              Programar una
            </button>
          </div>

          <div
            v-for="it in selectedDay.items"
            :key="it.key"
            class="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-2"
          >
            <!-- Header: avatar + time + status -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500/20 to-violet-500/20 overflow-hidden shrink-0 flex items-center justify-center">
                  <img v-if="it.photoUrl" :src="it.photoUrl" class="w-full h-full object-cover" />
                  <Instagram v-else class="w-3.5 h-3.5 text-pink-500" />
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate leading-none">{{ it.title }}</p>
                  <p class="text-[10px] text-zinc-400 font-medium tabular-nums mt-0.5">{{ formatTime(it.scheduledAt) }} · {{ contentLabel(it.contentType) }}</p>
                </div>
              </div>
              <span :class="['text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1', chip(it.status)]">
                <span :class="['w-1.5 h-1.5 rounded-full', dot(it.status)]"></span>{{ statusLabel(it.status) }}
              </span>
            </div>

            <!-- Caption -->
            <p v-if="it.caption" class="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">{{ it.caption }}</p>

            <!-- Link / post url -->
            <a v-if="it.postUrl" :href="it.postUrl" target="_blank"
              class="flex items-center gap-1.5 text-[10px] text-violet-600 dark:text-violet-400 font-semibold hover:underline">
              <ExternalLink class="w-3 h-3" /> Ver publicación
            </a>
            <div v-else-if="it.link" class="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400">
              <a :href="it.link" target="_blank" class="truncate hover:underline font-medium">{{ it.link }}</a>
            </div>

            <!-- Error -->
            <div v-if="it.errorMessage" class="flex items-start gap-1.5 bg-red-500/10 rounded-lg p-2">
              <AlertTriangle class="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
              <p class="text-[10px] text-red-500 leading-relaxed">{{ it.errorMessage }}</p>
            </div>

            <!-- Cancel -->
            <button v-if="it.status === 'PENDING'" @click="cancelItem(it)"
              class="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg py-1.5 transition-colors">
              <Trash2 class="w-3 h-3" /> Cancelar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Modal: programar en una o varias cuentas IG listas -->
  <IgScheduleModal
    v-model:open="showSchedule"
    :assignedModels="assignedModels"
    :initialDate="scheduleDate"
    @scheduled="onScheduled"
  />
</template>

<style scoped>
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
