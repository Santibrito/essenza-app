<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, Upload, X, CheckCircle2, Clock, Users, Flame, AlertTriangle, CheckCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useIgPosts, type IgAccountLite } from '@/lib/useIgPosts'

const props = defineProps<{
  open: boolean
  assignedModels?: { id: number; name: string; alias?: string }[]
  initialDate?: string
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'scheduled'): void }>()

const { getAccounts, schedule } = useIgPosts()

const today = new Date()
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const form = ref({
  modelId: null as number | null,
  contentType: 'REEL',
  caption: '',
  hashtags: '',
  link: '',
  date: fmtDate(today),
  time: '12:00',
  spreadMinutes: 30,
})
const accounts = ref<IgAccountLite[]>([])
const selected = ref<Set<number>>(new Set())
const loadingAccounts = ref(false)
const file = ref<File | null>(null)
const filePreview = ref<string | null>(null)
const saving = ref(false)

// Solo las cuentas LISTAS se pueden usar para publicar.
const readyAccounts = computed(() => accounts.value.filter(a => a.status === 'READY'))
const warmingCount = computed(() => accounts.value.filter(a => ['IMPORTED', 'LOGGED_IN', 'PHOTO_DONE', 'BIO_DONE', 'WARMING'].includes(a.status)).length)
const deadCount = computed(() => accounts.value.filter(a => ['SUSPENDED', 'CHALLENGED', 'BANNED', 'PHONE_REQUIRED'].includes(a.status)).length)

watch(() => props.open, (o) => {
  if (o) {
    const first = props.assignedModels?.[0]
    form.value = {
      modelId: first?.id ?? null, contentType: 'REEL', caption: '', hashtags: '', link: '',
      date: props.initialDate || fmtDate(today), time: '12:00', spreadMinutes: 30,
    }
    file.value = null; filePreview.value = null; selected.value = new Set()
    if (first?.id) loadAccounts(first.id)
  }
})

watch(() => form.value.modelId, (id) => { if (id) loadAccounts(id); else accounts.value = [] })

async function loadAccounts(modelId: number) {
  loadingAccounts.value = true
  selected.value = new Set()
  try {
    accounts.value = await getAccounts(modelId)
    // Preseleccionar TODAS las listas (son las únicas que se pueden usar)
    selected.value = new Set(readyAccounts.value.map(a => a.id))
  } catch (e: any) {
    toast.error('Error al cargar cuentas', { description: e.message })
  } finally {
    loadingAccounts.value = false
  }
}

function toggle(id: number) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}
function selectAll() { selected.value = new Set(readyAccounts.value.map(a => a.id)) }
function selectNone() { selected.value = new Set() }

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) { file.value = f; filePreview.value = f.type.startsWith('image/') ? URL.createObjectURL(f) : null }
}

// Ventana estimada "se subirá entre X y Y"
const windowText = computed(() => {
  const [h, m] = form.value.time.split(':').map(Number)
  const start = h * 60 + m
  const end = start + form.value.spreadMinutes
  const fmt = (mins: number) => `${String(Math.floor((mins % 1440) / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  return form.value.spreadMinutes > 0 ? `entre ${fmt(start)} y ${fmt(end)}` : `a las ${fmt(start)}`
})

async function submit() {
  if (!file.value) { toast.error('Subí una imagen o video'); return }
  if (selected.value.size === 0) { toast.error('Elegí al menos una cuenta LISTA'); return }
  saving.value = true
  try {
    const res = await schedule({
      modelId: form.value.modelId,
      accountIds: Array.from(selected.value),
      contentType: form.value.contentType,
      caption: form.value.caption || undefined,
      hashtags: form.value.hashtags || undefined,
      link: form.value.link || undefined,
      scheduledAt: `${form.value.date}T${form.value.time}:00`,
      spreadMinutes: form.value.spreadMinutes,
    }, file.value)
    toast.success(`Programado en ${res.count} cuenta${res.count !== 1 ? 's' : ''} 🎉`, {
      description: `Se subirá entre las ${res.from} y las ${res.to}` + (res.skipped ? ` · ${res.skipped} salteada(s) por no estar lista(s)` : ''),
      duration: 8000,
    })
    emit('scheduled')
    emit('update:open', false)
  } catch (e: any) {
    toast.error('Error al programar', { description: e.message })
  } finally {
    saving.value = false
  }
}

const CONTENT_LABEL: Record<string, string> = { REEL: 'Reel', STORY: 'Historia', POST: 'Post (foto)' }
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-lg font-black flex items-center gap-2"><Users class="w-4 h-4 text-violet-500" /> Programar publicación</DialogTitle>
        <DialogDescription>Un contenido → una o varias cuentas <b>LISTAS</b> de la modelo, con horarios desparejos para no parecer bot.</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
        <!-- Modelo + tipo -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Modelo</Label>
            <select v-model="form.modelId" class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring">
              <option v-for="m in assignedModels" :key="m.id" :value="m.id">{{ m.alias || m.name }}</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Tipo</Label>
            <select v-model="form.contentType" class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="REEL">Reel</option>
              <option value="STORY">Historia</option>
              <option value="POST">Post (foto)</option>
            </select>
          </div>
        </div>

        <!-- Cuentas (solo LISTAS) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Cuentas listas ({{ selected.size }}/{{ readyAccounts.length }})</Label>
            <div v-if="readyAccounts.length" class="flex gap-2 text-[10px] font-bold">
              <button type="button" @click="selectAll" class="text-primary hover:underline">Todas</button>
              <button type="button" @click="selectNone" class="text-zinc-400 hover:underline">Ninguna</button>
            </div>
          </div>

          <div v-if="loadingAccounts" class="flex justify-center py-4"><Loader2 class="w-4 h-4 animate-spin text-primary" /></div>

          <div v-else-if="readyAccounts.length === 0" class="rounded-xl border border-dashed border-amber-400/40 bg-amber-500/5 p-4 text-center space-y-1">
            <Flame class="w-6 h-6 mx-auto text-amber-500/70" />
            <p class="text-xs font-bold text-zinc-700 dark:text-zinc-300">No hay cuentas LISTAS para esta modelo</p>
            <p class="text-[11px] text-zinc-500 leading-snug">
              <template v-if="warmingCount">Hay {{ warmingCount }} todavía calentando. </template>Enganchá o terminá de calentar una cuenta en el CRM (pestaña “Cuentas IG”).
            </p>
          </div>

          <template v-else>
            <div class="max-h-44 overflow-y-auto space-y-1 border border-border/50 rounded-lg p-1.5">
              <label v-for="a in readyAccounts" :key="a.id"
                class="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                :class="selected.has(a.id) ? 'bg-emerald-500/5 ring-1 ring-emerald-500/20' : ''">
                <input type="checkbox" :checked="selected.has(a.id)" @change="toggle(a.id)" class="h-4 w-4 accent-emerald-500" />
                <div class="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  <img v-if="a.profilePhotoUrl" :src="a.profilePhotoUrl" class="w-full h-full object-cover" />
                  <Users v-else class="w-3 h-3 text-muted-foreground/40" />
                </div>
                <div class="min-w-0 flex-1">
                  <span class="text-xs font-bold truncate block">@{{ a.igUsername }}</span>
                  <span v-if="a.followers != null" class="text-[10px] text-zinc-400 tabular-nums">{{ a.followers }} seguidores</span>
                </div>
                <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                  <CheckCheck class="w-2.5 h-2.5" /> Lista
                </span>
              </label>
            </div>
            <p v-if="warmingCount || deadCount" class="flex items-center gap-1.5 text-[10px] text-zinc-400 px-0.5">
              <AlertTriangle class="w-3 h-3 shrink-0" />
              <span>
                <template v-if="warmingCount">{{ warmingCount }} calentando</template>
                <template v-if="warmingCount && deadCount"> · </template>
                <template v-if="deadCount">{{ deadCount }} con problema</template>
                — no disponibles para publicar.
              </span>
            </p>
          </template>
        </div>

        <!-- Archivo -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Archivo</Label>
          <div class="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors"
            @click="($refs.f as HTMLInputElement)?.click()">
            <input ref="f" type="file" accept="image/*,video/mp4,video/quicktime" class="hidden" @change="onFile" />
            <div v-if="file" class="flex items-center gap-3">
              <img v-if="filePreview" :src="filePreview" class="w-12 h-12 rounded-lg object-cover" />
              <div v-else class="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Upload class="w-5 h-5 text-zinc-400" /></div>
              <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">{{ file.name }}</p><p class="text-xs text-zinc-400">{{ (file.size/1024/1024).toFixed(1) }} MB</p></div>
              <button @click.stop="file = null; filePreview = null" class="text-zinc-400 hover:text-red-500"><X class="w-4 h-4" /></button>
            </div>
            <div v-else class="flex flex-col items-center gap-1 py-2 text-center">
              <Upload class="w-7 h-7 text-zinc-300" /><p class="text-xs font-bold text-zinc-500">Subí la imagen o el video</p>
            </div>
          </div>
        </div>

        <!-- Caption / hashtags / link -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Descripción</Label>
          <Textarea v-model="form.caption" placeholder="Texto del posteo..." class="resize-none text-sm" rows="2" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Hashtags</Label>
            <Input v-model="form.hashtags" placeholder="#x #y" class="h-10 text-sm" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Link (historia)</Label>
            <Input v-model="form.link" placeholder="https://onlyfans.com/..." class="h-10 text-sm" />
          </div>
        </div>

        <!-- Fecha / hora / spread -->
        <div class="grid grid-cols-3 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Fecha</Label>
            <Input type="date" v-model="form.date" class="h-10" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Hora base</Label>
            <Input type="time" v-model="form.time" class="h-10" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Repartir (min)</Label>
            <Input type="number" v-model.number="form.spreadMinutes" min="0" max="180" class="h-10" />
          </div>
        </div>

        <!-- Ventana -->
        <div class="flex items-center gap-2 rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 text-sm">
          <Clock class="w-4 h-4 text-violet-500 shrink-0" />
          <span class="text-zinc-700 dark:text-zinc-300">
            {{ CONTENT_LABEL[form.contentType] }} · se subirá <b>{{ windowText }}</b> en <b>{{ selected.size }}</b> cuenta{{ selected.size !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)" :disabled="saving">Cancelar</Button>
        <Button @click="submit" :disabled="saving || selected.size === 0" class="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 hover:from-violet-700 hover:to-fuchsia-700">
          <Loader2 v-if="saving" class="w-4 h-4 animate-spin" /><CheckCircle2 v-else class="w-4 h-4" />
          {{ saving ? 'Programando...' : 'Programar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
