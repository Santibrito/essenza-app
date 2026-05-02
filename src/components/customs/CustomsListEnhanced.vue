<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  AlertCircle, RefreshCw, CheckCircle2, Package, Loader2, Clock, 
  Plus, Filter, TrendingUp, AlertTriangle, Search, ChevronLeft, ChevronRight
} from 'lucide-vue-next'
import { TYPE, STATUS, PRIO, fmt } from './customs.config.js'
import { useCustoms } from './useCustoms.js'
import CustomUrgentRow from './CustomUrgentRow.vue'
import CustomModelGroup from './CustomModelGroup.vue'
import CustomDetailSheet from './CustomDetailSheet.vue'
import CreateCustomModal from './CreateCustomModal.vue'

const props = defineProps({
  modelIds: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  isOnShift: { type: Boolean, default: false },
})

const { customs, loading, urgent, byModel, completed, load, refreshOne } = useCustoms(
  () => props.modelIds
)

// Sheet & Modal state
const selected = ref(null)
const sheetOpen = ref(false)
const createModalOpen = ref(false)

// Filters
const searchQuery = ref('')
const filterModel = ref('all')
const filterStatus = ref('all')
const filterPriority = ref('all')
const filterType = ref('all')

// Pagination
const currentPage = ref(1)
const itemsPerPage = 20

// Computed
const filteredCustoms = computed(() => {
  let result = [...customs.value]

  // Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      c.model?.name?.toLowerCase().includes(q) ||
      c.createdByUsername?.toLowerCase().includes(q) ||
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

watch([searchQuery, filterModel, filterStatus, filterPriority, filterType], () => {
  currentPage.value = 1
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">

    <!-- Header con stats -->
    <div class="grid grid-cols-4 gap-3">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.total }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle class="h-3 w-3" />
            Urgentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-red-500">{{ stats.urgent }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp class="h-3 w-3" />
            Listos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-amber-500">{{ stats.readyForUpload }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <CheckCircle2 class="h-3 w-3" />
            Completados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-green-500">{{ stats.completed }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          placeholder="Buscar por modelo, chatter, ID..."
          class="pl-9"
        />
      </div>
      <Select v-model="filterModel">
        <SelectTrigger class="w-[180px]">
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
        <SelectTrigger class="w-[150px]">
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
      <Button variant="outline" size="icon" @click="resetFilters">
        <Filter class="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" @click="load" :disabled="loading">
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </Button>
      <Button @click="openCreateModal" :disabled="!isOnShift">
        <Plus class="mr-2 h-4 w-4" />
        Nuevo Custom
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 class="w-4 h-4 animate-spin" />
      <span class="text-xs">Cargando...</span>
    </div>

    <template v-else>

      <!-- Lista paginada -->
      <div class="rounded-lg border bg-card overflow-hidden divide-y divide-border">
        <CustomUrgentRow
          v-for="c in paginatedCustoms"
          :key="c.id"
          :custom="c"
          @open="openSheet"
        />
      </div>

      <!-- Empty state -->
      <div
        v-if="!paginatedCustoms.length"
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
      <div v-if="totalPages > 1" class="flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
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
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <span class="text-sm">
            Página {{ currentPage }} de {{ totalPages }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </div>

    </template>
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
