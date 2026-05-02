<script setup>
import { ref, onMounted, computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'vue-sonner'
import {
  Video, Image, Mic, ArrowRight, RefreshCw, Loader2, Inbox,
  CheckCircle2, Send, FolderUp, FilePlus2,
} from 'lucide-vue-next'
import { customsApi } from '@/lib/customsApi'
import CustomCard from './CustomCard.vue'
import CustomDetailModal from './CustomDetailModal.vue'

// State
const customs = ref([])
const loading = ref(false)
const isDraggingOver = ref(null)
const showMoveDialog = ref(false)
const showDetailModal = ref(false)
const selectedCustom = ref(null)
const moveCustom = ref(null)
const moveToStatus = ref('')
const moveComment = ref('')
const moveDriveLink = ref('')

// Columns
const columns = [
  {
    id: 'CREATED',
    title: 'Creados',
    icon: FilePlus2,
    accentClass: 'border-t-slate-400 dark:border-t-slate-500',
    countClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    dropActive: 'border-slate-400/60 bg-slate-50/80 dark:bg-slate-900/40',
  },
  {
    id: 'SENT',
    title: 'Enviados',
    icon: Send,
    accentClass: 'border-t-sky-400 dark:border-t-sky-500',
    countClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    dropActive: 'border-sky-400/60 bg-sky-50/80 dark:bg-sky-900/20',
  },
  {
    id: 'READY_FOR_UPLOAD',
    title: 'Listos para Subir',
    icon: FolderUp,
    accentClass: 'border-t-amber-400 dark:border-t-amber-500',
    countClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    dropActive: 'border-amber-400/60 bg-amber-50/80 dark:bg-amber-900/20',
  },
  {
    id: 'COMPLETED',
    title: 'Completados',
    icon: CheckCircle2,
    accentClass: 'border-t-emerald-400 dark:border-t-emerald-500',
    countClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    dropActive: 'border-emerald-400/60 bg-emerald-50/80 dark:bg-emerald-900/20',
  },
]

// Computed
const customsByStatus = computed(() => {
  const g = {}
  columns.forEach(col => { g[col.id] = customs.value.filter(c => c.status === col.id) })
  return g
})

const targetColumn = computed(() => columns.find(c => c.id === moveToStatus.value))

// Helpers
async function loadCustoms() {
  loading.value = true
  try {
    customs.value = (await customsApi.list()) || []
  } catch {
    toast.error('Error al cargar customs')
  } finally {
    loading.value = false
  }
}

function openDetail(custom) {
  selectedCustom.value = custom
  showDetailModal.value = true
}

function handleDragOver(e, colId) {
  e.preventDefault()
  isDraggingOver.value = colId
}

function handleDragLeave(e) {
  const related = e.relatedTarget
  if (!related || !e.currentTarget.contains(related)) {
    isDraggingOver.value = null
  }
}

function handleDrop(e, status) {
  e.preventDefault()
  isDraggingOver.value = null
  const id = parseInt(e.dataTransfer.getData('text/plain'))
  const custom = customs.value.find(c => c.id === id)
  if (custom && custom.status !== status) {
    moveCustom.value = custom
    moveToStatus.value = status
    moveComment.value = ''
    moveDriveLink.value = ''
    showMoveDialog.value = true
  }
}

async function confirmMove() {
  if (!moveComment.value.trim()) { toast.error('El comentario es obligatorio'); return }
  if (moveToStatus.value === 'READY_FOR_UPLOAD' && !moveDriveLink.value.trim()) {
    toast.error('El link de Drive es obligatorio para "Listo para subir"'); return
  }
  try {
    await customsApi.updateStatus(moveCustom.value.id, {
      status: moveToStatus.value,
      comment: moveComment.value,
      driveLink: moveDriveLink.value || undefined,
    })
    toast.success('Estado actualizado correctamente')
    showMoveDialog.value = false
    loadCustoms()
  } catch {
    toast.error('Error al actualizar estado')
  }
}

onMounted(loadCustoms)
</script>

<template>
  <div class="flex flex-col gap-6 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500" data-tour="customs-kanban">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="space-y-1">
        <h2 class="text-2xl font-semibold tracking-tight">Gestión de Customs</h2>
        <p class="text-sm text-muted-foreground">
          Arrastrá las tarjetas para cambiar su estado, o hacé click para ver los detalles.
        </p>
      </div>
      <Button variant="outline" size="sm" class="gap-2" :disabled="loading" @click="loadCustoms">
        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
        <RefreshCw v-else class="w-4 h-4" />
        Actualizar
      </Button>
    </div>

    <!-- Kanban -->
    <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <div v-for="(column, colIndex) in columns" :key="column.id"
        class="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-3 duration-500"
        :style="{ animationDelay: `${colIndex * 75}ms` }" @drop="handleDrop($event, column.id)"
        @dragover="handleDragOver($event, column.id)" @dragleave="handleDragLeave($event)">
        
        <!-- Column header -->
        <Card :class="[
          'border-t-2 transition-all duration-200',
          column.accentClass,
          isDraggingOver === column.id ? 'shadow-md ring-1 ring-ring/40' : '',
        ]">
          <CardHeader class="py-3 px-4">
            <CardTitle class="text-sm font-medium flex items-center justify-between">
              <span class="flex items-center gap-2 text-foreground/80">
                <component :is="column.icon" class="w-4 h-4" />
                {{ column.title }}
              </span>
              <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums', column.countClass]">
                {{ customsByStatus[column.id]?.length || 0 }}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <!-- Drop zone -->
        <div :class="[
          'flex-1 min-h-[600px] rounded-lg border-2 border-dashed p-2 transition-all duration-200',
          isDraggingOver === column.id
            ? ['scale-[1.01]', column.dropActive]
            : 'border-border/40 bg-muted/10',
        ]">
          <ScrollArea class="h-[600px]">
            <div class="space-y-2 pr-1">

              <!-- Skeleton -->
              <template v-if="loading">
                <div v-for="i in 3" :key="i" class="animate-pulse">
                  <Card class="opacity-40">
                    <CardContent class="p-4 space-y-2">
                      <div class="h-3 w-2/3 rounded bg-muted" />
                      <div class="h-3 w-1/2 rounded bg-muted" />
                      <div class="h-3 w-1/3 rounded bg-muted" />
                    </CardContent>
                  </Card>
                </div>
              </template>

              <!-- Empty -->
              <div v-else-if="!customsByStatus[column.id]?.length"
                class="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/30">
                <Inbox class="w-8 h-8" />
                <p class="text-xs">Sin customs</p>
              </div>

              <!-- Cards -->
              <template v-else>
                <div v-for="(custom, ci) in customsByStatus[column.id]" :key="custom.id"
                  class="animate-in fade-in zoom-in-95 duration-300" :style="{ animationDelay: `${ci * 45}ms` }">
                  <CustomCard :custom="custom" draggable="true" class="cursor-grab active:cursor-grabbing"
                    @dragstart="e => e.dataTransfer.setData('text/plain', custom.id.toString())"
                    @click="openDetail" />
                </div>
              </template>

            </div>
          </ScrollArea>
        </div>
      </div>
    </div>

    <!-- Detail modal -->
    <CustomDetailModal :open="showDetailModal" :custom="selectedCustom" @update:open="showDetailModal = $event"
      @updated="loadCustoms" />

    <!-- Move dialog -->
    <Dialog v-model:open="showMoveDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-base">
            Cambiar estado
            <ArrowRight class="w-4 h-4 text-muted-foreground" />
            <span class="text-primary">{{ targetColumn?.title }}</span>
          </DialogTitle>
        </DialogHeader>

        <div class="space-y-4 py-1">
          <div v-if="moveCustom" class="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
            <div class="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <component :is="moveCustom.type === 'VIDEO_CALL' ? Video : moveCustom.type === 'IMAGE' ? Image : Mic"
                class="w-3.5 h-3.5 text-primary" />
            </div>
            <span class="text-sm font-medium flex-1 truncate">{{ moveCustom.modelName || moveCustom.model?.name || 'Sin modelo' }}</span>
            <Badge variant="outline" class="text-xs shrink-0">{{ moveCustom.priority }}</Badge>
          </div>

          <div v-if="moveToStatus === 'READY_FOR_UPLOAD'" class="space-y-1.5">
            <Label class="text-xs font-medium">
              Link de Drive <span class="text-destructive">*</span>
            </Label>
            <Input v-model="moveDriveLink" placeholder="https://drive.google.com/…" class="text-sm h-9" />
            <p class="text-[11px] text-muted-foreground">
              El chatter usará este link para descargar el contenido.
            </p>
          </div>

          <div class="space-y-1.5">
            <Label class="text-xs font-medium">
              Comentario <span class="text-destructive">*</span>
            </Label>
            <Textarea v-model="moveComment" placeholder="Describí el cambio de estado o agregá observaciones…"
              class="text-sm resize-none" rows="3" />
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button variant="ghost" size="sm" @click="showMoveDialog = false">Cancelar</Button>
          <Button size="sm" @click="confirmMove">Confirmar cambio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>

<style scoped>
[draggable="true"]:active {
  opacity: 0.55;
}
</style>
