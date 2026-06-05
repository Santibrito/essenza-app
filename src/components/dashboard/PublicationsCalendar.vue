<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import api from '@/api'
import {
  ChevronLeft, ChevronRight, Plus, Instagram, X,
  Clock, Upload, Calendar, Loader2, AlertTriangle, CheckCircle2, Trash2
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  usePublications,
  type ScheduledPublication,
  type SocialPlatform,
  type ContentType,
  type CreatePublicationPayload,
  PLATFORM_CONTENT_TYPES,
  PLATFORM_LABELS,
  CONTENT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/usePublications'
import { useAuthStore } from '@/stores/auth'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  assignedModels?: { id: number; name: string; alias?: string }[]
}>()

const auth = useAuthStore()
const { loading, getCalendar, create, cancel } = usePublications()

// ── Calendar state ────────────────────────────────────────────────────────────
const today = new Date()
const currentYear  = ref(today.getFullYear())
const currentMonth = ref(today.getMonth() + 1) // 1-based

const publications = ref<ScheduledPublication[]>([])
const calendarLoading = ref(false)

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

// ── Calendar grid ─────────────────────────────────────────────────────────────
const calendarDays = computed(() => {
  const year  = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()

  const days: { date: Date | null; pubs: ScheduledPublication[] }[] = []

  // Padding before first day
  for (let i = 0; i < firstDay; i++) days.push({ date: null, pubs: [] })

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const pubs = publications.value.filter(p => {
      const pd = new Date(p.scheduledAt)
      return pd.getFullYear() === year && pd.getMonth() + 1 === month && pd.getDate() === d
    })
    days.push({ date, pubs })
  }

  return days
})

function isToday(date: Date | null) {
  if (!date) return false
  return date.toDateString() === today.toDateString()
}

function prevMonth() {
  if (currentMonth.value === 1) { currentMonth.value = 12; currentYear.value-- }
  else currentMonth.value--
}

function nextMonth() {
  if (currentMonth.value === 12) { currentMonth.value = 1; currentYear.value++ }
  else currentMonth.value++
}

async function loadCalendar() {
  calendarLoading.value = true
  try {
    publications.value = await getCalendar(currentYear.value, currentMonth.value)
  } catch (e: any) {
    toast.error('Error al cargar el calendario', { description: e.message })
  } finally {
    calendarLoading.value = false
  }
}

watch([currentYear, currentMonth], loadCalendar)
onMounted(loadCalendar)

// ── Day detail panel ──────────────────────────────────────────────────────────
const selectedDay = ref<{ date: Date; pubs: ScheduledPublication[] } | null>(null)

function selectDay(day: { date: Date | null; pubs: ScheduledPublication[] }) {
  if (!day.date) return
  selectedDay.value = { date: day.date, pubs: day.pubs }
}

// ── Create modal ──────────────────────────────────────────────────────────────
const showCreateModal = ref(false)
const testingAdsPower = ref(false)
const testingReel = ref(false)
const createLoading = ref(false)

// Accounts list for selected model
const accountsLoading = ref(false)
const modelAccounts = ref<any[]>([])

// Form state
const form = ref({
  modelId:     null as number | null,
  modelName:   '',
  platform:    'INSTAGRAM' as SocialPlatform,
  contentType: 'REEL' as ContentType,
  accountId:   null as number | null,
  caption:     '',
  hashtags:    '',
  customLink:  '',
  date:        '',
  time:        '09:00',
})
const selectedFile = ref<File | null>(null)
const filePreview   = ref<string | null>(null)
const dragOver      = ref(false)

const availableContentTypes = computed(() =>
  PLATFORM_CONTENT_TYPES[form.value.platform]
)

// Accounts filtered by platform
const filteredAccounts = computed(() => {
  return modelAccounts.value.filter(
    acc => acc.platform === form.value.platform
  )
})

// Computed: ¿El tipo de contenido actual necesita caption/hashtags?
const needsCaptionAndHashtags = computed(() => {
  return form.value.contentType === 'REEL' || form.value.contentType === 'TIKTOK' || form.value.contentType === 'POST'
})

// Computed: ¿El tipo de contenido actual necesita link personalizado?
const needsCustomLink = computed(() => {
  return form.value.contentType === 'STORY'
})

// Fetch AdsPower accounts for selected model
async function fetchModelAccounts(modelId: number) {
  accountsLoading.value = true
  modelAccounts.value = []
  form.value.accountId = null
  try {
    const { getAccountsByModel } = usePublications()
    modelAccounts.value = await getAccountsByModel(modelId)
    // Auto-select first account if available for current platform
    const matching = modelAccounts.value.filter(acc => acc.platform === form.value.platform)
    if (matching.length > 0) {
      form.value.accountId = matching[0].accountId
    }
  } catch (e: any) {
    toast.error('Error al cargar cuentas de la modelo', { description: e.message })
  } finally {
    accountsLoading.value = false
  }
}

// Reset content type and select account when platform changes
watch(() => form.value.platform, (p) => {
  const types = PLATFORM_CONTENT_TYPES[p]
  if (!types.includes(form.value.contentType)) {
    form.value.contentType = types[0]
  }
  // Auto-select matching account for new platform
  const matching = filteredAccounts.value
  if (matching.length > 0) {
    form.value.accountId = matching[0].accountId
  } else {
    form.value.accountId = null
  }
})

// Update modelName & fetch accounts when modelId changes
watch(() => form.value.modelId, (id) => {
  const model = props.assignedModels?.find(m => m.id === id)
  form.value.modelName = model?.name || ''
  if (id) {
    fetchModelAccounts(id)
  } else {
    modelAccounts.value = []
    form.value.accountId = null
  }
})

function openCreateModal(date?: Date) {
  // Reset form
  const firstModel = props.assignedModels?.[0]
  form.value = {
    modelId:     firstModel?.id ?? null,
    modelName:   firstModel?.name ?? '',
    platform:    'INSTAGRAM',
    contentType: 'REEL',
    accountId:   null,
    caption:     '',
    hashtags:    '',
    customLink:  '',
    date:        date ? formatDateInput(date) : formatDateInput(today),
    time:        '09:00',
  }
  selectedFile.value = null
  filePreview.value  = null
  showCreateModal.value = true

  if (firstModel?.id) {
    fetchModelAccounts(firstModel.id)
  }
}

function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) setFile(input.files[0])
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) setFile(file)
}

function setFile(file: File) {
  const allowed = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    toast.error('Formato no soportado', { description: 'Solo MP4, MOV, JPG, PNG o WEBP' })
    return
  }
  if (file.size > 500 * 1024 * 1024) { // 500MB
    toast.error('Archivo muy grande', { description: 'Máximo 500MB' })
    return
  }
  selectedFile.value = file
  if (file.type.startsWith('image/')) {
    filePreview.value = URL.createObjectURL(file)
  } else {
    filePreview.value = null
  }
}

async function submitCreate() {
  if (!selectedFile.value) {
    toast.error('Seleccioná un archivo')
    return
  }
  if (!form.value.modelId || !form.value.modelName.trim()) {
    toast.error('Seleccioná una modelo')
    return
  }
  if (!form.value.accountId) {
    toast.error('Seleccioná un usuario/perfil de esa red social')
    return
  }
  if (!form.value.date || !form.value.time) {
    toast.error('Seleccioná fecha y hora')
    return
  }

  const scheduledAt = `${form.value.date}T${form.value.time}:00`

  const payload: CreatePublicationPayload = {
    modelName:   form.value.modelName.trim(),
    platform:    form.value.platform,
    contentType: form.value.contentType,
    accountId:   form.value.accountId,
    caption:     needsCaptionAndHashtags.value ? (form.value.caption || undefined) : undefined,
    hashtags:    needsCaptionAndHashtags.value ? (form.value.hashtags || undefined) : undefined,
    customLink:  needsCustomLink.value ? (form.value.customLink || undefined) : undefined,
    scheduledAt,
  }

  createLoading.value = true
  try {
    await create(payload, selectedFile.value)
    toast.success('Publicación programada', {
      description: `${PLATFORM_LABELS[form.value.platform]} · ${form.value.date} ${form.value.time}`
    })
    showCreateModal.value = false
    await loadCalendar()
    // Refresh selected day if open
    if (selectedDay.value) {
      const d = selectedDay.value.date
      selectedDay.value = {
        date: d,
        pubs: publications.value.filter(p => {
          const pd = new Date(p.scheduledAt)
          return pd.toDateString() === d.toDateString()
        })
      }
    }
  } catch (e: any) {
    if (e.message.includes('Conflicto')) {
      toast.error('Conflicto de horario', {
        description: e.message,
        duration: 8000
      })
    } else {
      toast.error('Error al programar', { description: e.message })
    }
  } finally {
    createLoading.value = false
  }
}

// ── Cancel publication ────────────────────────────────────────────────────────
async function cancelPublication(id: number) {
  try {
    await cancel(id)
    toast.success('Publicación cancelada')
    await loadCalendar()
    if (selectedDay.value) {
      selectedDay.value = {
        ...selectedDay.value,
        pubs: selectedDay.value.pubs.filter(p => p.id !== id)
      }
    }
  } catch (e: any) {
    toast.error('No se pudo cancelar', { description: e.message })
  }
}

// ── Test AdsPower connection ──────────────────────────────────────────────────
async function testAdsPower() {
  testingAdsPower.value = true
  
  try {
    // Test directo a AdsPower sin pasar por el backend
    const adsPowerUrl = 'http://127.0.0.1:50325/api/v1/browser/start?user_id=k1d1iycv&api_key=61bffeeaa120f458df9a3960cb34d6e4008fb4588ea92687'
    
    const response = await fetch(adsPowerUrl, {
      method: 'GET',
      mode: 'no-cors' // Para evitar problemas de CORS
    })
    
    // Como usamos no-cors, no podemos leer la respuesta, pero si no da error significa que AdsPower responde
    toast.success('✅ AdsPower conectado correctamente', {
      description: 'Conexión establecida con AdsPower',
      duration: 5000
    })
    
    // Try to close the browser after 3 seconds
    setTimeout(async () => {
      try {
        const stopUrl = 'http://127.0.0.1:50325/api/v1/browser/stop?user_id=k1d1iycv&api_key=61bffeeaa120f458df9a3960cb34d6e4008fb4588ea92687'
        await fetch(stopUrl, { method: 'GET', mode: 'no-cors' })
        toast.info('Browser cerrado automáticamente')
      } catch (e) {
        console.warn('Could not auto-close browser:', e)
      }
    }, 3000)
    
  } catch (error: any) {
    console.error('AdsPower test failed:', error)
    
    let errorMsg = 'Error desconocido'
    if (error.message) {
      errorMsg = error.message
    }
    
    toast.error('❌ AdsPower no responde', {
      description: errorMsg,
      duration: 8000
    })
  } finally {
    testingAdsPower.value = false
  }
}

// ── Test Instagram Reel publication ───────────────────────────────────────────
async function testInstagramReel() {
  testingReel.value = true
  
  try {
    const response = await api.post('/automation/test/publish/instagram-reel-quick', {
      profileId: 'k1d1iycv',
      mediaUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      caption: 'Test desde ESSENZA 🚀 #automation #test',
      hashtags: '#essenza #test #automation #instagram'
    })
    
    if (response.data.success) {
      toast.success('🎉 Reel publicado correctamente!', {
        description: 'El navegador se cerrará automáticamente en 10 segundos',
        duration: 8000
      })
    } else {
      throw new Error(response.data.error || 'Error desconocido')
    }
  } catch (error: any) {
    console.error('Instagram Reel test failed:', error)
    
    let errorMsg = 'Error desconocido'
    if (error.response?.data?.error) {
      errorMsg = error.response.data.error
    } else if (error.message) {
      errorMsg = error.message
    }
    
    toast.error('❌ Error publicando Reel', {
      description: errorMsg,
      duration: 10000
    })
  } finally {
    testingReel.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function platformIcon(platform: SocialPlatform) {
  // Lucide no tiene TikTok icon — usamos texto
  return platform === 'INSTAGRAM' ? Instagram : null
}

function platformColor(platform: SocialPlatform) {
  return platform === 'INSTAGRAM'
    ? 'text-pink-500 bg-pink-500/10'
    : 'text-cyan-400 bg-cyan-400/10'
}
</script>

<template>
  <div class="flex gap-6 h-full min-h-0">

    <!-- ── CALENDAR ──────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button @click="prevMonth"
            class="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <h2 class="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight min-w-[180px] text-center">
            {{ MONTH_NAMES[currentMonth - 1] }} {{ currentYear }}
          </h2>
          <button @click="nextMonth"
            class="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <Button @click="openCreateModal()" class="gap-2 h-9">
          <Plus class="w-4 h-4" />
          <span class="text-sm font-semibold">Nueva Publicación</span>
        </Button>
        
        <Button 
          @click="testAdsPower"
          :disabled="testingAdsPower"
          variant="outline"
          class="gap-2 h-9 border-green-200 text-green-700 hover:bg-green-50"
        >
          <Loader2 v-if="testingAdsPower" class="w-4 h-4 animate-spin" />
          <span v-else class="text-lg">🔧</span>
          <span class="text-sm font-semibold">Test AdsPower</span>
        </Button>
        
        <Button 
          @click="testInstagramReel"
          :disabled="testingReel"
          variant="outline"
          class="gap-2 h-9 border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          <Loader2 v-if="testingReel" class="w-4 h-4 animate-spin" />
          <span v-else class="text-lg">🎬</span>
          <span class="text-sm font-semibold">Test Reel</span>
        </Button>
      </div>

      <!-- Day names -->
      <div class="grid grid-cols-7 mb-2">
        <div v-for="day in DAY_NAMES" :key="day"
          class="text-center text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest py-2">
          {{ day }}
        </div>
      </div>

      <!-- Calendar grid -->
      <div class="relative flex-1">
        <div v-if="calendarLoading" class="absolute inset-0 flex items-center justify-center bg-background/60 z-10 rounded-xl">
          <Loader2 class="w-6 h-6 animate-spin text-primary" />
        </div>

        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            @click="day.date && selectDay(day)"
            :class="[
              'min-h-[90px] rounded-xl border p-2 transition-all duration-150',
              day.date
                ? 'cursor-pointer hover:border-primary/40 hover:bg-primary/5'
                : 'opacity-0 pointer-events-none',
              isToday(day.date)
                ? 'border-primary/50 bg-primary/5'
                : 'border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30',
              selectedDay?.date?.toDateString() === day.date?.toDateString()
                ? 'border-primary ring-1 ring-primary/30'
                : ''
            ]"
          >
            <!-- Day number -->
            <div class="flex items-center justify-between mb-1.5">
              <span :class="[
                'text-xs font-black leading-none',
                isToday(day.date) ? 'text-primary' : 'text-zinc-700 dark:text-zinc-300'
              ]">
                {{ day.date?.getDate() }}
              </span>
              <button
                v-if="day.date"
                @click.stop="openCreateModal(day.date)"
                class="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <Plus class="w-3 h-3" />
              </button>
            </div>

            <!-- Publications dots -->
            <div class="space-y-1">
              <div
                v-for="pub in day.pubs.slice(0, 3)"
                :key="pub.id"
                :class="[
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate border',
                  pub.platform === 'INSTAGRAM' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                ]"
              >
                {{ formatTime(pub.scheduledAt) }} · {{ pub.modelName }}
              </div>
              <div v-if="day.pubs.length > 3"
                class="text-[9px] font-bold text-zinc-400 px-1.5">
                +{{ day.pubs.length - 3 }} más
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
            <p class="text-sm font-black text-zinc-900 dark:text-zinc-50">
              {{ selectedDay.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
            </p>
            <p class="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
              {{ selectedDay.pubs.length }} publicación{{ selectedDay.pubs.length !== 1 ? 'es' : '' }}
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="openCreateModal(selectedDay.date)"
              class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
              <Plus class="w-3.5 h-3.5" />
            </button>
            <button @click="selectedDay = null"
              class="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 transition-colors">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Publications list -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div v-if="selectedDay.pubs.length === 0"
            class="flex flex-col items-center justify-center h-32 text-zinc-400 gap-2">
            <Calendar class="w-8 h-8 opacity-30" />
            <p class="text-xs font-medium">Sin publicaciones</p>
            <button @click="openCreateModal(selectedDay.date)"
              class="text-xs text-primary font-semibold hover:underline">
              Programar una
            </button>
          </div>

          <div
            v-for="pub in selectedDay.pubs"
            :key="pub.id"
            class="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-2"
          >
            <!-- Time + platform -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div :class="['w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black', platformColor(pub.platform)]">
                  <Instagram v-if="pub.platform === 'INSTAGRAM'" class="w-3.5 h-3.5" />
                  <span v-else class="text-[8px] font-black">TK</span>
                </div>
                <span class="text-xs font-black text-zinc-700 dark:text-zinc-300 tabular-nums">
                  {{ formatTime(pub.scheduledAt) }}
                </span>
              </div>
              <span :class="['text-[9px] font-black px-1.5 py-0.5 rounded-md border', STATUS_COLORS[pub.status]]">
                {{ STATUS_LABELS[pub.status] }}
              </span>
            </div>

            <!-- Model + content type -->
            <div>
              <p class="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{{ pub.modelName }}</p>
              <p class="text-[10px] text-zinc-400 font-medium">{{ CONTENT_TYPE_LABELS[pub.contentType] }}</p>
            </div>

            <!-- Caption preview -->
            <p v-if="pub.caption" class="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">
              {{ pub.caption }}
            </p>

            <!-- Custom Link preview -->
            <div v-if="pub.customLink" class="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400">
              <a :href="pub.customLink" target="_blank" class="truncate hover:underline font-medium">
                {{ pub.customLink }}
              </a>
            </div>

            <!-- Error -->
            <div v-if="pub.errorMessage" class="flex items-start gap-1.5 bg-red-500/10 rounded-lg p-2">
              <AlertTriangle class="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
              <p class="text-[10px] text-red-500 leading-relaxed">{{ pub.errorMessage }}</p>
            </div>

            <!-- Cancel button -->
            <button
              v-if="pub.status === 'PENDING'"
              @click="cancelPublication(pub.id)"
              class="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg py-1.5 transition-colors"
            >
              <Trash2 class="w-3 h-3" />
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>

  <!-- ── CREATE MODAL ──────────────────────────────────────────────────────── -->
  <Dialog v-model:open="showCreateModal">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-lg font-black">Nueva Publicación</DialogTitle>
        <DialogDescription>
          Programá contenido para Instagram o TikTok. Las publicaciones deben estar separadas por al menos 15 minutos.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">

        <!-- Modelo (Select de modelos asignadas) -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Modelo</Label>
          <select
            v-model="form.modelId"
            class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option v-if="!assignedModels || assignedModels.length === 0" :value="null" disabled>
              No tenés modelos asignadas
            </option>
            <option v-for="model in assignedModels" :key="model.id" :value="model.id">
              {{ model.alias || model.name }}
            </option>
          </select>
        </div>

        <!-- Plataforma + Tipo -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Plataforma</Label>
            <select
              v-model="form.platform"
              class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="INSTAGRAM">Instagram</option>
              <option value="TIKTOK">TikTok</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Tipo</Label>
            <select
              v-model="form.contentType"
              class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option v-for="ct in availableContentTypes" :key="ct" :value="ct">
                {{ CONTENT_TYPE_LABELS[ct] }}
              </option>
            </select>
          </div>
        </div>

        <!-- Cuenta/Usuario de Red Social (AdsPower) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Cuenta de Red Social / Perfil</Label>
            <span v-if="accountsLoading" class="text-[10px] text-zinc-400 font-medium animate-pulse">Cargando cuentas...</span>
          </div>
          <select
            v-model="form.accountId"
            :disabled="accountsLoading || !form.modelId"
            class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option :value="null" disabled>
              {{ form.modelId ? (filteredAccounts.length > 0 ? 'Seleccioná una cuenta...' : 'No hay cuentas activas registradas para esta plataforma') : 'Primero seleccioná una modelo' }}
            </option>
            <option v-for="acc in filteredAccounts" :key="acc.accountId" :value="acc.accountId">
              @{{ acc.handle }} (Perfil: {{ acc.profileName }} · AdsPower: {{ acc.adsPowerId }})
            </option>
          </select>
        </div>

        <!-- Fecha + Hora -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Fecha</Label>
            <Input type="date" v-model="form.date" class="h-10" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Hora</Label>
            <Input type="time" v-model="form.time" class="h-10" />
          </div>
        </div>

        <!-- File upload -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Archivo</Label>
          <div
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent="onDrop"
            :class="[
              'relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer',
              dragOver ? 'border-primary bg-primary/5' : 'border-zinc-200 dark:border-zinc-700 hover:border-primary/50',
              selectedFile ? 'p-3' : 'p-6'
            ]"
            @click="($refs.fileInput as HTMLInputElement)?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
              class="hidden"
              @change="onFileChange"
            />

            <!-- Preview -->
            <div v-if="selectedFile" class="flex items-center gap-3">
              <img v-if="filePreview" :src="filePreview" class="w-12 h-12 rounded-lg object-cover" />
              <div v-else class="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Upload class="w-5 h-5 text-zinc-400" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{{ selectedFile.name }}</p>
                <p class="text-xs text-zinc-400">{{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB</p>
              </div>
              <button @click.stop="selectedFile = null; filePreview = null"
                class="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors">
                <X class="w-3 h-3" />
              </button>
            </div>

            <!-- Empty state -->
            <div v-else class="flex flex-col items-center gap-2 text-center">
              <Upload class="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
              <div>
                <p class="text-sm font-bold text-zinc-600 dark:text-zinc-400">Arrastrá o hacé clic para subir</p>
                <p class="text-xs text-zinc-400 mt-0.5">MP4, MOV, JPG, PNG · Máx 500MB</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Caption (solo para Reel, TikTok, Post) -->
        <div v-if="needsCaptionAndHashtags" class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Caption <span class="text-zinc-400 font-normal normal-case">(opcional)</span></Label>
          <Textarea
            v-model="form.caption"
            placeholder="Escribí el texto de la publicación..."
            class="resize-none text-sm"
            rows="3"
          />
        </div>

        <!-- Hashtags (solo para Reel, TikTok, Post) -->
        <div v-if="needsCaptionAndHashtags" class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Hashtags <span class="text-zinc-400 font-normal normal-case">(opcional)</span></Label>
          <Input
            v-model="form.hashtags"
            placeholder="#verano #lifestyle #modelo"
            class="h-10 text-sm"
          />
        </div>

        <!-- Link personalizado (solo para Story) -->
        <div v-if="needsCustomLink" class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Link Personalizado <span class="text-zinc-400 font-normal normal-case">(opcional)</span></Label>
          <Input
            v-model="form.customLink"
            placeholder="https://onlyfans.com/modelo"
            class="h-10 text-sm"
          />
          <p class="text-[10px] text-zinc-400 leading-relaxed">
            Este link se agregará a la historia. Dejalo vacío si no querés agregar ninguno.
          </p>
        </div>

      </div>

      <DialogFooter>
        <Button variant="outline" @click="showCreateModal = false" :disabled="createLoading">
          Cancelar
        </Button>
        <Button @click="submitCreate" :disabled="createLoading" class="gap-2">
          <Loader2 v-if="createLoading" class="w-4 h-4 animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          {{ createLoading ? 'Programando...' : 'Programar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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
