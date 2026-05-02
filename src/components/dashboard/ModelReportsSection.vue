<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Clock,
  User,
  MessageSquare,
  Tag,
  DollarSign,
  Plus,
  X,
  Star,
  FileEdit,
  Info,
  Check,
} from 'lucide-vue-next'
import api from '@/api'

interface Model {
  id: number
  name: string
  alias?: string
}

interface Spender {
  name: string
  username: string
  amount: string
}

interface ModelReport {
  handoffNotes: string
  contentItems: string[]
  spenders: Spender[]
}

interface LastReport {
  message: string
  soldContent: string[]
  spenders: Spender[]
  createdAt: string
  fromUser: string
  fromUserName: string
}

const props = defineProps<{
  assignedModels: Model[]
  isWorking: boolean
  readOnly?: boolean
}>()

const modelReports = defineModel<Record<number, ModelReport>>('modelReports', { default: {} })
const lastReports = ref<Record<number, LastReport>>({})
const userNamesCache = ref<Record<string, string>>({})

// Computed para calcular el layout de grid óptimo para los tabs
const tabsGridLayout = computed(() => {
  const count = props.assignedModels.length
  if (count <= 4) {
    return {
      gridTemplateColumns: `repeat(${count}, 1fr)`,
      gridTemplateRows: '1fr'
    }
  } else if (count <= 6) {
    return {
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)'
    }
  } else if (count <= 8) {
    return {
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)'
    }
  } else {
    // Para más de 8, usar 5 columnas
    return {
      gridTemplateColumns: 'repeat(5, 1fr)',
      gridTemplateRows: 'auto'
    }
  }
})

// Función para obtener el nombre real de un usuario por username
async function fetchUserRealName(username: string): Promise<string> {
  if (!username) return username
  
  // Si ya está en cache, devolverlo
  if (userNamesCache.value[username]) {
    return userNamesCache.value[username]
  }
  
  try {
    // Intentar obtener el nombre real desde la API
    const res = await api.get(`/admin/users/by-username/${username}`)
    if (res.data?.name) {
      userNamesCache.value[username] = res.data.name
      return res.data.name
    }
    
    // Si no tiene name, intentar con fullName u otros campos
    if (res.data?.fullName) {
      userNamesCache.value[username] = res.data.fullName
      return res.data.fullName
    }
    
    // Si no tiene fullName, intentar con firstName + lastName
    if (res.data?.firstName && res.data?.lastName) {
      const fullName = `${res.data.firstName} ${res.data.lastName}`
      userNamesCache.value[username] = fullName
      return fullName
    }
    
    // Si solo tiene firstName
    if (res.data?.firstName) {
      userNamesCache.value[username] = res.data.firstName
      return res.data.firstName
    }
    
  } catch (error) {
    console.log(`No se pudo obtener el nombre real para ${username}:`, error)
  }
  
  // Fallback: mapeo manual para usuarios conocidos (solo si la API falló)
  const knownUsers: Record<string, string> = {
    'yisus': 'Yisus',
    'admin': 'Administrador', 
    'marketing': 'Marketing',
    'support': 'Soporte',
  }
  
  const displayName = knownUsers[username] || username
  userNamesCache.value[username] = displayName
  return displayName
}
const contentInputs = ref<Record<number, string>>({})
const contentSuggestions = ref<string[]>([])
const spenderSuggestions = ref<Array<{ name: string; username: string }>>([])
const showContentPopover = ref<Record<number, boolean>>({})
const showSpenderPopover = ref<Record<string, boolean>>({})
const contentInputRef = ref<HTMLElement | null>(null)

const filteredContentSuggestions = computed(() => {
  return (modelId: number) => {
    const input = (contentInputs.value[modelId] || '').toLowerCase()
    if (!input) return []
    return contentSuggestions.value
      .filter(s => s.toLowerCase().includes(input))
      .slice(0, 8)
  }
})

const filteredSpenderSuggestions = computed(() => {
  return (field: 'name' | 'username', value: string) => {
    const input = (value || '').toLowerCase()
    if (!input) return []
    return spenderSuggestions.value
      .filter(sp => {
        const fieldValue = field === 'name' ? sp.name : sp.username
        return fieldValue?.toLowerCase().includes(input)
      })
      .slice(0, 8)
  }
})

function getDropdownPosition(modelId: number) {
  const el = document.querySelector(`[data-model-id="${modelId}"]`)
  if (!el) return { top: '0px', left: '0px' }
  const rect = el.getBoundingClientRect()
  return {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
}

function getSpenderDropdownPosition(key: string) {
  const el = document.querySelector(`[data-spender-key="${key}"]`) as HTMLInputElement
  if (!el) return { top: '0px', left: '0px' }
  
  const rect = el.getBoundingClientRect()
  const windowHeight = window.innerHeight
  const spaceBelow = windowHeight - rect.bottom
  
  // Extraer información del key: modelId-spenderIdx-fieldType
  const parts = key.split('-')
  const fieldType = parts[parts.length - 1] as 'name' | 'username'
  const inputValue = el.value || ''
  
  // Calcular número de sugerencias que se mostrarían
  const suggestions = filteredSpenderSuggestions.value(fieldType, inputValue)
  const itemHeight = 30 // altura reducida: py-1.5 + text (antes era 36)
  const padding = 8 // padding del contenedor (py-1)
  const dynamicHeight = Math.min(suggestions.length * itemHeight + padding, 200) // máximo 200px
  
  // Si no hay sugerencias, no mostrar dropdown
  if (suggestions.length === 0) {
    return { top: '0px', left: '0px' }
  }
  
  // Si hay poco espacio abajo, abrir hacia arriba
  if (spaceBelow < dynamicHeight + 20) {
    return {
      top: `${rect.top - dynamicHeight - 2}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
    }
  }
  // Por defecto, abrir hacia abajo
  else {
    return {
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
    }
  }
}

function selectContentSuggestion(modelId: number, suggestion: string) {
  const report = getReport(modelId)
  if (!report.contentItems.includes(suggestion)) {
    report.contentItems.push(suggestion)
  }
  contentInputs.value[modelId] = ''
  showContentPopover.value[modelId] = false
}

function selectSpenderSuggestion(modelId: number, idx: number, field: 'name' | 'username', value: string) {
  const report = getReport(modelId)
  const spender = report.spenders[idx]
  if (!spender) return
  
  spender[field] = value
  
  // Auto-fill el otro campo
  const suggestion = spenderSuggestions.value.find(s => 
    (field === 'name' && s.name === value) || (field === 'username' && s.username === value)
  )
  
  if (suggestion) {
    if (field === 'name' && suggestion.username && !spender.username) {
      spender.username = suggestion.username
    } else if (field === 'username' && suggestion.name && !spender.name) {
      spender.name = suggestion.name
    }
  }
  
  showSpenderPopover.value[`${modelId}-${idx}-${field}`] = false
}

function autoFillSpender(modelId: number, idx: number, field: 'name' | 'username') {
  const report = getReport(modelId)
  const spender = report.spenders[idx]
  if (!spender) return

  const value = field === 'name' ? spender.name : spender.username
  const suggestion = spenderSuggestions.value.find(s =>
    (field === 'name' && s.name === value) || (field === 'username' && s.username === value)
  )

  if (suggestion) {
    if (field === 'name' && suggestion.username && !spender.username) {
      spender.username = suggestion.username
    } else if (field === 'username' && suggestion.name && !spender.name) {
      spender.name = suggestion.name
    }
  }
}

function getReport(modelId: number): ModelReport {
  if (!modelReports.value[modelId]) {
    modelReports.value[modelId] = { handoffNotes: '', contentItems: [], spenders: [] }
  }
  return modelReports.value[modelId]
}



function addContentItem(modelId: number) {
  const val = (contentInputs.value[modelId] ?? '').trim().toLowerCase()
  if (!val) return
  const report = getReport(modelId)
  if (!report.contentItems.includes(val)) {
    report.contentItems.push(val)
  }
  contentInputs.value[modelId] = ''
}

function removeContentItem(modelId: number, item: string) {
  const report = getReport(modelId)
  report.contentItems = report.contentItems.filter(i => i !== item)
}

function addSpender(modelId: number) {
  const report = getReport(modelId)
  if (report.spenders.length < 3) {
    report.spenders.push({ name: '', username: '', amount: '' })
  }
}

function removeSpender(modelId: number, idx: number) {
  getReport(modelId).spenders.splice(idx, 1)
}

function buildSuggestions() {
  const allContent = new Set<string>()
  const allSpenders = new Map<string, { name: string; username: string }>()

  Object.values(lastReports.value).forEach(report => {
    report.soldContent?.forEach(item => allContent.add(item))
    report.spenders?.forEach(sp => {
      const key = sp.username || sp.name
      if (key && !allSpenders.has(key)) {
        allSpenders.set(key, { name: sp.name, username: sp.username })
      }
    })
  })

  contentSuggestions.value = Array.from(allContent)
  spenderSuggestions.value = Array.from(allSpenders.values())
}

function formatRelativeTime(dateStr: string): string {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMins < 60) return `Hace ${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Hace ${diffHours}h`
  return `Hace ${Math.floor(diffHours / 24)}d`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(
  () => props.assignedModels,
  async (models) => {
    models.forEach(m => {
      if (!(m.id in modelReports.value)) {
        modelReports.value[m.id] = {
          handoffNotes: '',
          contentItems: [],
          spenders: [{ name: '', username: '', amount: '' }],
        }
      }
      if (!(m.id in contentInputs.value)) contentInputs.value[m.id] = ''
    })

    if (!models.length) return

    try {
      const ids = models.map(m => m.id).join(',')
      const res = await api.get(`/admin/models/handoff?modelIds=${ids}`)
      if (res.data) {
        // Procesar los datos y obtener nombres reales de usuarios
        const processedData = await Promise.all(
          Object.entries(res.data).map(async ([modelId, entries]: [string, any[]]) => {
            if (entries?.length) {
              const latest = entries[0]
              const username = latest.authorName || latest.fromUser || ''
              const displayName = await fetchUserRealName(username)
              
              return [modelId, {
                message: latest.message || '',
                soldContent: latest.soldContentJson ? JSON.parse(latest.soldContentJson) : [],
                spenders: latest.spendersJson ? JSON.parse(latest.spendersJson) : [],
                createdAt: latest.timestamp,
                fromUser: username,
                fromUserName: displayName,
              }]
            }
            return [modelId, null]
          })
        )
        
        // Asignar los datos procesados
        processedData.forEach(([modelId, data]) => {
          if (data) {
            lastReports.value[Number(modelId)] = data
          }
        })
        
        buildSuggestions()
      }
    } catch (err) {
      console.error('Error loading handoff data:', err)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

    <!-- ───────────────────────────── LEFT: Historial ───────────────────────────── -->
    <div data-tour="history" class="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4 h-[490px] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Clock class="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p class="text-sm font-bold text-foreground leading-none">Historial de relevo</p>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Turno anterior</p>
          </div>
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
              Información del último turno de cada modelo asignado. Útil para contexto antes de empezar.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <!-- Content -->
      <div class="flex-1 -mx-2 px-2">
        <Tabs v-if="assignedModels.length" :default-value="String(assignedModels[0]?.id)" class="w-full">
          <TabsList class="mb-4 h-auto w-full grid gap-1 p-1 bg-muted/50" :style="tabsGridLayout">
            <TabsTrigger v-for="model in assignedModels" :key="model.id" :value="String(model.id)"
              class="text-xs px-3 h-7 w-full">
              {{ model.name }}
            </TabsTrigger>
          </TabsList>

          <TabsContent v-for="model in assignedModels" :key="model.id" :value="String(model.id)" class="mt-0">
            <div v-if="lastReports[model.id]" class="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scroll">
              <!-- Meta info -->
              <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div class="flex items-center gap-2">
                  <User class="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span class="text-xs font-semibold text-amber-900 dark:text-amber-100">{{ lastReports[model.id].fromUserName }}</span>
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                  <Clock class="size-3" />
                  {{ formatDateTime(lastReports[model.id].createdAt) }}
                </div>
              </div>

              <!-- Observaciones -->
              <div v-if="lastReports[model.id].message" class="rounded-lg border border-border bg-card p-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <MessageSquare class="size-3.5 text-blue-500" />
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Observaciones</span>
                </div>
                <p class="text-xs text-foreground leading-relaxed">
                  {{ lastReports[model.id].message }}
                </p>
              </div>

              <!-- Contenido vendido -->
              <div v-if="lastReports[model.id].soldContent?.length" class="rounded-lg border border-border bg-card p-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <Tag class="size-3.5 text-purple-500" />
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contenido vendido</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge v-for="(item, i) in lastReports[model.id].soldContent" :key="i" variant="secondary"
                    class="text-[11px]">
                    {{ item }}
                  </Badge>
                </div>
              </div>

              <!-- Spenders -->
              <div v-if="lastReports[model.id].spenders?.length" class="rounded-lg border border-border bg-card p-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <DollarSign class="size-3.5 text-emerald-500" />
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spenders principales</span>
                </div>
                <div class="space-y-2">
                  <div v-for="(sp, i) in lastReports[model.id].spenders.slice(0, 3)" :key="i"
                    class="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs font-semibold text-foreground">{{ sp.name || sp.username }}</span>
                      <span v-if="sp.name && sp.username" class="text-[10px] text-muted-foreground">{{ sp.username }}</span>
                    </div>
                    <span v-if="sp.amount" class="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ${{ sp.amount }}
                    </span>
                  </div>
                  <div v-if="lastReports[model.id].spenders.length > 3" class="text-center py-1">
                    <span class="text-[10px] text-muted-foreground">+{{ lastReports[model.id].spenders.length - 3 }} más</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="flex flex-col items-center justify-center py-12 text-center">
              <Clock class="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p class="text-sm font-medium text-muted-foreground">Sin actividad previa</p>
              <p class="text-xs text-muted-foreground/60 mt-1">No hay reportes anteriores para este modelo</p>
            </div>
          </TabsContent>
        </Tabs>

        <div v-else class="flex flex-col items-center justify-center py-12 text-center">
          <User class="w-12 h-12 text-muted-foreground/20 mb-3" />
          <p class="text-sm font-medium text-muted-foreground">Sin modelos asignados</p>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────── RIGHT: Asignación ───────────────────────────── -->
    <!-- Asignación actual (solo para Chatters, no para Marketing) -->
    <div v-if="!readOnly" data-tour="current-assignment" class="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4 h-[490px] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <FileEdit class="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p class="text-sm font-bold text-foreground leading-none">Asignación actual</p>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Observaciones en tiempo real</p>
          </div>
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
              Registrá observaciones, contenido vendido y spenders durante el turno. Se incluirán en el reporte final.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <!-- Content -->
      <div class="flex-1 -mx-2 px-2">
        <Tabs v-if="assignedModels.length" :default-value="String(assignedModels[0]?.id)" class="w-full">
          <TabsList class="mb-4 h-auto w-full grid gap-1 p-1 bg-muted/50" :style="tabsGridLayout">
            <TabsTrigger v-for="model in assignedModels" :key="model.id" :value="String(model.id)"
              class="text-xs px-3 h-7 w-full">
              {{ model.name }}
            </TabsTrigger>
          </TabsList>

          <TabsContent v-for="model in assignedModels" :key="model.id" :value="String(model.id)" class="space-y-4 mt-0 max-h-[280px] overflow-y-auto pr-2 custom-scroll">
            <!-- Observaciones -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Observaciones
              </label>
              <Textarea v-model="getReport(model.id).handoffNotes" placeholder="Anotá detalles del turno…"
                :disabled="!isWorking" class="min-h-[72px] text-xs resize-none" />
            </div>

            <!-- Contenido más vendido -->
            <div class="space-y-1.5">
              <label
                class="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Tag class="size-3" /> Contenido más vendido
              </label>

              <div v-if="getReport(model.id).contentItems.length" class="flex flex-wrap gap-1.5 mb-2">
                <Badge v-for="tag in getReport(model.id).contentItems" :key="tag" variant="secondary"
                  class="text-xs gap-1 pl-2.5 pr-1.5 py-0.5">
                  {{ tag }}
                  <button class="rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors p-0.5"
                    @click="removeContentItem(model.id, tag)">
                    <X class="size-2.5" />
                  </button>
                </Badge>
              </div>

              <div class="flex gap-2">
                <div class="relative flex-1">
                  <Input v-model="contentInputs[model.id]" placeholder="Ej: mixto, foto x4, video…"
                    :disabled="!isWorking" class="h-8 text-xs" :data-model-id="model.id"
                    @keydown.enter.prevent="addContentItem(model.id)"
                    @input="showContentPopover[model.id] = contentInputs[model.id]?.length > 0"
                    @blur="setTimeout(() => showContentPopover[model.id] = false, 200)" />
                </div>

                <Teleport to="body">
                  <div v-if="showContentPopover[model.id] && filteredContentSuggestions(model.id).length > 0"
                    class="fixed z-[9999] w-[240px] rounded-md border bg-popover text-popover-foreground shadow-lg"
                    :style="getDropdownPosition(model.id)" @mousedown.prevent>
                    <div
                      class="max-h-[240px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                      <div v-for="suggestion in filteredContentSuggestions(model.id)" :key="suggestion"
                        @click="selectContentSuggestion(model.id, suggestion)"
                        class="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors">
                        {{ suggestion }}
                      </div>
                    </div>
                  </div>
                </Teleport>

                <Button variant="outline" size="sm" class="h-8 px-3 shrink-0" :disabled="!isWorking"
                  @click="addContentItem(model.id)">
                  <Plus class="size-3.5" />
                </Button>
              </div>
            </div>

            <!-- Spenders -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label
                  class="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Star class="size-3 fill-amber-400 text-amber-400" /> Spenders principales
                </label>
                <Button variant="ghost" size="sm"
                  class="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" 
                  :disabled="!isWorking || getReport(model.id).spenders.length >= 3"
                  @click="addSpender(model.id)">
                  <Plus class="size-3" /> Añadir
                </Button>
              </div>

              <div class="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                <div v-for="(sp, sIdx) in getReport(model.id).spenders" :key="sIdx" class="grid gap-2"
                  :style="{ gridTemplateColumns: getReport(model.id).spenders.length > 1 ? '1fr 1fr 5rem 2rem' : '1fr 1fr 5rem' }">

                  <!-- Nombre -->
                  <div class="relative">
                    <Input 
                      v-model="sp.name" 
                      placeholder="Nombre" 
                      class="h-8 text-xs" 
                      :disabled="!isWorking"
                      :data-spender-key="`${model.id}-${sIdx}-name`"
                      @input="showSpenderPopover[`${model.id}-${sIdx}-name`] = sp.name?.length > 0"
                      @blur="setTimeout(() => showSpenderPopover[`${model.id}-${sIdx}-name`] = false, 200)" />
                    
                    <Teleport to="body">
                      <div v-if="showSpenderPopover[`${model.id}-${sIdx}-name`] && filteredSpenderSuggestions('name', sp.name).length > 0"
                        class="fixed z-[9999] rounded-md border bg-popover text-popover-foreground shadow-lg"
                        :style="getSpenderDropdownPosition(`${model.id}-${sIdx}-name`)" @mousedown.prevent>
                        <div class="max-h-[200px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                          <div v-for="suggestion in filteredSpenderSuggestions('name', sp.name)" :key="suggestion.name"
                            @click="selectSpenderSuggestion(model.id, sIdx, 'name', suggestion.name)"
                            class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors">
                            {{ suggestion.name }}
                          </div>
                        </div>
                      </div>
                    </Teleport>
                  </div>

                  <!-- Username -->
                  <div class="relative">
                    <Input 
                      v-model="sp.username" 
                      placeholder="@usuario" 
                      class="h-8 text-xs" 
                      :disabled="!isWorking"
                      :data-spender-key="`${model.id}-${sIdx}-username`"
                      @input="showSpenderPopover[`${model.id}-${sIdx}-username`] = sp.username?.length > 0"
                      @blur="setTimeout(() => showSpenderPopover[`${model.id}-${sIdx}-username`] = false, 200)" />
                    
                    <Teleport to="body">
                      <div v-if="showSpenderPopover[`${model.id}-${sIdx}-username`] && filteredSpenderSuggestions('username', sp.username).length > 0"
                        class="fixed z-[9999] rounded-md border bg-popover text-popover-foreground shadow-lg"
                        :style="getSpenderDropdownPosition(`${model.id}-${sIdx}-username`)" @mousedown.prevent>
                        <div class="max-h-[200px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                          <div v-for="suggestion in filteredSpenderSuggestions('username', sp.username)" :key="suggestion.username"
                            @click="selectSpenderSuggestion(model.id, sIdx, 'username', suggestion.username)"
                            class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors">
                            {{ suggestion.username }}
                          </div>
                        </div>
                      </div>
                    </Teleport>
                  </div>

                  <Input v-model="sp.amount" placeholder="$" class="h-8 text-xs" :disabled="!isWorking" />
                  <Button v-if="getReport(model.id).spenders.length > 1" variant="ghost" size="icon"
                    class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    :disabled="!isWorking" @click="removeSpender(model.id, sIdx)">
                    <X class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div v-else class="flex flex-col items-center justify-center py-12 text-center">
          <User class="w-12 h-12 text-muted-foreground/20 mb-3" />
          <p class="text-sm font-medium text-muted-foreground">Sin modelos asignados</p>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scroll {
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.2) transparent;
}

.custom-scroll::-webkit-scrollbar {
  width: 4px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.2);
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.4);
}

.custom-scroll::-webkit-scrollbar-corner {
  background: transparent;
}
</style>