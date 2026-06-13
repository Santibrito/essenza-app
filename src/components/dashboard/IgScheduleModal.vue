<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, Upload, X, CheckCircle2, Clock, Users, Flame, AlertTriangle, CheckCheck, Plus, Trash2, Repeat, CalendarDays, Link2, AtSign, Hash, Star, PlayCircle, BarChart3, RotateCw, Minus, MessageCircleQuestion, Music, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useIgPosts, type IgAccountLite } from '@/lib/useIgPosts'
import { useTimezone } from '@/lib/useTimezone'

const props = defineProps<{
  open: boolean
  assignedModels?: { id: number; name: string; alias?: string }[]
  initialDate?: string
  initialTime?: string
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'scheduled'): void }>()

const { getAccounts, schedule, searchMusic } = useIgPosts()
const { zonedToUtcISO, formatTime: tzFormatTime, tzAbbrev } = useTimezone()

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
  times: ['12:00'] as string[],   // uno o varios horarios (plantilla)
  repeatDays: 1,                   // 1 = solo ese día; 7/14/30 = días consecutivos
  spreadMinutes: 30,
})

function addTime() { form.value.times.push('18:00') }
function removeTime(i: number) { if (form.value.times.length > 1) form.value.times.splice(i, 1) }
function addDays(dateStr: string, n: number) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, mo - 1, d); dt.setDate(dt.getDate() + n)
  return fmtDate(dt)
}
const REPEAT_OPTS = [
  { v: 1, label: 'Solo ese día' },
  { v: 7, label: '7 días' },
  { v: 14, label: '14 días' },
  { v: 30, label: '30 días' },
]
const accounts = ref<IgAccountLite[]>([])
const selected = ref<Set<number>>(new Set())
const loadingAccounts = ref(false)
const file = ref<File | null>(null)
const filePreview = ref<string | null>(null)
const saving = ref(false)

// ── Editor de historia (tipo Instagram) ───────────────────────────────────────
const mediaObjUrl = ref<string | null>(null)
const mediaIsVideo = computed(() => !!file.value && file.value.type.startsWith('video'))
const isStory = computed(() => form.value.contentType === 'STORY')
type Kind = 'link' | 'mention' | 'hashtag' | 'poll' | 'question'
function freshStory() {
  return {
    link: { enabled: true, url: '', text: 'HABLAME POR AQUÍ', x: 0.5, y: 0.82, scale: 1, rotation: 0 },
    mentions: [] as { username: string; x: number; y: number; scale: number; rotation: number }[],
    hashtags: [] as { tag: string; x: number; y: number; scale: number; rotation: number }[],
    poll: { enabled: false, question: '¿Cuál preferís?', options: ['Opción A', 'Opción B'], x: 0.5, y: 0.45, scale: 1, rotation: 0 },
    question: { enabled: false, text: 'Hazme una pregunta', x: 0.5, y: 0.6, scale: 1, rotation: 0 },
    music: null as any,
    highlight: { add: false, title: '' },
  }
}
const story = ref(freshStory())
const selSticker = ref<null | { kind: Kind; i: number }>(null)
function resetStory() { story.value = freshStory(); selSticker.value = null; musicResults.value = []; musicQuery.value = '' }
function toggleQuestion() { story.value.question.enabled = !story.value.question.enabled; if (story.value.question.enabled) selSticker.value = { kind: 'question', i: 0 } }

// Música
const musicQuery = ref('')
const musicResults = ref<any[]>([])
const musicSearching = ref(false)
async function doMusicSearch() {
  if (!form.value.modelId || !musicQuery.value.trim()) return
  musicSearching.value = true
  try {
    musicResults.value = await searchMusic(form.value.modelId, musicQuery.value.trim())
    if (!musicResults.value.length) toast.info('Sin resultados')
  } catch (e: any) {
    toast.error('No se pudo buscar música', { description: e.message })
  } finally { musicSearching.value = false }
}
function pickTrack(t: any) { story.value.music = t; musicResults.value = [] }
function clearTrack() { story.value.music = null }
function addMention() { story.value.mentions.push({ username: '', x: 0.5, y: 0.5, scale: 1, rotation: 0 }); selSticker.value = { kind: 'mention', i: story.value.mentions.length - 1 } }
function addHashtag() { story.value.hashtags.push({ tag: '', x: 0.5, y: 0.4, scale: 1, rotation: 0 }); selSticker.value = { kind: 'hashtag', i: story.value.hashtags.length - 1 } }
function togglePoll() { story.value.poll.enabled = !story.value.poll.enabled; if (story.value.poll.enabled) selSticker.value = { kind: 'poll', i: 0 } }

// Objeto del sticker seleccionado (para escala/rotación)
function curSticker(): any {
  const s = selSticker.value
  if (!s) return null
  if (s.kind === 'link') return story.value.link
  if (s.kind === 'poll') return story.value.poll
  if (s.kind === 'question') return story.value.question
  if (s.kind === 'mention') return story.value.mentions[s.i]
  return story.value.hashtags[s.i]
}
function bumpScale(d: number) { const c = curSticker(); if (c) c.scale = Math.min(2.5, Math.max(0.5, +(c.scale + d).toFixed(2))) }
function bumpRotate(d: number) { const c = curSticker(); if (c) c.rotation = (c.rotation + d) % 360 }
function deleteSelected() {
  const s = selSticker.value; if (!s) return
  if (s.kind === 'link') story.value.link.enabled = false
  else if (s.kind === 'poll') story.value.poll.enabled = false
  else if (s.kind === 'question') story.value.question.enabled = false
  else if (s.kind === 'mention') story.value.mentions.splice(s.i, 1)
  else story.value.hashtags.splice(s.i, 1)
  selSticker.value = null
}
function stTransform(c: any) { return `translate(-50%,-50%) rotate(${c.rotation || 0}deg) scale(${c.scale || 1})` }

// Drag de stickers sobre el lienzo 9:16
const canvasRef = ref<HTMLElement | null>(null)
const drag = ref<null | { kind: Kind; i: number }>(null)
function startDrag(kind: Kind, i: number, e: PointerEvent) {
  drag.value = { kind, i }
  selSticker.value = { kind, i }
  e.preventDefault()
}
function onPointerMove(e: PointerEvent) {
  if (!drag.value || !canvasRef.value) return
  const r = canvasRef.value.getBoundingClientRect()
  const x = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width))
  const y = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height))
  const d = drag.value
  if (d.kind === 'link') { story.value.link.x = x; story.value.link.y = y }
  else if (d.kind === 'poll') { story.value.poll.x = x; story.value.poll.y = y }
  else if (d.kind === 'question') { story.value.question.x = x; story.value.question.y = y }
  else if (d.kind === 'mention') { story.value.mentions[d.i].x = x; story.value.mentions[d.i].y = y }
  else { story.value.hashtags[d.i].x = x; story.value.hashtags[d.i].y = y }
}
function onPointerUp() { drag.value = null }
onMounted(() => { window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp) })
onBeforeUnmount(() => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp) })

function buildStoryConfig() {
  if (!isStory.value) return undefined
  const cfg: any = {}
  const L = story.value.link
  if (L.enabled && L.url.trim()) {
    cfg.link = { url: L.url.trim(), text: L.text.trim() || 'SABER MÁS', x: L.x, y: L.y, scale: L.scale, rotation: L.rotation }
  }
  const mentions = story.value.mentions.filter(m => m.username.trim()).map(m => ({ username: m.username.trim(), x: m.x, y: m.y, scale: m.scale, rotation: m.rotation }))
  const hashtags = story.value.hashtags.filter(h => h.tag.trim()).map(h => ({ tag: h.tag.trim(), x: h.x, y: h.y, scale: h.scale, rotation: h.rotation }))
  if (mentions.length) cfg.mentions = mentions
  if (hashtags.length) cfg.hashtags = hashtags
  const P = story.value.poll
  const opts = P.options.map(o => o.trim()).filter(Boolean)
  if (P.enabled && P.question.trim() && opts.length >= 2) {
    cfg.poll = { question: P.question.trim(), options: opts, x: P.x, y: P.y, scale: P.scale, rotation: P.rotation }
  }
  const Q = story.value.question
  if (Q.enabled && Q.text.trim()) {
    cfg.question = { text: Q.text.trim(), x: Q.x, y: Q.y, scale: Q.scale, rotation: Q.rotation }
  }
  if (story.value.music) cfg.music = story.value.music
  if (story.value.highlight.add) cfg.highlight = { add: true, title: story.value.highlight.title.trim() || 'Destacadas' }
  return Object.keys(cfg).length ? cfg : undefined
}
function isSel(kind: Kind, i = 0) { return selSticker.value?.kind === kind && selSticker.value?.i === i }

// Solo las cuentas LISTAS se pueden usar para publicar.
const readyAccounts = computed(() => accounts.value.filter(a => a.status === 'READY'))
const warmingCount = computed(() => accounts.value.filter(a => ['IMPORTED', 'LOGGED_IN', 'PHOTO_DONE', 'BIO_DONE', 'WARMING'].includes(a.status)).length)
const deadCount = computed(() => accounts.value.filter(a => ['SUSPENDED', 'CHALLENGED', 'BANNED', 'PHONE_REQUIRED'].includes(a.status)).length)

watch(() => props.open, (o) => {
  if (o) {
    const first = props.assignedModels?.[0]
    form.value = {
      modelId: first?.id ?? null, contentType: 'REEL', caption: '', hashtags: '', link: '',
      date: props.initialDate || fmtDate(today), times: [props.initialTime || '12:00'], repeatDays: 1, spreadMinutes: 30,
    }
    file.value = null; filePreview.value = null; selected.value = new Set()
    if (mediaObjUrl.value) { URL.revokeObjectURL(mediaObjUrl.value); mediaObjUrl.value = null }
    resetStory()
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
  if (f) {
    file.value = f
    filePreview.value = f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    if (mediaObjUrl.value) URL.revokeObjectURL(mediaObjUrl.value)
    mediaObjUrl.value = URL.createObjectURL(f)
  }
}

// Resumen del plan: total de publicaciones = cuentas × horarios × días
const plan = computed(() => {
  const times = form.value.times.filter(Boolean)
  const runs = times.length * form.value.repeatDays
  return {
    times,
    runs,
    total: runs * selected.value.size,
    isTemplate: form.value.times.length > 1 || form.value.repeatDays > 1,
  }
})

async function submit() {
  if (!file.value) { toast.error('Subí una imagen o video'); return }
  if (selected.value.size === 0) { toast.error('Elegí al menos una cuenta LISTA'); return }
  const times = form.value.times.filter(Boolean)
  if (!times.length) { toast.error('Agregá al menos un horario'); return }
  saving.value = true
  const storyConfig = buildStoryConfig()
  try {
    let total = 0, skipped = 0
    // Una llamada por (día × horario); cada una propaga el contenido a las cuentas elegidas.
    for (let d = 0; d < form.value.repeatDays; d++) {
      const dateStr = addDays(form.value.date, d)
      for (const t of times) {
        const res = await schedule({
          modelId: form.value.modelId,
          accountIds: Array.from(selected.value),
          contentType: form.value.contentType,
          caption: form.value.caption || undefined,
          hashtags: form.value.hashtags || undefined,
          link: form.value.link || undefined,
          scheduledAt: zonedToUtcISO(dateStr, t),
          spreadMinutes: form.value.spreadMinutes,
          storyConfig,
        }, file.value)
        total += res.count; skipped += res.skipped || 0
      }
    }
    toast.success(`Programadas ${total} publicación${total !== 1 ? 'es' : ''} 🎉`, {
      description: (plan.value.isTemplate ? `${plan.value.runs} horarios × ${selected.value.size} cuenta(s). ` : `${tzAbbrev()}. `) + (skipped ? `${skipped} salteada(s) por no estar lista(s).` : ''),
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
    <DialogContent :class="isStory ? 'sm:max-w-3xl' : 'sm:max-w-lg'">
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

        <!-- ══ EDITOR DE HISTORIA (tipo Instagram) ══════════════════════════ -->
        <div v-if="isStory && file && mediaObjUrl" class="space-y-3">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5"><Star class="w-3.5 h-3.5 text-violet-500" /> Editor de historia</Label>
            <span class="text-[10px] text-zinc-400">Arrastrá los stickers · así se va a ver</span>
          </div>

          <div class="flex gap-5">
            <!-- Lienzo 9:16 -->
            <div ref="canvasRef"
              class="relative w-[252px] shrink-0 rounded-[1.8rem] overflow-hidden bg-black ring-[6px] ring-zinc-900 shadow-2xl select-none"
              style="aspect-ratio: 9/16; touch-action: none;">
              <img v-if="!mediaIsVideo" :src="mediaObjUrl" class="absolute inset-0 w-full h-full object-cover" draggable="false" />
              <video v-else :src="mediaObjUrl" class="absolute inset-0 w-full h-full object-cover" muted loop autoplay playsinline></video>
              <!-- barra superior simulada -->
              <div class="absolute top-2 left-2 right-2 h-0.5 bg-white/40 rounded-full"></div>

              <!-- botón de link arrastrable -->
              <div v-if="story.link.enabled && story.link.url"
                @pointerdown="startDrag('link', 0, $event)"
                :class="['absolute z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white shadow-lg cursor-grab active:cursor-grabbing whitespace-nowrap', isSel('link') ? 'outline outline-2 outline-violet-400' : '']"
                :style="{ left: story.link.x * 100 + '%', top: story.link.y * 100 + '%', transform: stTransform(story.link) }">
                <Link2 class="w-3 h-3 text-[#0095f6]" />
                <span class="text-[10px] font-black text-[#0095f6] uppercase">{{ story.link.text || 'SABER MÁS' }}</span>
              </div>

              <!-- encuesta -->
              <div v-if="story.poll.enabled" @pointerdown="startDrag('poll', 0, $event)"
                :class="['absolute z-20 w-[60%] rounded-2xl bg-white/95 shadow-lg cursor-grab active:cursor-grabbing overflow-hidden', isSel('poll') ? 'outline outline-2 outline-violet-400' : '']"
                :style="{ left: story.poll.x * 100 + '%', top: story.poll.y * 100 + '%', transform: stTransform(story.poll) }">
                <p class="text-center text-[10px] font-black text-zinc-800 px-2 pt-1.5 pb-1 truncate">{{ story.poll.question || 'Pregunta' }}</p>
                <div class="flex border-t border-zinc-200">
                  <div class="flex-1 text-center text-[9px] font-black text-violet-600 py-1 border-r border-zinc-200 truncate px-1">{{ story.poll.options[0] || 'A' }}</div>
                  <div class="flex-1 text-center text-[9px] font-black text-violet-600 py-1 truncate px-1">{{ story.poll.options[1] || 'B' }}</div>
                </div>
              </div>

              <!-- pregunta (decorativa) -->
              <div v-if="story.question.enabled" @pointerdown="startDrag('question', 0, $event)"
                :class="['absolute z-20 w-[58%] rounded-2xl bg-white/95 shadow-lg cursor-grab active:cursor-grabbing overflow-hidden px-2.5 py-2', isSel('question') ? 'outline outline-2 outline-violet-400' : '']"
                :style="{ left: story.question.x * 100 + '%', top: story.question.y * 100 + '%', transform: stTransform(story.question) }">
                <p class="text-center text-[10px] font-black text-zinc-800 truncate">{{ story.question.text || 'Hazme una pregunta' }}</p>
                <div class="mt-1 rounded-full bg-zinc-100 text-zinc-400 text-[9px] py-1 px-2">Responder…</div>
              </div>

              <!-- indicador de música -->
              <div v-if="story.music" class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur text-white text-[9px] font-bold max-w-[80%]">
                <Music class="w-2.5 h-2.5 shrink-0" /><span class="truncate">{{ story.music.title }} · {{ story.music.artist }}</span>
              </div>

              <!-- menciones -->
              <div v-for="(m, i) in story.mentions" :key="'m' + i" @pointerdown="startDrag('mention', i, $event)"
                :class="['absolute z-20 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur text-white text-[10px] font-black cursor-grab active:cursor-grabbing', isSel('mention', i) ? 'outline outline-2 outline-violet-400' : '']"
                :style="{ left: m.x * 100 + '%', top: m.y * 100 + '%', transform: stTransform(m) }">@{{ m.username || 'usuario' }}</div>

              <!-- hashtags -->
              <div v-for="(h, i) in story.hashtags" :key="'h' + i" @pointerdown="startDrag('hashtag', i, $event)"
                :class="['absolute z-20 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur text-white text-[10px] font-black cursor-grab active:cursor-grabbing', isSel('hashtag', i) ? 'outline outline-2 outline-violet-400' : '']"
                :style="{ left: h.x * 100 + '%', top: h.y * 100 + '%', transform: stTransform(h) }">#{{ h.tag || 'hashtag' }}</div>

              <!-- controles del sticker seleccionado -->
              <div v-if="selSticker" class="absolute bottom-1.5 left-1.5 right-1.5 z-30 flex items-center justify-center gap-1 rounded-xl bg-black/70 backdrop-blur px-1.5 py-1">
                <button type="button" @pointerdown.stop @click="bumpScale(-0.1)" class="w-6 h-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><Minus class="w-3 h-3" /></button>
                <button type="button" @pointerdown.stop @click="bumpScale(0.1)" class="w-6 h-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><Plus class="w-3 h-3" /></button>
                <button type="button" @pointerdown.stop @click="bumpRotate(-15)" class="w-6 h-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><RotateCw class="w-3 h-3 -scale-x-100" /></button>
                <button type="button" @pointerdown.stop @click="bumpRotate(15)" class="w-6 h-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><RotateCw class="w-3 h-3" /></button>
                <button type="button" @pointerdown.stop @click="deleteSelected" class="w-6 h-6 rounded-md bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500"><Trash2 class="w-3 h-3" /></button>
              </div>
            </div>

            <!-- Controles -->
            <div class="flex-1 min-w-0 space-y-3">
              <!-- bandeja de stickers -->
              <div class="flex flex-wrap gap-1.5">
                <button type="button" @click="story.link.enabled = !story.link.enabled"
                  :class="['flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-all', story.link.enabled ? 'border-[#0095f6] bg-[#0095f6]/10 text-[#0095f6]' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500']">
                  <Link2 class="w-3 h-3" /> Link
                </button>
                <button type="button" @click="addMention" class="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><AtSign class="w-3 h-3" /> Mención</button>
                <button type="button" @click="addHashtag" class="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Hash class="w-3 h-3" /> Hashtag</button>
                <button type="button" @click="togglePoll"
                  :class="['flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-all', story.poll.enabled ? 'border-violet-500 bg-violet-500/10 text-violet-600' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800']"><BarChart3 class="w-3 h-3" /> Encuesta</button>
                <button type="button" @click="toggleQuestion"
                  :class="['flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-all', story.question.enabled ? 'border-violet-500 bg-violet-500/10 text-violet-600' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800']"><MessageCircleQuestion class="w-3 h-3" /> Pregunta</button>
              </div>

              <!-- pregunta -->
              <div v-if="story.question.enabled" class="space-y-1.5 rounded-xl border border-border/50 p-2.5 bg-muted/20">
                <Input v-model="story.question.text" placeholder="Texto de la pregunta" class="h-8 text-xs" />
                <p class="text-[10px] text-zinc-400">Decorativa (no interactiva). Para recibir respuestas usá la encuesta.</p>
              </div>

              <!-- música -->
              <div class="space-y-1.5 rounded-xl border border-border/50 p-2.5 bg-muted/20">
                <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5"><Music class="w-3 h-3" /> Música</Label>
                <div v-if="story.music" class="flex items-center gap-2 rounded-lg bg-violet-500/10 p-1.5">
                  <img v-if="story.music.cover" :src="story.music.cover" class="w-8 h-8 rounded object-cover shrink-0" />
                  <Music v-else class="w-4 h-4 text-violet-500 shrink-0" />
                  <div class="min-w-0 flex-1"><p class="text-xs font-bold truncate">{{ story.music.title }}</p><p class="text-[10px] text-zinc-400 truncate">{{ story.music.artist }}</p></div>
                  <button type="button" @click="clearTrack" class="text-zinc-400 hover:text-red-500"><X class="w-3.5 h-3.5" /></button>
                </div>
                <template v-else>
                  <div class="flex items-center gap-1.5">
                    <Input v-model="musicQuery" placeholder="Buscar canción…" class="h-8 text-xs" @keyup.enter="doMusicSearch" />
                    <button type="button" @click="doMusicSearch" :disabled="musicSearching || !form.modelId" class="h-8 px-2.5 rounded-lg bg-violet-600 text-white flex items-center justify-center disabled:opacity-50">
                      <Loader2 v-if="musicSearching" class="w-3.5 h-3.5 animate-spin" /><Search v-else class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div v-if="musicResults.length" class="max-h-32 overflow-y-auto space-y-1">
                    <button v-for="(t, i) in musicResults" :key="i" type="button" @click="pickTrack(t)"
                      class="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted text-left">
                      <img v-if="t.cover" :src="t.cover" class="w-8 h-8 rounded object-cover shrink-0" />
                      <Music v-else class="w-4 h-4 text-zinc-400 shrink-0" />
                      <div class="min-w-0 flex-1"><p class="text-xs font-bold truncate">{{ t.title }}</p><p class="text-[10px] text-zinc-400 truncate">{{ t.artist }}</p></div>
                    </button>
                  </div>
                </template>
              </div>

              <!-- encuesta -->
              <div v-if="story.poll.enabled" class="space-y-1.5 rounded-xl border border-border/50 p-2.5 bg-muted/20">
                <Input v-model="story.poll.question" placeholder="Pregunta de la encuesta" class="h-8 text-xs" />
                <div class="grid grid-cols-2 gap-1.5">
                  <Input v-model="story.poll.options[0]" placeholder="Opción A" class="h-8 text-xs" />
                  <Input v-model="story.poll.options[1]" placeholder="Opción B" class="h-8 text-xs" />
                </div>
              </div>

              <!-- link -->
              <div v-if="story.link.enabled" class="space-y-1.5 rounded-xl border border-border/50 p-2.5 bg-muted/20">
                <Input v-model="story.link.text" placeholder="Texto del botón (ej. HABLAME POR AQUÍ)" class="h-8 text-xs" />
                <Input v-model="story.link.url" placeholder="https://onlyfans.com/..." class="h-8 text-xs" />
              </div>

              <!-- menciones -->
              <div v-for="(m, i) in story.mentions" :key="'mi' + i" class="flex items-center gap-1.5">
                <AtSign class="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <Input v-model="m.username" placeholder="usuario" class="h-8 text-xs" />
                <button type="button" @click="story.mentions.splice(i, 1)" class="text-zinc-400 hover:text-red-500"><X class="w-3.5 h-3.5" /></button>
              </div>
              <!-- hashtags -->
              <div v-for="(h, i) in story.hashtags" :key="'hi' + i" class="flex items-center gap-1.5">
                <Hash class="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <Input v-model="h.tag" placeholder="hashtag" class="h-8 text-xs" />
                <button type="button" @click="story.hashtags.splice(i, 1)" class="text-zinc-400 hover:text-red-500"><X class="w-3.5 h-3.5" /></button>
              </div>

              <!-- destacadas -->
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="story.highlight.add" class="h-4 w-4 accent-violet-500" />
                <span class="text-xs font-bold flex items-center gap-1"><Star class="w-3.5 h-3.5 text-amber-500" /> Agregar a destacadas</span>
              </label>
              <Input v-if="story.highlight.add" v-model="story.highlight.title" placeholder="Nombre de la destacada (ej. Links)" class="h-8 text-xs" />
            </div>
          </div>
        </div>

        <!-- Caption / hashtags / link -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Descripción</Label>
          <Textarea v-model="form.caption" placeholder="Texto del posteo..." class="resize-none text-sm" rows="2" />
        </div>
        <div :class="isStory ? '' : 'grid grid-cols-2 gap-3'">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Hashtags</Label>
            <Input v-model="form.hashtags" placeholder="#x #y" class="h-10 text-sm" />
          </div>
          <div v-if="!isStory" class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Link (historia)</Label>
            <Input v-model="form.link" placeholder="https://onlyfans.com/..." class="h-10 text-sm" />
          </div>
        </div>

        <!-- Fecha base + repartir -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Fecha de inicio</Label>
            <Input type="date" v-model="form.date" class="h-10" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500">Repartir entre cuentas (min)</Label>
            <Input type="number" v-model.number="form.spreadMinutes" min="0" max="180" class="h-10" />
          </div>
        </div>

        <!-- Horarios (plantilla) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5"><Clock class="w-3.5 h-3.5" /> Horarios ({{ tzAbbrev() }})</Label>
            <button type="button" @click="addTime" class="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:underline"><Plus class="w-3 h-3" /> Agregar horario</button>
          </div>
          <div class="flex flex-wrap gap-2">
            <div v-for="(t, i) in form.times" :key="i" class="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 pl-2 pr-1 py-1">
              <Input type="time" v-model="form.times[i]" class="h-7 w-24 border-0 bg-transparent px-1 text-sm focus-visible:ring-0" />
              <button v-if="form.times.length > 1" type="button" @click="removeTime(i)" class="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 class="w-3 h-3" /></button>
            </div>
          </div>
        </div>

        <!-- Repetir -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5"><Repeat class="w-3.5 h-3.5" /> Repetir</Label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="o in REPEAT_OPTS" :key="o.v" type="button" @click="form.repeatDays = o.v"
              :class="['h-8 px-3 rounded-xl border text-xs font-bold transition-all',
                       form.repeatDays === o.v ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800']">
              {{ o.label }}
            </button>
          </div>
        </div>

        <!-- Resumen del plan -->
        <div class="flex items-start gap-2 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 p-3 text-sm">
          <CalendarDays class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
          <span class="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <b class="text-violet-600 dark:text-violet-400">{{ plan.total }}</b> publicación{{ plan.total !== 1 ? 'es' : '' }}
            ({{ CONTENT_LABEL[form.contentType] }}) ·
            <b>{{ selected.size }}</b> cuenta{{ selected.size !== 1 ? 's' : '' }} ×
            <b>{{ plan.times.length }}</b> horario{{ plan.times.length !== 1 ? 's' : '' }}<template v-if="form.repeatDays > 1"> × <b>{{ form.repeatDays }}</b> días</template>.
            <template v-if="form.spreadMinutes > 0"> Se reparten hasta {{ form.spreadMinutes }}' para no parecer bot.</template>
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
