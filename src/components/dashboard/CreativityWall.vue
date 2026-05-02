<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Lightbulb, Plus, X, Heart, ChevronRight, Info, Send } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'vue-sonner'
import api from '@/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  author: string
  text: string
  createdAt?: string
}

interface Idea {
  id: number
  title: string
  content: string
  creator?: { name: string }
  cat: 'REELS' | 'OUTREACH' | 'CHAT' | 'TRENDS'
  category?: string
  status: 'PENDING' | 'APPROVED' | 'IMPLEMENTED'
  likes: number
  likedByMe: boolean
  comments: Comment[]
  x: number
  y: number
  z: number
}

// ─── State ────────────────────────────────────────────────────────────────────

const ideas = ref<Idea[]>([])
const loading = ref(true)
const filter = ref<'ALL' | 'REELS' | 'OUTREACH' | 'CHAT' | 'TRENDS'>('ALL')
const showNewModal = ref(false)
const detailIdea = ref<Idea | null>(null)
const boardRef = ref<HTMLElement | null>(null)
let zTop = 100

const newIdea = ref({ title: '', content: '', cat: 'REELS', creator: '' })
const newComment = ref({ author: '', text: '' })

// ─── Constants ────────────────────────────────────────────────────────────────

const CATS = { REELS: 'Reels', OUTREACH: 'Outreach', CHAT: 'Chat', TRENDS: 'Tendencias' }

const STATUS_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobada', IMPLEMENTED: 'Implementada' }

const CAT_STYLES: Record<string, { note: string; badge: string; text: string }> = {
  REELS: { 
    note: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/50', 
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300', 
    text: 'text-blue-900 dark:text-blue-100' 
  },
  OUTREACH: { 
    note: 'bg-green-50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/50', 
    badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300', 
    text: 'text-green-900 dark:text-green-100' 
  },
  CHAT: { 
    note: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/50', 
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300', 
    text: 'text-amber-900 dark:text-amber-100' 
  },
  TRENDS: { 
    note: 'bg-pink-50 dark:bg-pink-950/30 border-pink-200/50 dark:border-pink-800/50', 
    badge: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300', 
    text: 'text-pink-900 dark:text-pink-100' 
  },
}

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-amber-400',
  APPROVED: 'bg-emerald-500',
  IMPLEMENTED: 'bg-sky-500',
}

const ROTATIONS: Record<number, number> = {}
function rotateFor(id: number) {
  if (!(id in ROTATIONS)) ROTATIONS[id] = ([-3, -2, -1, 0, 1, 2, 3])[Math.abs(id * 7) % 7]
  return ROTATIONS[id]
}

// ─── Computed ─────────────────────────────────────────────────────────────────

const visible = computed(() =>
  filter.value === 'ALL' ? ideas.value : ideas.value.filter(i => i.cat === filter.value)
)

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchIdeas() {
  loading.value = true
  try {
    const res = await api.get('/marketing/ideas')
    const raw = res.data as any[]
    ideas.value = raw
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item, i) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        creator: item.creator,
        cat: (item.category || item.cat || 'REELS') as Idea['cat'],
        status: (item.status || 'PENDING') as Idea['status'],
        likes: item.likes || 0,
        likedByMe: item.likedByMe || false,
        comments: item.comments || [],
        x: (item.posX !== null && item.posX !== undefined && item.posX !== 40) ? item.posX : (40 + (i % 4) * 260),
        y: (item.posY !== null && item.posY !== undefined && item.posY !== 40) ? item.posY : (40 + Math.floor(i / 4) * 200),
        z: 10 + (raw.length - i),
      }))
  } catch {
    toast.error('Error al cargar la pizarra')
  } finally {
    loading.value = false
  }
}

async function submitIdea() {
  if (!newIdea.value.title.trim() || !newIdea.value.content.trim()) return
  try {
    await api.post('/marketing/ideas', {
      title: newIdea.value.title,
      content: newIdea.value.content,
      category: newIdea.value.cat,
    })
    toast.success('¡Idea publicada en la pizarra!')
    newIdea.value = { title: '', content: '', cat: 'REELS', creator: '' }
    showNewModal.value = false
    fetchIdeas()
  } catch {
    toast.error('Error al guardar la idea')
  }
}

async function toggleLike(idea: Idea) {
  idea.likedByMe = !idea.likedByMe
  idea.likes += idea.likedByMe ? 1 : -1
  try {
    await api.post(`/marketing/ideas/${idea.id}/like`)
  } catch {
    idea.likedByMe = !idea.likedByMe
    idea.likes += idea.likedByMe ? 1 : -1
  }
}

async function cycleStatus(idea: Idea) {
  const order: Idea['status'][] = ['PENDING', 'APPROVED', 'IMPLEMENTED']
  const next = order[(order.indexOf(idea.status) + 1) % 3]
  const prev = idea.status
  idea.status = next
  try {
    await api.patch(`/marketing/ideas/${idea.id}/status`, { status: next })
  } catch {
    idea.status = prev
    toast.error('Error al cambiar el estado')
  }
}

async function deleteIdea(id: number) {
  ideas.value = ideas.value.filter(i => i.id !== id)
  if (detailIdea.value?.id === id) detailIdea.value = null
  try {
    await api.delete(`/marketing/ideas/${id}`)
  } catch {
    toast.error('Error al eliminar la idea')
    fetchIdeas()
  }
}

async function addComment(idea: Idea) {
  const { author, text } = newComment.value
  if (!author.trim() || !text.trim()) return
  const comment: Comment = { author: author.trim(), text: text.trim() }
  if (!idea.comments) idea.comments = []
  idea.comments.push(comment)
  newComment.value = { author: '', text: '' }
  try {
    await api.post(`/marketing/ideas/${idea.id}/comments`, comment)
  } catch {
    toast.error('Error al guardar el comentario')
  }
}

async function savePosition(idea: Idea) {
  try {
    await api.patch(`/marketing/ideas/${idea.id}/position`, { posX: idea.x, posY: idea.y })
  } catch { }
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

function startDrag(e: MouseEvent, idea: Idea, el: HTMLElement) {
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()

  zTop++
  idea.z = zTop
  el.style.zIndex = String(zTop)
  el.style.transition = 'none'
  el.style.transform = `rotate(0deg)`
  el.classList.add('dragging')

  const boardRect = boardRef.value!.getBoundingClientRect()
  const offsetX = e.clientX - boardRect.left - idea.x
  const offsetY = e.clientY - boardRect.top - idea.y

  function onMove(e: MouseEvent) {
    const bRect = boardRef.value!.getBoundingClientRect()
    let nx = e.clientX - bRect.left - offsetX
    let ny = e.clientY - bRect.top - offsetY
    nx = Math.max(0, Math.min(bRect.width - 220, nx))
    ny = Math.max(0, Math.min(bRect.height - 200, ny))
    idea.x = nx
    idea.y = ny
    el.style.left = nx + 'px'
    el.style.top = ny + 'px'
  }

  function onUp() {
    el.classList.remove('dragging')
    el.style.transition = ''
    el.style.transform = `rotate(${rotateFor(idea.id)}deg)`
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    savePosition(idea)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(fetchIdeas)
</script>

<template>
  <div class="space-y-4 select-none">

    <!-- Toolbar -->
    <div class="flex items-center gap-3 flex-wrap">
      <Button @click="showNewModal = true"
        class="rounded-xl h-9 px-4 gap-2 font-black uppercase text-[10px] tracking-widest">
        <Plus class="w-3.5 h-3.5" /> Nueva idea
      </Button>

      <div class="w-px h-5 bg-border/60" />

      <div class="flex items-center gap-1.5 flex-wrap">
        <button v-for="cat in ['ALL', 'REELS', 'OUTREACH', 'CHAT', 'TRENDS']" :key="cat" @click="filter = cat as any"
          class="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all" :class="filter === cat
            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
            : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'">
          {{ cat === 'ALL' ? 'Todas' : CATS[cat as keyof typeof CATS] }}
        </button>
      </div>

      <span class="ml-auto text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {{ visible.length }} idea{{ visible.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Board -->
    <div ref="boardRef" class="relative w-full rounded-2xl overflow-hidden border border-border/50 bg-muted/30 dark:bg-zinc-900/50"
      style="min-height: 580px;">
      <!-- Grid dots -->
      <div class="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
        style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 28px 28px;" 
        :class="'text-muted-foreground'" />

      <!-- Empty state -->
      <div v-if="!loading && visible.length === 0"
        class="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none">
        <Lightbulb class="w-12 h-12 text-muted-foreground mb-3" />
        <p class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {{ filter === 'ALL' ? 'Agregá la primera idea' : 'Sin ideas en esta categoría' }}
        </p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
        <div class="w-6 h-6 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
      </div>

      <!-- Notes -->
      <div v-for="idea in visible" :key="idea.id"
        class="absolute w-[215px] rounded-xl p-4 cursor-grab select-none group transition-shadow hover:shadow-lg"
        :class="CAT_STYLES[idea.cat].note"
        :style="{
          left: idea.x + 'px',
          top: idea.y + 'px',
          zIndex: idea.z,
          transform: `rotate(${rotateFor(idea.id)}deg)`,
        }" @mousedown="(e) => startDrag(e, idea, $event.currentTarget as HTMLElement)">
        <!-- Header -->
        <div class="flex items-start justify-between mb-2">
          <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
            :class="CAT_STYLES[idea.cat].badge">
            {{ CATS[idea.cat] }}
          </span>
          <button @click.stop="deleteIdea(idea.id)"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 bg-transparent border-none cursor-pointer rounded p-0.5 leading-none text-sm">
            <X class="w-3 h-3" />
          </button>
        </div>

        <!-- Title -->
        <p class="text-[12px] font-black leading-tight mb-1" :class="CAT_STYLES[idea.cat].text">{{ idea.title }}</p>

        <!-- Creator -->
        <p class="text-[10px] text-muted-foreground font-medium mb-2">
          {{ idea.creator?.name || 'Anónimo' }}
        </p>

        <!-- Body -->
        <p class="text-[11px] text-foreground/60 leading-relaxed line-clamp-3 mb-3">
          {{ idea.content }}
        </p>

        <!-- Footer -->
        <div class="flex items-center gap-1 border-t border-border/30 pt-2">
          <!-- Like -->
          <button @click.stop="toggleLike(idea)"
            class="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition-colors cursor-pointer border-none bg-transparent"
            :class="idea.likedByMe ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground hover:text-foreground'">
            <Heart class="w-3 h-3" :fill="idea.likedByMe ? 'currentColor' : 'none'" />
            {{ idea.likes }}
          </button>

          <!-- Status -->
          <button @click.stop="cycleStatus(idea)"
            class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md transition-colors cursor-pointer border-none bg-transparent">
            <span class="w-1.5 h-1.5 rounded-full" :class="STATUS_DOT[idea.status]" />
            {{ STATUS_LABELS[idea.status] }}
          </button>

          <!-- Detail -->
          <button @click.stop="detailIdea = idea"
            class="ml-auto flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none bg-transparent p-1 rounded-md">
            <Info class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Nueva Idea ────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showNewModal"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showNewModal = false">
        <div class="bg-card rounded-2xl border border-border/50 w-full max-w-md p-8 shadow-2xl">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-base font-black uppercase tracking-tight">Nueva idea</h2>
              <p class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Compartí con el
                equipo</p>
            </div>
            <button @click="showNewModal = false"
              class="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-0.5 mb-1.5 block">Título</label>
              <Input v-model="newIdea.title" placeholder="Ej: Challenge con Sofia" class="h-11 rounded-xl" />
            </div>

            <div>
              <label
                class="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-0.5 mb-1.5 block">Categoría</label>
              <select v-model="newIdea.cat"
                class="w-full h-11 rounded-xl bg-muted/50 border border-border/50 px-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="REELS">Reels / Shorts</option>
                <option value="OUTREACH">Outreach / Captación</option>
                <option value="CHAT">Chat Gimmicks</option>
                <option value="TRENDS">Tendencias Globales</option>
              </select>
            </div>

            <div>
              <label
                class="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-0.5 mb-1.5 block">Descripción</label>
              <textarea v-model="newIdea.content" placeholder="Cómo llevarla a cabo..."
                class="w-full h-24 rounded-xl bg-muted/50 border border-border/50 px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <div class="flex gap-3 pt-2">
              <Button variant="outline" @click="showNewModal = false"
                class="flex-1 rounded-xl h-11 font-black uppercase text-[10px] tracking-widest">
                Cancelar
              </Button>
              <Button @click="submitIdea"
                class="flex-1 rounded-xl h-11 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/15">
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal: Detalle ───────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="detailIdea"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="detailIdea = null">
        <div class="bg-card rounded-2xl border border-border/50 w-full max-w-md shadow-2xl overflow-hidden"
          style="max-height: 85vh;">
          <!-- Color strip -->
          <div class="h-1.5 w-full" :class="CAT_STYLES[detailIdea.cat].note" />

          <div class="p-8 overflow-y-auto" style="max-height: calc(85vh - 6px)">
            <!-- Header -->
            <div class="flex items-start justify-between mb-5">
              <div>
                <span class="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mb-2"
                  :class="CAT_STYLES[detailIdea.cat].badge">
                  {{ CATS[detailIdea.cat] }}
                </span>
                <h2 class="text-base font-black uppercase tracking-tight leading-tight">{{ detailIdea.title }}</h2>
                <p class="text-[10px] text-muted-foreground font-medium mt-1">por {{ detailIdea.creator?.name ||
                  'Anónimo' }}</p>
              </div>
              <button @click="detailIdea = null"
                class="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Body -->
            <p class="text-sm text-foreground/80 leading-relaxed mb-5">{{ detailIdea.content }}</p>

            <!-- Stats row -->
            <div class="flex items-center gap-4 py-3 border-y border-border/50 mb-5">
              <div class="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <span class="w-2 h-2 rounded-full" :class="STATUS_DOT[detailIdea.status]" />
                {{ STATUS_LABELS[detailIdea.status] }}
              </div>
              <div class="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <Heart class="w-3 h-3" />
                {{ detailIdea.likes }} me gusta
              </div>
              <div class="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <ChevronRight class="w-3 h-3" />
                {{ (detailIdea.comments || []).length }} comentarios
              </div>
            </div>

            <!-- Comments -->
            <div class="space-y-3 mb-5">
              <p class="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Comentarios</p>
              <div v-if="!detailIdea.comments?.length"
                class="text-[11px] text-muted-foreground/50 font-medium text-center py-4">
                Sin comentarios aún
              </div>
              <div v-for="(c, i) in detailIdea.comments" :key="i"
                class="text-[12px] text-foreground/70 border-b border-border/30 pb-2 last:border-0">
                <span class="font-black text-foreground">{{ c.author }}: </span>{{ c.text }}
              </div>
            </div>

            <!-- Add comment -->
            <div class="flex gap-2">
              <Input v-model="newComment.author" placeholder="Tu nombre"
                class="h-9 rounded-xl text-[11px] w-28 shrink-0" />
              <Input v-model="newComment.text" placeholder="Comentá..." class="h-9 rounded-xl text-[11px] flex-1"
                @keyup.enter="addComment(detailIdea)" />
              <Button @click="addComment(detailIdea)" size="icon" class="h-9 w-9 rounded-xl shrink-0">
                <Send class="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dragging {
  cursor: grabbing !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18) !important;
  transform: rotate(0deg) !important;
}
</style>