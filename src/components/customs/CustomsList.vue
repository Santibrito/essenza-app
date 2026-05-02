<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  AlertTriangle, RefreshCw, CheckCircle2, Package, Loader2, Clock, 
  Plus, Filter, TrendingUp, ChevronLeft, ChevronRight, User, ExternalLink, Info
} from 'lucide-vue-next'
import { TYPE, STATUS, PRIO, fmt } from './customs.config.js'
import { useCustoms } from './useCustoms.js'
import CustomDetailSheet from './CustomDetailSheet.vue'
import CreateCustomModal from './CreateCustomModal.vue'

const props = defineProps({
  modelIds: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  isOnShift: { type: Boolean, default: false },
  filterStatus: { type: String, default: null },
  showOnlyPending: { type: Boolean, default: false },
})

const { customs, loading, urgent, byModel, completed, load, refreshOne } = useCustoms(
  () => props.modelIds
)

// User names cache
const userNamesCache = ref({})
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://service-production-1ef2.up.railway.app/api/v1'

// Función para obtener el nombre real de un usuario por username
async function fetchUserRealName(username) {
  if (!username) return username
  
  // Check cache first
  if (userNamesCache.value[username]) {
    return userNamesCache.value[username]
  }
  
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${apiUrl}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const users = await res.json()
      const user = users.find(u => u.username === username)
      if (user?.name) {
        userNamesCache.value[username] = user.name
        return user.name
      }
    }
  } catch (error) {
    console.log(`No se pudo obtener el nombre real para ${username}`)
  }
  
  // Fallback: mapeo manual para usuarios conocidos
  const knownUsers = {
    'yisus': 'Yisus',
    'admin': 'Administrador', 
    'marketing': 'Marketing',
    'support': 'Soporte',
  }
  
  const displayName = knownUsers[username] || username
  userNamesCache.value[username] = displayName
  return displayName
}

// Sheet & Modal state
const selected = ref(null)
const sheetOpen = ref(false)
const createModalOpen = ref(false)

// Filters
const searchQuery = ref('')
const filterModel = ref('all')
const filterStatus = ref(props.filterStatus || 'all')
const filterPriority = ref('all')
const filterType = ref('all')

// Pagination
const currentPage = ref(1)
const itemsPerPage = 20

// Computed
const customsWithRealNames = computed(() => {
  return customs.value.map(c => ({
    ...c,
    displayCreatedBy: userNamesCache.value[c.createdByUsername] || c.createdByUsername || '—',
    displayCompletedBy: userNamesCache.value[c.completedByUsername] || c.completedByUsername || '—'
  }))
})

const filteredCustoms = computed(() => {
  let result = [...customsWithRealNames.value]

  // Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      c.model?.name?.toLowerCase().includes(q) ||
      c.displayCreatedBy?.toLowerCase().includes(q) ||
      c.displayCompletedBy?.toLowerCase().includes(q) ||
      c.id.toString().includes(q)
    )
  }

  // Filters
  if (filterModel.value !== 'all') {
    result = result.filter(c => c.model?.id === parseInt(filterModel.value))
  }
  if (filterStatus.value !== 'all') {
    result = result.filter(c => c.status === filterStatus.value)
  }
  if (filterPriority.value !== 'all') {
    result = result.filter(c => c.priority === filterPriority.value)
  }
  if (filterType.value !== 'all') {
    result = result.filter(c => c.type === filterType.value)
  }

  // Ordenar: completados siempre al final
  result.sort((a, b) => {
    const aCompleted = a.status === 'COMPLETED' ? 1 : 0
    const bCompleted = b.status === 'COMPLETED' ? 1 : 0
    if (aCompleted !== bCompleted) return aCompleted - bCompleted
    // Si ambos tienen el mismo estado de completado, ordenar por fecha (más recientes primero)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return result
})

const paginatedCustoms = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredCustoms.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredCustoms.value.length / itemsPerPage))

const stats = computed(() => ({
  total: customs.value.length,
  urgent: customs.value.filter(c => c.priority === 'URGENT').length,
  readyForUpload: customs.value.filter(c => c.status === 'READY_FOR_UPLOAD').length,
  completed: completed.value.length,
}))

// Watch customs to load user names
watch(customs, async (newCustoms) => {
  const usernames = new Set()
  newCustoms.forEach(c => {
    if (c.createdByUsername) usernames.add(c.createdByUsername)
    if (c.completedByUsername) usernames.add(c.completedByUsername)
  })
  
  // Load all unique usernames
  for (const username of usernames) {
    if (!userNamesCache.value[username]) {
      await fetchUserRealName(username)
    }
  }
}, { immediate: true })

// Methods
function openSheet(custom) {
  selected.value = custom
  sheetOpen.value = true
}

function openCreateModal() {
  if (!props.isOnShift) {
    // toast.error('Necesitás estar en turno para crear customs')
    return
  }
  createModalOpen.value = true
}

async function onCompleted(id) {
  await load()
}

async function onCommented(id) {
  const updated = await refreshOne(id)
  if (updated && selected.value?.id === id) {
    selected.value = updated
  }
}

async function onCreated() {
  await load()
}

function resetFilters() {
  searchQuery.value = ''
  filterModel.value = 'all'
  filterStatus.value = 'all'
  filterPriority.value = 'all'
  filterType.value = 'all'
  currentPage.value = 1
}

function getStatusBorderClass(status) {
  switch (status) {
    case 'CREATED': return 'border-l-zinc-500/50'
    case 'SENT': return 'border-l-blue-500/50'
    case 'READY_FOR_UPLOAD': return 'border-l-amber-500/50'
    case 'COMPLETED': return 'border-l-emerald-500/50'
    default: return 'border-l-zinc-500/50'
  }
}

watch([searchQuery, filterModel, filterStatus, filterPriority, filterType], () => {
  currentPage.value = 1
})

// Watch modelIds to reload when they change
watch(() => props.modelIds, (newIds, oldIds) => {
  // Only reload if the actual IDs changed, not just the array reference
  if (JSON.stringify(newIds) !== JSON.stringify(oldIds)) {
    load()
  }
}, { immediate: false })

onMounted(load)
</script>

<template>
  <div class="space-y-4">

    <!-- Header con título y botón -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-black tracking-tight">Customs</h2>
        <p class="text-sm text-muted-foreground mt-0.5">Gestión de contenido personalizado para fans</p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button 
              data-tour="customs-create"
              size="sm" 
              @click="openCreateModal" 
              :disabled="!isOnShift"
              class="h-9"
            >
              <Plus class="mr-1.5 h-4 w-4" />
              Nuevo Custom
            </Button>
          </TooltipTrigger>
          <TooltipContent v-if="!isOnShift">
            <p class="text-xs">Necesitás estar en turno para crear customs</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-4 gap-3">
      <!-- Total -->
      <div data-tour="customs-filters" class="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Package class="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest">Total</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                  <Info class="w-3 h-3 text-muted-foreground/40" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">Total de customs en el sistema</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p class="text-3xl font-black tabular-nums">{{ stats.total }}</p>
      </div>

      <!-- Urgentes -->
      <div class="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10">
              <AlertTriangle class="w-3.5 h-3.5 text-red-500" />
            </div>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest">Urgentes</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                  <Info class="w-3 h-3 text-muted-foreground/40" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">Customs marcados como urgentes que requieren atención inmediata</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p class="text-3xl font-black tabular-nums text-red-500">{{ stats.urgent }}</p>
      </div>

      <!-- Listos -->
      <div class="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500/10">
              <TrendingUp class="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest">Listos</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                  <Info class="w-3 h-3 text-muted-foreground/40" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">Customs listos para subir y enviar al fan</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p class="text-3xl font-black tabular-nums text-amber-500">{{ stats.readyForUpload }}</p>
      </div>

      <!-- Completados -->
      <div class="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10">
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest">Completados</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                  <Info class="w-3 h-3 text-muted-foreground/40" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">Customs ya enviados al fan y completados</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p class="text-3xl font-black tabular-nums text-emerald-500">{{ stats.completed }}</p>
      </div>
    </div>

    <!-- Filters Card -->
    <div class="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/10">
            <Filter class="w-3.5 h-3.5 text-violet-500" />
          </div>
          <div>
            <p class="text-sm font-bold text-foreground leading-none">
              {{ showOnlyPending ? 'Customs Pendientes de Procesar' : 'Filtros' }}
            </p>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
              {{ showOnlyPending ? 'Estado: CREADO - Requiere acción' : 'Buscar y filtrar customs' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button v-if="!showOnlyPending" variant="ghost" size="sm" @click="resetFilters" class="h-8 text-xs">
            Limpiar
          </Button>
          <Button variant="outline" size="sm" @click="load" :disabled="loading" class="h-8">
            <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
          </Button>
        </div>
      </div>

      <div v-if="!showOnlyPending" class="grid grid-cols-4 gap-3">
        <div class="col-span-2">
          <Input
            v-model="searchQuery"
            placeholder="Buscar por modelo, chatter, ID..."
            class="h-9"
          />
        </div>
        <Select v-model="filterModel">
          <SelectTrigger class="h-9">
            <SelectValue placeholder="Todas las modelos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las modelos</SelectItem>
            <SelectItem v-for="m in models" :key="m.id" :value="m.id.toString()">
              {{ m.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filterStatus">
          <SelectTrigger class="h-9">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="CREATED">Creado</SelectItem>
            <SelectItem value="SENT">Enviado</SelectItem>
            <SelectItem value="READY_FOR_UPLOAD">Listo</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div v-else class="grid grid-cols-2 gap-3">
        <div>
          <Input
            v-model="searchQuery"
            placeholder="Buscar por modelo, chatter, ID..."
            class="h-9"
          />
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="rounded-2xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="text-xs font-semibold w-[200px]">Modelo</TableHead>
            <TableHead class="text-xs font-semibold">Estado</TableHead>
            <TableHead class="text-xs font-semibold">Tipo</TableHead>
            <TableHead class="text-xs font-semibold">Reportó</TableHead>
            <TableHead class="text-xs font-semibold">Envió</TableHead>
            <TableHead class="text-xs font-semibold">Fecha</TableHead>
            <TableHead class="text-right text-xs font-semibold px-6">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody v-if="!loading">
          <TableRow 
            v-for="c in paginatedCustoms" 
            :key="c.id"
            class="cursor-pointer hover:bg-muted/50 transition-colors border-l-4"
            :class="getStatusBorderClass(c.status)"
            @click="openSheet(c)"
          >
            <!-- Modelo -->
            <TableCell class="py-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="TYPE[c.type]?.bg || 'bg-zinc-500/10'">
                  <component v-if="TYPE[c.type]?.icon" :is="TYPE[c.type]?.icon" class="w-3.5 h-3.5" :class="TYPE[c.type]?.cls" />
                  <Package v-else class="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold truncate">{{ c.model?.name }}</p>
                  <p class="text-[10px] text-muted-foreground">ID: {{ c.id }}</p>
                </div>
              </div>
            </TableCell>

            <!-- Estado -->
            <TableCell class="py-3">
              <Badge variant="outline" class="text-[10px]" :class="STATUS[c.status]?.cls">
                {{ STATUS[c.status]?.label }}
              </Badge>
            </TableCell>

            <!-- Tipo -->
            <TableCell class="py-3">
              <div class="flex items-center gap-1.5">
                <span class="text-xs">{{ TYPE[c.type]?.label }}</span>
                <Badge v-if="c.priority === 'URGENT'" variant="outline"
                  class="text-[10px] bg-red-500/10 text-red-500 border-red-500/20 gap-1">
                  <AlertTriangle class="w-2.5 h-2.5" />
                  URGENTE
                </Badge>
              </div>
            </TableCell>

            <!-- Reportó -->
            <TableCell class="py-3">
              <span class="text-xs text-muted-foreground">{{ c.displayCreatedBy }}</span>
            </TableCell>

            <!-- Envió -->
            <TableCell class="py-3">
              <span class="text-xs text-muted-foreground">{{ c.displayCompletedBy }}</span>
            </TableCell>

            <!-- Fecha -->
            <TableCell class="py-3">
              <span class="text-xs text-muted-foreground tabular-nums">{{ fmt(c.createdAt) }}</span>
            </TableCell>

            <!-- Acciones -->
            <TableCell class="py-3 text-right px-6" @click.stop>
              <div class="flex items-center justify-end gap-1.5">
                <a v-if="c.driveLink" :href="c.driveLink" target="_blank">
                  <Button variant="ghost" size="sm" class="h-8 gap-1.5 text-xs">
                    <ExternalLink class="w-3 h-3" /> Drive
                  </Button>
                </a>
                <Button size="sm" class="h-8 text-xs" @click="openSheet(c)">
                  Ver detalles
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 class="w-4 h-4 animate-spin" />
        <span class="text-xs">Cargando...</span>
      </div>

      <!-- Empty state -->
      <div
        v-if="!loading && !paginatedCustoms.length"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <Clock class="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p class="text-sm font-medium">No se encontraron customs</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ searchQuery || filterModel !== 'all' || filterStatus !== 'all' 
            ? 'Probá ajustando los filtros' 
            : 'Los customs aparecerán aquí cuando se creen' }}
        </p>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && totalPages > 1" class="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
        <p class="text-xs text-muted-foreground">
          Mostrando {{ (currentPage - 1) * itemsPerPage + 1 }} a 
          {{ Math.min(currentPage * itemsPerPage, filteredCustoms.length) }} de 
          {{ filteredCustoms.length }} customs
        </p>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === 1"
            @click="currentPage--"
            class="h-8"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </Button>
          <span class="text-xs font-medium px-2">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
            class="h-8"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>

  <!-- Sheet de detalle -->
  <CustomDetailSheet
    :open="sheetOpen"
    :custom="selected"
    @update:open="sheetOpen = $event"
    @completed="onCompleted"
    @commented="onCommented"
  />

  <!-- Modal de creación -->
  <CreateCustomModal
    :open="createModalOpen"
    :models="models"
    @update:open="createModalOpen = $event"
    @created="onCreated"
  />
</template>
