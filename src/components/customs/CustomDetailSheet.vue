<script setup>
import { ref, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import {
  ExternalLink,
  Send,
  MessageSquare,
  AlertCircle,
  Loader2,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  ZoomIn,
  Download,
  X,
  ImageIcon,
  RefreshCw,
  Plus,
} from 'lucide-vue-next'
import { customsApi } from '@/lib/customsApi'
import {
  TYPE,
  STATUS,
  PRIO,
  HISTORY_ACTION,
  STATUS_LABEL,
  FIELD_LABELS,
  parseTemplate,
  fmt,
} from './customs.config.js'

const props = defineProps({
  open:   { type: Boolean, required: true },
  custom: { type: Object,  default: null  },
})
const emit = defineEmits(['update:open', 'completed', 'commented'])

const comment     = ref('')
const sending     = ref(false)
const commenting  = ref(false)
const confirmSend = ref(false)
const viewerOpen  = ref(false)
const viewerSrc   = ref('')

const selType   = computed(() => TYPE[props.custom?.type]     ?? TYPE.IMAGE)
const selStatus = computed(() => STATUS[props.custom?.status] ?? STATUS.CREATED)
const selPrio   = computed(() => PRIO[props.custom?.priority] ?? PRIO.NORMAL)
const selTpl    = computed(() => parseTemplate(props.custom?.templateData))
const selAtt    = computed(() => {
  try { return JSON.parse(props.custom?.attachments || '[]') } catch { return [] }
})

function historyUser(h) {
  return h.createdByUser?.username || h.user?.username || h.username || 'Sistema'
}

function close() {
  comment.value = ''
  confirmSend.value = false
  viewerOpen.value = false
  emit('update:open', false)
}

function openImage(url) {
  viewerSrc.value = url
  viewerOpen.value = true
}

function closeViewer(e) {
  e?.stopPropagation()
  viewerOpen.value = false
}

async function markCompleted() {
  if (!props.custom) return
  sending.value = true
  try {
    await customsApi.updateStatus(props.custom.id, {
      status: 'COMPLETED',
      comment: 'Contenido enviado al fan',
    })
    toast.success('Custom completado')
    confirmSend.value = false
    emit('completed', props.custom.id)
    close()
  } catch {
    toast.error('Error al completar')
  } finally {
    sending.value = false
  }
}

async function sendComment() {
  if (!comment.value.trim() || !props.custom) return
  commenting.value = true
  try {
    await customsApi.addComment(props.custom.id, comment.value)
    toast.success('Comentario agregado')
    emit('commented', props.custom.id)
    comment.value = ''
  } catch {
    toast.error('Error al agregar comentario')
  } finally {
    commenting.value = false
  }
}

function downloadImage(url, e) {
  e?.stopPropagation()
  const a = document.createElement('a')
  a.href = url
  a.download = url.split('/').pop() || 'imagen'
  a.target = '_blank'
  a.click()
}

/* History entry helpers */
function historyDotClass(action) {
  if (action === 'CREATED')
    return 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
  if (action === 'COMPLETED')
    return 'bg-gradient-to-br from-green-500/20 to-teal-500/20 border-2 border-green-500/40 shadow-sm shadow-green-500/20'
  if (action === 'STATUS_CHANGED')
    return 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-2 border-blue-500/40 shadow-sm shadow-blue-500/20'
  if (action === 'COMMENT_ADDED')
    return 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/40 shadow-sm shadow-purple-500/20'
  return 'bg-gradient-to-br from-zinc-500/10 to-zinc-600/10 border-2 border-zinc-500/30'
}
function historyIconClass(action) {
  if (action === 'CREATED') return 'text-emerald-600 dark:text-emerald-400'
  if (action === 'COMPLETED') return 'text-green-600 dark:text-green-400'
  if (action === 'STATUS_CHANGED') return 'text-blue-600 dark:text-blue-400'
  if (action === 'COMMENT_ADDED') return 'text-purple-600 dark:text-purple-400'
  return 'text-muted-foreground'
}
</script>

<template>
  <!-- ─── Main dialog ──────────────────────────────────────────────────── -->
  <Dialog :open="open" @update:open="val => !val && close()">
    <DialogContent
      class="flex h-[75vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
    >

      <!-- ── Header ──────────────────────────────────────────────────── -->
      <DialogHeader
        v-if="custom"
        class="shrink-0 space-y-3 border-b px-6 pb-4 pt-5"
      >
        <!-- Icon + title -->
        <div class="flex items-start gap-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted"
          >
            <component :is="selType.icon" class="h-5 w-5 text-foreground" />
          </div>
          <div class="min-w-0 flex-1">
            <DialogTitle class="truncate text-lg font-medium leading-snug">
              {{ custom.model?.name }}
            </DialogTitle>
            <DialogDescription class="mt-0.5 text-sm text-muted-foreground">
              {{ selType.label }} · #{{ custom.id }}
            </DialogDescription>
          </div>
        </div>

        <!-- Badges + meta -->
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="outline" :class="selStatus.cls">{{ selStatus.label }}</Badge>
          <Badge variant="outline" :class="selPrio.cls">{{ selPrio.label }}</Badge>
          <div class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <User class="h-3.5 w-3.5" />
            <span>{{ custom.createdByUsername || '—' }}</span>
            <span class="opacity-40">·</span>
            <Calendar class="h-3.5 w-3.5" />
            <span>{{ fmt(custom.createdAt) }}</span>
          </div>
        </div>

        <!-- CTA banner: READY_FOR_UPLOAD -->
        <div
          v-if="custom.status === 'READY_FOR_UPLOAD'"
          class="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3"
        >
          <AlertCircle class="h-4 w-4 shrink-0 text-muted-foreground" />
          <p class="flex-1 text-sm text-muted-foreground">
            El contenido está listo — envialo al fan
          </p>
          <a v-if="custom.driveLink" :href="custom.driveLink" target="_blank">
            <Button variant="outline" size="sm" class="gap-1.5">
              <ExternalLink class="h-3.5 w-3.5" />
              Drive
            </Button>
          </a>
          <template v-if="!confirmSend">
            <Button size="sm" class="gap-1.5" @click="confirmSend = true">
              <Send class="h-3.5 w-3.5" />
              Marcar enviado
            </Button>
          </template>
          <template v-else>
            <Button variant="outline" size="sm" @click="confirmSend = false">
              Cancelar
            </Button>
            <Button size="sm" :disabled="sending" @click="markCompleted">
              <Loader2 v-if="sending" class="mr-1 h-3.5 w-3.5 animate-spin" />
              Confirmar
            </Button>
          </template>
        </div>

        <!-- Completed info -->
        <div
          v-if="custom.completedByUsername"
          class="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <CheckCircle2 class="h-4 w-4 text-green-500" />
          <span>
            Completado por
            <strong class="font-medium text-foreground">{{ custom.completedByUsername }}</strong>
            · {{ fmt(custom.completedAt) }}
          </span>
        </div>
      </DialogHeader>

      <!-- ─── Image viewer (fullscreen in dialog) ─────────────────────── -->
      <div
        v-if="viewerOpen"
        class="flex h-full flex-1 flex-col overflow-hidden bg-gradient-to-br from-muted/20 via-background to-muted/10"
      >
        <!-- Main expanded image -->
        <div class="relative flex flex-1 items-center justify-center p-8">
          <!-- Close button -->
          <button
            class="absolute right-4 top-4 rounded-lg border bg-background/90 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-background"
            @click="closeViewer"
          >
            <X class="h-4 w-4" />
          </button>

          <!-- Download button -->
          <button
            class="absolute right-16 top-4 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-2 text-sm shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-background"
            @click="downloadImage(viewerSrc, $event)"
          >
            <Download class="h-3.5 w-3.5" />
            Descargar
          </button>

          <img
            :src="viewerSrc"
            class="rounded-xl border-2 object-contain shadow-2xl"
            style="max-width: 600px; max-height: 500px;"
            @click.stop
          />
        </div>
      </div>

      <!-- ── Body (normal content) ────────────────────────────────────── -->
      <div v-else class="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">

        <!-- LEFT — details, attachments, drive -->
        <ScrollArea>
          <div v-if="custom" class="space-y-5 px-6 py-5">

            <!-- Template fields -->
            <section v-if="Object.keys(selTpl).length" class="space-y-2.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Detalles del custom
              </p>
              <div class="overflow-hidden rounded-lg border divide-y divide-border">
                <div
                  v-for="(val, key) in selTpl"
                  v-show="val"
                  :key="key"
                  class="flex items-stretch"
                >
                  <span
                    class="flex w-36 shrink-0 items-center self-stretch border-r bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground"
                  >
                    {{ FIELD_LABELS[key] || key }}
                  </span>
                  <span class="flex-1 break-words px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
                    {{ val }}
                  </span>
                </div>
              </div>
            </section>

            <!-- Reference images -->
            <section v-if="selAtt.length" class="space-y-2.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Imágenes de referencia
              </p>
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="(att, i) in selAtt"
                  :key="i"
                  class="group relative cursor-pointer"
                  @click="openImage(att.url)"
                >
                  <img
                    :src="att.url"
                    class="h-24 w-24 rounded-lg border object-cover transition-all group-hover:opacity-70 group-hover:scale-105"
                  />
                  <div
                    class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <ZoomIn class="h-6 w-6 text-white drop-shadow-lg" />
                  </div>
                  <p
                    v-if="att.description"
                    class="mt-1.5 w-24 truncate text-center text-xs text-muted-foreground"
                  >
                    {{ att.description }}
                  </p>
                </div>
              </div>
            </section>

            <!-- Drive link -->
            <section v-if="custom.driveLink" class="space-y-2.5">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contenido final
              </p>
              <a
                :href="custom.driveLink"
                target="_blank"
                class="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <ExternalLink class="h-4 w-4 shrink-0 text-muted-foreground" />
                <span class="flex-1 truncate text-sm text-foreground">
                  {{ custom.driveLink }}
                </span>
              </a>
            </section>

          </div>
        </ScrollArea>

        <!-- RIGHT — activity + comment -->
        <div class="flex flex-col overflow-hidden border-l">

          <!-- Activity feed (arriba con scroll) -->
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <!-- header -->
            <div class="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
              <p class="text-sm font-medium text-foreground">Actividad</p>
              <span class="text-xs text-muted-foreground">
                {{ custom?.history?.length ?? 0 }}
              </span>
            </div>

            <!-- empty state -->
            <div
              v-if="!custom?.history?.length"
              class="flex flex-1 items-center justify-center"
            >
              <div class="text-center">
                <Clock class="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p class="text-sm text-muted-foreground">Sin actividad</p>
              </div>
            </div>

            <!-- scrollable list -->
            <div v-else class="flex-1 overflow-y-auto">
              <div class="space-y-3 p-4">
                <div
                  v-for="(entry, idx) in custom.history"
                  :key="entry.id ?? idx"
                  class="flex gap-3 rounded-lg p-3 transition-all"
                  :class="idx === custom.history.length - 1 ? 'bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-blue-500' : 'hover:bg-muted/30'"
                >
                  <!-- Avatar -->
                  <div class="shrink-0">
                    <div
                      v-if="entry.createdByUser?.profilePicture || entry.user?.profilePicture || entry.createdByUser?.avatar || entry.user?.avatar || entry.createdByUser?.picture || entry.user?.picture"
                      class="h-9 w-9 overflow-hidden rounded-full border-2 border-border"
                    >
                      <img
                        :src="entry.createdByUser?.profilePicture || entry.user?.profilePicture || entry.createdByUser?.avatar || entry.user?.avatar || entry.createdByUser?.picture || entry.user?.picture"
                        :alt="entry.createdByUser?.name || entry.user?.name || 'Usuario'"
                        class="h-full w-full object-cover"
                        @error="$event.target.style.display = 'none'"
                      />
                    </div>
                    <div
                      v-else
                      class="flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold"
                      :class="idx === custom.history.length - 1 ? 'bg-blue-500 text-white border-blue-600' : 'bg-muted text-muted-foreground border-border'"
                    >
                      {{ (entry.createdByUser?.name || entry.user?.name || entry.username || 'S').charAt(0).toUpperCase() }}
                    </div>
                  </div>

                  <!-- content -->
                  <div class="min-w-0 flex-1">
                    <!-- Header -->
                    <div class="mb-1 flex items-center gap-2">
                      <span class="text-sm font-semibold text-foreground">
                        {{ entry.createdByUser?.name || entry.user?.name || entry.username || 'Sistema' }}
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {{ HISTORY_ACTION[entry.action]?.label?.toLowerCase() ?? entry.action }}
                      </span>
                    </div>

                    <!-- Timestamp -->
                    <div class="mb-2 text-xs text-muted-foreground">
                      {{ fmt(entry.timestamp || entry.createdAt) }}
                    </div>

                    <!-- Status change -->
                    <div
                      v-if="entry.previousStatus && entry.newStatus"
                      class="mb-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs"
                    >
                      <span>{{ STATUS_LABEL[entry.previousStatus] }}</span>
                      <span>→</span>
                      <span class="font-medium">{{ STATUS_LABEL[entry.newStatus] }}</span>
                    </div>

                    <!-- Comment -->
                    <div
                      v-if="entry.comment"
                      class="mt-2 rounded-lg border px-3 py-2.5 text-sm"
                      :class="idx === custom.history.length - 1 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' : 'bg-muted/30 border-border'"
                    >
                      {{ entry.comment }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Comment box (abajo fijo) -->
          <div v-if="custom.status !== 'COMPLETED'" class="shrink-0 space-y-2 border-t px-3 py-3">
            <p class="text-xs font-medium text-muted-foreground">Agregar comentario</p>
            <Textarea
              v-model="comment"
              placeholder="Escribí un comentario..."
              :rows="2"
              class="resize-none text-sm"
            />
            <Button
              size="sm"
              class="w-full gap-2"
              :disabled="!comment?.trim() || commenting"
              @click="sendComment"
            >
              <Loader2 v-if="commenting" class="h-3.5 w-3.5 animate-spin" />
              <MessageSquare v-else class="h-3.5 w-3.5" />
              {{ commenting ? 'Enviando…' : 'Enviar comentario' }}
            </Button>
          </div>
          
          <!-- Completed message (cuando está completado) -->
          <div v-else class="shrink-0 border-t px-3 py-3">
            <div class="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <CheckCircle2 class="h-4 w-4 text-green-500" />
              <span>Este custom está completado y no acepta más comentarios</span>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Footer (thumbnails when viewer is open) ────────────────── -->
      <div
        v-if="viewerOpen && selAtt.length"
        class="flex shrink-0 border-t bg-muted/40 backdrop-blur-sm"
      >
        <!-- Thumbnails a la izquierda -->
        <div class="flex items-center gap-2 overflow-x-auto border-r px-4 py-3">
          <div
            v-for="(att, i) in selAtt"
            :key="i"
            class="shrink-0 cursor-pointer rounded-lg border-2 transition-colors"
            :class="viewerSrc === att.url ? 'border-primary' : 'border-border'"
            @click.stop="viewerSrc = att.url"
          >
            <img
              :src="att.url"
              class="h-16 w-16 rounded-md object-cover"
              :class="viewerSrc === att.url ? 'opacity-100' : 'opacity-70'"
            />
          </div>
        </div>

        <!-- Descripción a la derecha -->
        <div class="flex min-w-0 flex-1 flex-col justify-center px-6 py-3">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Descripción
          </p>
          <p class="text-sm text-foreground">
            {{ selAtt.find(a => a.url === viewerSrc)?.description || 'No se puso descripción' }}
          </p>
        </div>
      </div>

    </DialogContent>
  </Dialog>
</template>