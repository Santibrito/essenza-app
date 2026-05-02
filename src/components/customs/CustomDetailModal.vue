<script setup>
import { ref, watch, computed } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import {
  Video, Image, Mic, Link, Send, Clock, CheckCircle2, Upload, User, Calendar,
  ChevronRight, ZoomIn, X, Download
} from 'lucide-vue-next'
import { customsApi } from '@/lib/customsApi'

const props = defineProps({
  open: { type: Boolean, required: true },
  custom: { type: Object, default: null }
})

const emit = defineEmits(['update:open', 'updated'])

const history = ref([])
const newStatus = ref('')
const comment = ref('')
const driveLink = ref('')
const saving = ref(false)

// Image viewer
const viewerOpen = ref(false)
const viewerSrc = ref('')

const isReadyForUpload = computed(() => newStatus.value === 'READY_FOR_UPLOAD')

const statusOptions = [
  { id: 'SENT', label: 'Enviado — Chat enviado a la modelo' },
  { id: 'READY_FOR_UPLOAD', label: 'Listo para subir — Contenido en Drive' },
  { id: 'COMPLETED', label: 'Completado' },
]

const typeConfig = {
  VIDEO_CALL: { icon: Video, color: 'text-sky-500', bg: 'bg-sky-500/10', label: 'Videollamada' },
  IMAGE: { icon: Image, color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Imágenes/Videos' },
  AUDIO: { icon: Mic, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Audio' },
}

const statusBadge = {
  CREATED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  READY_FOR_UPLOAD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
}

const statusLabel = {
  CREATED: 'Creado', SENT: 'Enviado', READY_FOR_UPLOAD: 'Listo para subir', COMPLETED: 'Completado',
}

const actionLabel = {
  CREATED: 'creó el custom',
  STATUS_CHANGED: 'cambió el estado',
  COMMENT_ADDED: 'agregó un comentario',
  status_changed: 'cambió el estado',
  created: 'creó el custom',
  comment_added: 'agregó un comentario',
}

const priorityConfig = {
  LOW: { label: 'Baja', class: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  NORMAL: { label: 'Normal', class: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  HIGH: { label: 'Alta', class: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
  URGENT: { label: 'Urgente', class: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
}

const templateParsed = computed(() => {
  if (!props.custom?.templateData) return {}
  try { return JSON.parse(props.custom.templateData) } catch { return {} }
})

const attachmentsParsed = computed(() => {
  if (!props.custom?.attachments) return []
  try { return JSON.parse(props.custom.attachments) } catch { return [] }
})

const typeInfo = computed(() => typeConfig[props.custom?.type] ?? typeConfig.IMAGE)
const statusInfo = computed(() => statusBadge[props.custom?.status] ?? statusBadge.CREATED)
const priorityInfo = computed(() => priorityConfig[props.custom?.priority] ?? priorityConfig.NORMAL)

watch(() => props.open, async (v) => {
  if (v && props.custom) {
    history.value = await customsApi.getHistory(props.custom.id)
    newStatus.value = props.custom.status
    comment.value = ''
    driveLink.value = ''
  }
})

function formatHistoryDate(entry) {
  const raw = entry.timestamp || entry.createdAt
  if (!raw) return 'Sin fecha'
  try {
    return new Date(raw).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return 'Fecha inválida' }
}

function formatFullDateTime(date) {
  return new Date(date).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function openImage(url) {
  viewerSrc.value = url
  viewerOpen.value = true
}

function closeViewer(e) {
  e?.stopPropagation()
  viewerOpen.value = false
}

async function downloadImage(url) {
  const a = document.createElement('a')
  a.href = url
  a.download = url.split('/').pop() || 'imagen'
  a.target = '_blank'
  a.click()
}

async function updateStatus() {
  if (!props.custom || !newStatus.value) return
  if (isReadyForUpload.value && !driveLink.value.trim()) {
    toast.error('El link de Drive es obligatorio para este estado')
    return
  }
  saving.value = true
  try {
    await customsApi.updateStatus(props.custom.id, {
      status: newStatus.value,
      comment: comment.value || undefined,
      ...(isReadyForUpload.value ? { driveLink: driveLink.value } : {}),
    })
    toast.success('Estado actualizado')
    comment.value = ''
    driveLink.value = ''
    emit('updated')
    emit('update:open', false)
  } catch {
    toast.error('Error al actualizar estado')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent 
      class="!w-[90vw] !max-w-[1200px] h-[85vh] flex flex-col gap-0 p-0 overflow-hidden"
      style="width: 90vw; max-width: 1200px;"
    >

      <!-- Header -->
      <div class="flex items-center gap-3 px-6 py-4 border-b shrink-0">
        <span v-if="custom" class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          :class="typeInfo.bg">
          <component :is="typeInfo.icon" class="w-5 h-5" :class="typeInfo.color" />
        </span>
        <div class="min-w-0 flex-1">
          <DialogTitle class="text-base font-bold tracking-tight truncate leading-tight">
            {{ custom?.modelName || custom?.model?.name || 'Sin modelo' }} — {{ typeInfo.label }}
          </DialogTitle>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold" :class="statusInfo">
              {{ statusLabel[custom?.status] }}
            </span>
            <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold" :class="priorityInfo.class">
              {{ priorityInfo.label }}
            </span>
            <span class="text-[11px] text-muted-foreground">
              #{{ custom?.id }}
            </span>
          </div>
        </div>
      </div>

      <!-- Image viewer -->
      <div v-if="viewerOpen" class="flex h-full flex-1 flex-col overflow-hidden bg-gradient-to-br from-muted/20 via-background to-muted/10">
        <div class="relative flex flex-1 items-center justify-center p-8">
          <button class="absolute right-4 top-4 rounded-lg border bg-background/90 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-background"
            @click="closeViewer">
            <X class="h-4 w-4" />
          </button>
          <button class="absolute right-16 top-4 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-2 text-sm shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-background"
            @click="downloadImage(viewerSrc)">
            <Download class="h-3.5 w-3.5" />
            Descargar
          </button>
          <img :src="viewerSrc" class="rounded-xl border-2 object-contain shadow-2xl"
            style="max-width: 900px; max-height: 650px;" @click.stop />
        </div>
      </div>

      <!-- Body -->
      <div v-else class="grid grid-cols-2 flex-1 min-h-0 overflow-hidden">

        <!-- LEFT: Info -->
        <ScrollArea>
          <div class="px-6 py-5 space-y-6">

            <!-- Meta -->
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-muted/50 space-y-1">
                <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <User class="w-3 h-3" /> Creado por
                </p>
                <p class="text-sm font-semibold">{{ custom?.createdByUser?.username || custom?.createdByUser?.name }}</p>
                <p class="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar class="w-3 h-3" />
                  {{ custom?.createdAt ? formatFullDateTime(custom.createdAt) : '—' }}
                </p>
              </div>
              <div v-if="custom?.completedByUsername" class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 space-y-1">
                <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle2 class="w-3 h-3" /> Completado por
                </p>
                <p class="text-sm font-semibold">{{ custom.completedByUsername }}</p>
                <p class="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar class="w-3 h-3" />
                  {{ custom.completedAt ? formatFullDateTime(custom.completedAt) : '—' }}
                </p>
              </div>
              <div v-else class="p-3 rounded-xl bg-muted/30 space-y-1 flex items-center justify-center">
                <p class="text-xs text-muted-foreground">Sin completar aún</p>
              </div>
            </div>

            <!-- Template data -->
            <div v-if="Object.keys(templateParsed).length" class="space-y-2">
              <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Datos del Custom</p>
              <div class="rounded-xl border overflow-hidden divide-y divide-border">
                <div v-for="(value, key) in templateParsed" :key="key" v-show="value"
                  class="flex items-start gap-3 px-4 py-2.5 bg-card hover:bg-muted/30 transition-colors">
                  <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-24 shrink-0 pt-0.5">
                    {{ key }}
                  </span>
                  <span class="text-sm text-foreground whitespace-pre-wrap break-words flex-1">{{ value }}</span>
                </div>
              </div>
            </div>

            <!-- Attachments -->
            <div v-if="attachmentsParsed.length" class="space-y-2">
              <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Imágenes de referencia</p>
              <div class="flex flex-wrap gap-3">
                <div v-for="(att, i) in attachmentsParsed" :key="i" class="space-y-1">
                  <div class="relative group cursor-pointer w-24 h-24" @click="openImage(att.url)">
                    <img :src="att.url" class="w-full h-full rounded-xl object-cover border border-border" />
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <ZoomIn class="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p v-if="att.description" class="text-[10px] text-muted-foreground text-center w-24 truncate">
                    {{ att.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Drive link -->
            <div v-if="custom?.driveLink"
              class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Link de Drive</p>
              <a :href="custom.driveLink" target="_blank"
                class="text-sm text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5 break-all">
                <Link class="w-3.5 h-3.5 shrink-0" /> {{ custom.driveLink }}
              </a>
            </div>

          </div>
        </ScrollArea>

        <!-- RIGHT: Activity + Actions -->
        <div class="flex flex-col overflow-hidden border-l">
          
          <!-- Activity feed -->
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div class="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
              <p class="text-sm font-medium text-foreground">Actividad</p>
              <span class="text-xs text-muted-foreground">{{ history.length }}</span>
            </div>

            <div v-if="!history.length" class="flex flex-1 items-center justify-center">
              <div class="text-center">
                <Clock class="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p class="text-sm text-muted-foreground">Sin actividad</p>
              </div>
            </div>

            <div v-else class="flex-1 overflow-y-auto">
              <div class="space-y-3 p-4">
                <div v-for="(entry, idx) in history" :key="entry.id ?? idx"
                  class="flex gap-3 rounded-lg p-3 transition-all"
                  :class="idx === history.length - 1 ? 'bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-blue-500' : 'hover:bg-muted/30'">
                  
                  <div class="shrink-0">
                    <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold"
                      :class="idx === history.length - 1 ? 'bg-blue-500 text-white border-blue-600' : 'bg-muted text-muted-foreground border-border'">
                      {{ (entry.createdByUser?.name || entry.user?.name || entry.username || 'S').charAt(0).toUpperCase() }}
                    </div>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="mb-1 flex items-center gap-2">
                      <span class="text-sm font-semibold text-foreground">
                        {{ entry.createdByUser?.name || entry.user?.name || entry.username || 'Sistema' }}
                      </span>
                      <span class="text-xs text-muted-foreground">{{ actionLabel[entry.action] || entry.action?.toLowerCase() || 'realizó una acción' }}</span>
                    </div>
                    <div class="mb-2 text-xs text-muted-foreground">{{ formatHistoryDate(entry) }}</div>
                    <div v-if="entry.previousStatus && entry.newStatus"
                      class="mb-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs">
                      <span>{{ statusLabel[entry.previousStatus] }}</span>
                      <span>→</span>
                      <span class="font-medium">{{ statusLabel[entry.newStatus] }}</span>
                    </div>
                    <div v-if="entry.comment" class="mt-2 rounded-lg border px-3 py-2.5 text-sm"
                      :class="idx === history.length - 1 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' : 'bg-muted/30 border-border'">
                      {{ entry.comment }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="shrink-0 border-t">
            <ScrollArea class="max-h-[280px]">
              <div class="px-3 py-3 space-y-2.5">
                <div class="space-y-2">
                  <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cambiar Estado</p>
                  <Select v-model="newStatus">
                    <SelectTrigger class="w-full h-9">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="s in statusOptions" :key="s.id" :value="s.id">
                        {{ s.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div v-if="isReadyForUpload" class="space-y-1.5">
                    <label class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Upload class="w-3 h-3" /> Link de Drive *
                    </label>
                    <input v-model="driveLink" placeholder="https://drive.google.com/..."
                      class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>

                  <textarea v-model="comment" placeholder="Comentario opcional..." rows="3"
                    class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />

                  <Button class="w-full" @click="updateStatus" :disabled="saving">
                    <Send class="w-3.5 h-3.5 mr-1.5" />
                    {{ saving ? 'Guardando...' : 'Actualizar Estado' }}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

      </div>

      <!-- Footer thumbnails -->
      <div v-if="viewerOpen && attachmentsParsed.length" class="flex shrink-0 border-t bg-muted/40 backdrop-blur-sm">
        <div class="flex items-center gap-2 overflow-x-auto border-r px-4 py-3">
          <div v-for="(att, i) in attachmentsParsed" :key="i"
            class="shrink-0 cursor-pointer rounded-lg border-2 transition-colors"
            :class="viewerSrc === att.url ? 'border-primary' : 'border-border'"
            @click.stop="viewerSrc = att.url">
            <img :src="att.url" class="h-16 w-16 rounded-md object-cover"
              :class="viewerSrc === att.url ? 'opacity-100' : 'opacity-70'" />
          </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col justify-center px-6 py-3">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</p>
          <p class="text-sm text-foreground">
            {{ attachmentsParsed.find(a => a.url === viewerSrc)?.description || 'No se puso descripción' }}
          </p>
        </div>
      </div>

    </DialogContent>
  </Dialog>
</template>
