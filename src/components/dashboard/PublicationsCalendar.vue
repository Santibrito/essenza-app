<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  ChevronLeft, ChevronRight, Plus, Instagram,
  Calendar, Loader2, AlertTriangle, Trash2, Sparkles, ExternalLink,
  PlayCircle, LayoutGrid, Columns3, List as ListIcon,
  Search, RefreshCw, Film, Camera, Ban, Users, GripVertical, Copy,
  Pencil, CheckCheck, X, CheckSquare,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  usePublications,
  CONTENT_TYPE_LABELS,
  STATUS_LABELS,
} from '@/lib/usePublications'
import { useIgPosts } from '@/lib/useIgPosts'
import { useTimezone } from '@/lib/useTimezone'
import IgScheduleModal from '@/components/dashboard/IgScheduleModal.vue'
import IgPostEditModal from '@/components/dashboard/IgPostEditModal.vue'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  assignedModels?: { id: number; name: string; alias?: string }[]
}>()

const { getCalendar: getOldCalendar, cancel: cancelOld } = usePublications()
const { getCalendar: igGetCalendar, cancel: cancelIg, remove: igRemove, reschedule: igReschedule, duplicate: igDuplicate, getAccounts } = useIgPosts()
const { formatTime: tzFormatTime, dateKeyInUserTz, tzAbbrev, userTz, zonedToUtcISO } = useTimezone()

const pad2 = (n: number) => String(n).padStart(2, '0')

// ── Item normalizado (mezcla legacy + cuentas IG nuevas) ───────────────────────
interface CalItem {
  key: string
  rawId: number
  isIg: boolean
  title: string            // @handle o nombre de modelo
  modelId?: number | null
  modelName?: string
  contentType: string
  scheduledAt: string
  status: string
  caption?: string
  link?: string
  errorMessage?: string
  photoUrl?: string        // avatar de la cuenta
  postUrl?: string
  mediaUrl?: string        // miniatura del contenido
  igAccountId?: number | null
}

// ── Vista activa ───────────────────────────────────────────────────────────────
type ViewMode = 'month' | 'week' | 'list' | 'accounts'
const view = ref<ViewMode>('month')
// 'week' y 'accounts' navegan/ cargan por semana; el resto por mes.
const isWeekView = computed(() => view.value === 'week' || view.value === 'accounts')

// Ancla de navegación (un solo Date que maneja mes y semana)
const today = new Date()
const viewDate = ref<Date>(new Date(today))

// ── Datos ────────────────────────────────────────────────────────────────────
const items = ref<CalItem[]>([])
const calendarLoading = ref(false)

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
const MONTH_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

// ── Filtros ────────────────────────────────────────────────────────────────────
const filterModel  = ref<number | 'all'>('all')
const filterTypes  = ref<Set<string>>(new Set())   // vacío = todos
const search       = ref('')
const showCancelled = ref(false)

function toggleType(t: string) {
  if (filterTypes.value.has(t)) filterTypes.value.delete(t)
  else filterTypes.value.add(t)
  filterTypes.value = new Set(filterTypes.value)
}
const activeFiltersCount = computed(() =>
  (filterModel.value !== 'all' ? 1 : 0) + filterTypes.value.size + (search.value ? 1 : 0)
)
function clearFilters() {
  filterModel.value = 'all'; filterTypes.value = new Set(); search.value = ''
}

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter(it => {
    if (!showCancelled.value && it.status === 'CANCELLED') return false
    if (filterModel.value !== 'all' && it.modelId !== filterModel.value) return false
    if (filterTypes.value.size && !filterTypes.value.has(it.contentType)) return false
    if (q) {
      const hay = `${it.title} ${it.modelName || ''} ${it.caption || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

// ── Helpers de fecha ────────────────────────────────────────────────────────────
function keyOf(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function startOfWeek(d: Date) {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7 // 0=Lun
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x
}
function isToday(d: Date | null) { return !!d && d.toDateString() === today.toDateString() }
function isPast(d: Date | null) {
  if (!d) return false
  const x = new Date(d); x.setHours(23, 59, 59); return x < today
}
function itemsForDay(d: Date): CalItem[] {
  const k = keyOf(d)
  return filteredItems.value
    .filter(p => dateKeyInUserTz(p.scheduledAt) === k)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
}

// ── Grilla del MES ──────────────────────────────────────────────────────────────
const calendarDays = computed(() => {
  const year = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth() // 0-based
  const jsFirst = new Date(year, month, 1).getDay()
  const leading = (jsFirst + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: { date: Date | null }[] = []
  for (let i = 0; i < leading; i++) cells.push({ date: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) })
  while (cells.length % 7 !== 0) cells.push({ date: null }) // completar última fila
  return cells
})

// ── SEMANA ──────────────────────────────────────────────────────────────────────
const weekDays = computed(() => {
  const s = startOfWeek(viewDate.value)
  return Array.from({ length: 7 }, (_, i) => { const dt = new Date(s); dt.setDate(s.getDate() + i); return dt })
})

// ── LISTA (agenda del mes) ────────────────────────────────────────────────────────
const agendaGroups = computed(() => {
  const year = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth()
  const groups: { date: Date; items: CalItem[] }[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const its = itemsForDay(date)
    if (its.length) groups.push({ date, items: its })
  }
  return groups
})

// ── Resumen del período visible ───────────────────────────────────────────────────
const periodStats = computed(() => {
  let pool: CalItem[]
  if (isWeekView.value) {
    const keys = new Set(weekDays.value.map(keyOf))
    pool = filteredItems.value.filter(p => keys.has(dateKeyInUserTz(p.scheduledAt)))
  } else {
    const y = viewDate.value.getFullYear(), m = viewDate.value.getMonth()
    pool = filteredItems.value.filter(p => {
      const k = dateKeyInUserTz(p.scheduledAt)
      return k.startsWith(`${y}-${pad2(m + 1)}`)
    })
  }
  return {
    total: pool.length,
    pending: pool.filter(p => p.status === 'PENDING').length,
    processing: pool.filter(p => p.status === 'PROCESSING').length,
    published: pool.filter(p => p.status === 'PUBLISHED').length,
    failed: pool.filter(p => p.status === 'FAILED').length,
  }
})

const periodLabel = computed(() => {
  const d = viewDate.value
  if (isWeekView.value) {
    const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6)
    const sameMonth = s.getMonth() === e.getMonth()
    return sameMonth
      ? `${s.getDate()} – ${e.getDate()} ${MONTH_SHORT[s.getMonth()]}`
      : `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]}`
  }
  return MONTH_NAMES[d.getMonth()]
})

// ── Navegación ────────────────────────────────────────────────────────────────────
function prev() {
  const d = new Date(viewDate.value)
  if (isWeekView.value) d.setDate(d.getDate() - 7)
  else d.setMonth(d.getMonth() - 1)
  viewDate.value = d
}
function next() {
  const d = new Date(viewDate.value)
  if (isWeekView.value) d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  viewDate.value = d
}
function goToday() { viewDate.value = new Date(today) }

// ── Carga (cubre los meses que toca la vista) ─────────────────────────────────────
function monthsForView(): { y: number; m: number }[] {
  const set = new Map<string, { y: number; m: number }>()
  const add = (dt: Date) => { const k = `${dt.getFullYear()}-${dt.getMonth()}`; if (!set.has(k)) set.set(k, { y: dt.getFullYear(), m: dt.getMonth() + 1 }) }
  if (isWeekView.value) { weekDays.value.forEach(add) }
  else { add(viewDate.value) }
  return Array.from(set.values())
}

async function loadCalendar() {
  calendarLoading.value = true
  try {
    const months = monthsForView()
    const results = await Promise.all(months.map(({ y, m }) => Promise.all([
      getOldCalendar(y, m).catch(() => []),
      igGetCalendar(y, m).catch(() => []),
    ])))
    const map = new Map<string, CalItem>()
    for (const [oldPubs, igPosts] of results) {
      for (const p of (igPosts || [])) {
        map.set('ig' + p.id, {
          key: 'ig' + p.id, rawId: p.id, isIg: true,
          title: p.handle ? '@' + p.handle : (p.modelName || 'Cuenta IG'),
          modelId: p.modelId ?? null, modelName: p.modelName,
          contentType: p.contentType, scheduledAt: p.scheduledAt, status: p.status,
          caption: p.caption, link: p.link, errorMessage: p.errorMessage,
          photoUrl: p.profilePhotoUrl, postUrl: p.postUrl, mediaUrl: p.mediaUrl,
          igAccountId: p.igAccountId ?? null,
        })
      }
      for (const p of (oldPubs || [])) {
        map.set('old' + p.id, {
          key: 'old' + p.id, rawId: p.id, isIg: false,
          title: p.modelName, modelName: p.modelName,
          contentType: p.contentType, scheduledAt: p.scheduledAt, status: p.status,
          caption: p.caption, link: p.customLink, errorMessage: p.errorMessage,
        })
      }
    }
    items.value = Array.from(map.values())
  } catch (e: any) {
    toast.error('Error al cargar el calendario', { description: e.message })
  } finally {
    calendarLoading.value = false
  }
}

watch([viewDate, view], loadCalendar)
onMounted(loadCalendar)

// ── Modal de día ───────────────────────────────────────────────────────────────
const dayModal = ref<{ date: Date } | null>(null)
const dayModalItems = computed(() => dayModal.value ? itemsForDay(dayModal.value.date) : [])
function openDay(d: Date) { dayModal.value = { date: d } }

// ── Programar ─────────────────────────────────────────────────────────────────
const showSchedule = ref(false)
const scheduleDate = ref<string | undefined>(undefined)
const scheduleTime = ref<string | undefined>(undefined)
function openSchedule(date?: Date, time?: string) {
  scheduleDate.value = date ? keyOf(date) : undefined
  scheduleTime.value = time
  showSchedule.value = true
}
async function onScheduled() { await loadCalendar() }

// ── Drag & drop para reprogramar ───────────────────────────────────────────────
const dragKey = ref<string | null>(null)     // it.key que se está arrastrando
const dropTarget = ref<string | null>(null)   // celda resaltada al pasar por encima
const rescheduling = ref(false)

function canDrag(it: CalItem) { return it.isIg && it.status === 'PENDING' }

/** Hora "de pared" (HH:mm) de un instante, vista en la zona del usuario. */
function hhmmInUserTz(iso: string) {
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: userTz.value, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(utc))
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00'
  let hh = get('hour'); if (hh === '24') hh = '00'
  return `${hh}:${get('minute')}`
}
/** Minutos desde medianoche (zona del usuario) — para ubicar la tarjeta en la grilla. */
function minutesInUserTz(iso: string) {
  const [h, m] = hhmmInUserTz(iso).split(':').map(Number)
  return h * 60 + m
}

function onDragStart(it: CalItem, e: DragEvent) {
  if (!canDrag(it)) { e.preventDefault(); return }
  dragKey.value = it.key
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', it.key) } catch {} }
}
function onDragEnd() { dragKey.value = null; dropTarget.value = null }
function onCellDragOver(cellKey: string, e: DragEvent) {
  if (!dragKey.value) return
  e.preventDefault()
  dropTarget.value = cellKey
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
function onCellDragLeave(cellKey: string) { if (dropTarget.value === cellKey) dropTarget.value = null }
function onCellDrop(targetDay: Date, accountId: number | null, e: DragEvent) {
  e.preventDefault()
  const it = items.value.find(x => x.key === dragKey.value)
  dropTarget.value = null; dragKey.value = null
  if (it) reschedule(it, targetDay, accountId)
}

/** targetTime "HH:mm" opcional: si viene (grilla horaria), pone esa hora; si no, conserva la original. */
async function reschedule(it: CalItem, targetDay: Date, targetAccountId: number | null, targetTime?: string) {
  if (!canDrag(it)) { toast.error('Solo se pueden mover las publicaciones pendientes'); return }
  const time = targetTime || hhmmInUserTz(it.scheduledAt)
  const sameDay = dateKeyInUserTz(it.scheduledAt) === keyOf(targetDay)
  const sameAcc = targetAccountId == null || targetAccountId === it.igAccountId
  const sameTime = !targetTime || hhmmInUserTz(it.scheduledAt) === targetTime
  if (sameDay && sameAcc && sameTime) return
  const iso = zonedToUtcISO(keyOf(targetDay), time)
  const prev = { scheduledAt: it.scheduledAt, igAccountId: it.igAccountId }
  it.scheduledAt = iso
  if (!sameAcc) it.igAccountId = targetAccountId
  rescheduling.value = true
  try {
    await igReschedule(it.rawId, iso, sameAcc ? undefined : (targetAccountId as number))
    toast.success(sameAcc ? 'Reprogramado' : 'Reprogramado y reasignado')
    await loadCalendar()
  } catch (e: any) {
    it.scheduledAt = prev.scheduledAt; it.igAccountId = prev.igAccountId // revertir
    toast.error('No se pudo reprogramar', { description: e.message })
  } finally { rescheduling.value = false }
}

// ── Grilla horaria (vista Semana) ──────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const HOUR_PX = 52
const gridScroller = ref<HTMLElement | null>(null)

/** Posición vertical (px) de una publicación según su hora. */
function topForItem(it: CalItem) { return (minutesInUserTz(it.scheduledAt) / 60) * HOUR_PX }

/** Minuto (snap 15') a partir de la posición del cursor dentro de una celda de hora. */
function minuteFromEvent(hour: number, e: DragEvent | MouseEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const frac = Math.min(0.999, Math.max(0, (e.clientY - rect.top) / rect.height))
  let total = hour * 60 + frac * 60
  total = Math.round(total / 15) * 15            // snap a 15'
  total = Math.min(23 * 60 + 45, Math.max(0, total))
  const hh = Math.floor(total / 60), mm = total % 60
  return `${pad2(hh)}:${pad2(mm)}`
}
function onSlotDrop(day: Date, hour: number, e: DragEvent) {
  e.preventDefault()
  const it = items.value.find(x => x.key === dragKey.value)
  const time = minuteFromEvent(hour, e, e.currentTarget as HTMLElement)
  dropTarget.value = null; dragKey.value = null
  if (it) reschedule(it, day, null, time)
}
function onSlotClick(day: Date, hour: number, e: MouseEvent) {
  openSchedule(day, minuteFromEvent(hour, e, e.currentTarget as HTMLElement))
}

// Línea de "ahora" (solo si la semana visible contiene hoy)
const nowTop = ref(0)
let nowTimer: any = null
function refreshNow() {
  const mins = minutesInUserTz(new Date().toISOString())
  nowTop.value = (mins / 60) * HOUR_PX
}
const weekHasToday = computed(() => weekDays.value.some(d => isToday(d)))

watch(view, (v) => {
  if (v === 'week') {
    refreshNow()
    // arrancar el scroll cerca de la hora actual (o las 8:00)
    requestAnimationFrame(() => {
      if (gridScroller.value) {
        const target = weekHasToday.value ? Math.max(0, nowTop.value - 120) : 8 * HOUR_PX
        gridScroller.value.scrollTop = target
      }
    })
  }
})
onMounted(() => { refreshNow(); nowTimer = setInterval(refreshNow, 60_000) })
onUnmounted(() => { if (nowTimer) clearInterval(nowTimer) })

// ── Duplicar ───────────────────────────────────────────────────────────────────
async function duplicateItem(it: CalItem) {
  if (!it.isIg) { toast.error('Solo se duplican las publicaciones de cuentas IG'); return }
  try {
    await igDuplicate(it.rawId)
    toast.success('Publicación duplicada — movela al horario que quieras')
    await loadCalendar()
  } catch (e: any) {
    toast.error('No se pudo duplicar', { description: e.message })
  }
}

// ── Editar ───────────────────────────────────────────────────────────────────
const showEdit = ref(false)
const editPost = ref<CalItem | null>(null)
function openEdit(it: CalItem) {
  if (!it.isIg) { toast.error('Solo se editan las publicaciones de cuentas IG'); return }
  if (it.status !== 'PENDING') { toast.error('Solo se editan las pendientes'); return }
  editPost.value = it
  showEdit.value = true
}
async function onEdited() { await loadCalendar() }

// ── Vista previa al pasar el mouse ─────────────────────────────────────────────
const hover = ref<{ it: CalItem; x: number; y: number } | null>(null)
let hoverTimer: any = null
function onHover(it: CalItem, e: MouseEvent) {
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    hover.value = { it, x: Math.min(e.clientX + 16, window.innerWidth - 280), y: Math.min(e.clientY + 12, window.innerHeight - 240) }
  }, 320)
}
function offHover() { clearTimeout(hoverTimer); hover.value = null }

// ── Selección múltiple (bulk) ──────────────────────────────────────────────────
const selectMode = ref(false)
const selected = ref<Set<string>>(new Set())
const bulkBusy = ref(false)
function toggleSelectMode() { selectMode.value = !selectMode.value; if (!selectMode.value) selected.value = new Set() }
function toggleSelect(it: CalItem) {
  if (selected.value.has(it.key)) selected.value.delete(it.key)
  else selected.value.add(it.key)
  selected.value = new Set(selected.value)
}
const selectedItems = computed(() => filteredItems.value.filter(i => selected.value.has(i.key)))
function clearSelection() { selected.value = new Set() }

async function bulkDelete() {
  const its = selectedItems.value.filter(i => i.status !== 'PROCESSING')
  if (!its.length) return
  bulkBusy.value = true
  let ok = 0
  try {
    for (const it of its) {
      try { if (it.isIg) await igRemove(it.rawId); else await cancelOld(it.rawId); ok++ } catch { /* sigue */ }
    }
    toast.success(`${ok} publicación(es) eliminada(s)`)
    clearSelection(); selectMode.value = false
    await loadCalendar()
  } finally { bulkBusy.value = false }
}
async function bulkCancel() {
  const its = selectedItems.value.filter(i => i.status === 'PENDING')
  if (!its.length) { toast.error('Ninguna seleccionada está pendiente'); return }
  bulkBusy.value = true
  let ok = 0
  try {
    for (const it of its) {
      try { if (it.isIg) await cancelIg(it.rawId); else await cancelOld(it.rawId); ok++ } catch { /* sigue */ }
    }
    toast.success(`${ok} cancelada(s)`)
    clearSelection(); selectMode.value = false
    await loadCalendar()
  } finally { bulkBusy.value = false }
}
async function bulkDuplicate() {
  const its = selectedItems.value.filter(i => i.isIg)
  if (!its.length) return
  bulkBusy.value = true
  let ok = 0
  try {
    for (const it of its) { try { await igDuplicate(it.rawId); ok++ } catch { /* sigue */ } }
    toast.success(`${ok} duplicada(s)`)
    clearSelection(); selectMode.value = false
    await loadCalendar()
  } finally { bulkBusy.value = false }
}

// ── Vista por cuentas (swimlanes) ──────────────────────────────────────────────
const swimAccounts = ref<any[]>([])
const loadingSwim = ref(false)
async function loadSwimAccounts() {
  const ids = filterModel.value !== 'all'
    ? [filterModel.value as number]
    : (props.assignedModels || []).map(m => m.id)
  if (!ids.length) { swimAccounts.value = []; return }
  loadingSwim.value = true
  try {
    const all = await Promise.all(ids.map(id => getAccounts(id).catch(() => [])))
    const map = new Map<number, any>()
    all.flat().forEach((a: any) => { if (a.igUsername) map.set(a.id, a) })
    swimAccounts.value = Array.from(map.values())
  } finally { loadingSwim.value = false }
}
watch([view, filterModel], () => { if (view.value === 'accounts') loadSwimAccounts() })

// Filas: cuentas traídas + cualquier cuenta presente en los items (por si falta alguna)
const swimRows = computed(() => {
  const map = new Map<number, { id: number; handle: string; photoUrl?: string; status: string; ready: boolean }>()
  for (const a of swimAccounts.value) {
    map.set(a.id, { id: a.id, handle: '@' + a.igUsername, photoUrl: a.profilePhotoUrl, status: a.status, ready: a.status === 'READY' })
  }
  for (const it of filteredItems.value) {
    if (it.isIg && it.igAccountId != null && !map.has(it.igAccountId)) {
      map.set(it.igAccountId, { id: it.igAccountId, handle: it.title, photoUrl: it.photoUrl, status: 'READY', ready: true })
    }
  }
  return Array.from(map.values()).sort((a, b) => Number(b.ready) - Number(a.ready) || a.handle.localeCompare(b.handle))
})
function itemsForAccountDay(accId: number, d: Date): CalItem[] {
  const k = keyOf(d)
  return filteredItems.value
    .filter(p => p.isIg && p.igAccountId === accId && dateKeyInUserTz(p.scheduledAt) === k)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
}

// ── Cancelar / Eliminar ───────────────────────────────────────────────────────
const confirmKey = ref<string | null>(null)
let confirmTimer: any = null
function askDelete(it: CalItem) {
  confirmKey.value = it.key
  clearTimeout(confirmTimer)
  confirmTimer = setTimeout(() => { confirmKey.value = null }, 3500)
}
async function doDelete(it: CalItem) {
  confirmKey.value = null
  try {
    if (it.isIg) await igRemove(it.rawId)
    else await cancelOld(it.rawId) // legacy: se cancela (queda oculto por filtro)
    toast.success(it.isIg ? 'Publicación eliminada' : 'Publicación cancelada')
    await loadCalendar()
  } catch (e: any) {
    toast.error('No se pudo eliminar', { description: e.message })
  }
}
async function cancelItem(it: CalItem) {
  try {
    if (it.isIg) await cancelIg(it.rawId)
    else await cancelOld(it.rawId)
    toast.success('Publicación cancelada')
    await loadCalendar()
  } catch (e: any) {
    toast.error('No se pudo cancelar', { description: e.message })
  }
}

// ── Estética ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) { return tzFormatTime(iso) }
function contentLabel(ct: string) { return (CONTENT_TYPE_LABELS as any)[ct] || ct }
function statusLabel(s: string) { return (STATUS_LABELS as any)[s] || s }
function isImage(url?: string) { return !!url && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url) }

// Acento por tipo de contenido (icono + gradiente)
const TYPE: Record<string, { icon: any; grad: string; soft: string; text: string }> = {
  REEL:  { icon: Film,        grad: 'from-violet-500 to-fuchsia-500', soft: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400' },
  STORY: { icon: Sparkles,    grad: 'from-amber-400 to-pink-500',     soft: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400' },
  POST:  { icon: Camera,      grad: 'from-sky-500 to-cyan-500',       soft: 'bg-sky-500/10',     text: 'text-sky-600 dark:text-sky-400' },
  TIKTOK:{ icon: PlayCircle,  grad: 'from-zinc-700 to-zinc-900',      soft: 'bg-zinc-500/10',    text: 'text-zinc-600 dark:text-zinc-300' },
}
function typeMeta(ct: string) { return TYPE[ct] || TYPE.POST }

// Punto / chip de estado
const DOT: Record<string, string> = {
  PENDING: 'bg-amber-400', PROCESSING: 'bg-blue-400', PUBLISHED: 'bg-emerald-500',
  FAILED: 'bg-red-500', CANCELLED: 'bg-zinc-300 dark:bg-zinc-600',
}
function dot(s: string) { return DOT[s] || 'bg-zinc-300' }
const CHIP: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PROCESSING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUBLISHED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  CANCELLED: 'bg-zinc-400/10 text-zinc-500 line-through',
}
function chip(s: string) { return CHIP[s] || 'bg-zinc-400/10 text-zinc-500' }

// Color estable por cuenta (barrita lateral) — ayuda a distinguir cuentas de un vistazo
const ACCENTS = [
  'bg-violet-500', 'bg-fuchsia-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500',
]
function accountColorByName(s: string) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}
function accountColor(it: CalItem) { return accountColorByName(it.title || '') }

const VIEWS: { id: ViewMode; label: string; icon: any }[] = [
  { id: 'month',    label: 'Mes',     icon: LayoutGrid },
  { id: 'week',     label: 'Semana',  icon: Columns3 },
  { id: 'accounts', label: 'Cuentas', icon: Users },
  { id: 'list',     label: 'Lista',   icon: ListIcon },
]
const CONTENT_FILTERS = [
  { id: 'REEL', label: 'Reels' }, { id: 'STORY', label: 'Historias' }, { id: 'POST', label: 'Posts' },
]
</script>

<template>
  <div class="h-full flex flex-col min-h-0">

    <!-- ══ TOOLBAR ══════════════════════════════════════════════════════════ -->
    <div class="shrink-0 mb-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-sm p-3 space-y-3 shadow-sm">
      <!-- Fila 1: título + navegación + vista + acción -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0">
            <Calendar class="w-5 h-5" />
          </div>
          <div class="min-w-[150px]">
            <h2 class="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-none capitalize">
              {{ periodLabel }}
              <span class="text-zinc-400 dark:text-zinc-600 font-bold">{{ viewDate.getFullYear() }}</span>
            </h2>
            <p class="text-[11px] text-zinc-400 font-semibold mt-1">
              {{ periodStats.total }} publicación{{ periodStats.total !== 1 ? 'es' : '' }} · horario {{ tzAbbrev() }}
              <span v-if="isWeekView" class="text-violet-500 font-bold">· arrastrá ✦ para reprogramar</span>
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="prev" class="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button @click="goToday" class="h-7 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Hoy</button>
            <button @click="next" class="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ChevronRight class="w-4 h-4" />
            </button>
            <button @click="loadCalendar" :disabled="calendarLoading" class="w-7 h-7 ml-1 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="Refrescar">
              <RefreshCw :class="['w-3.5 h-3.5', calendarLoading && 'animate-spin']" />
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Switch de vista -->
          <div class="flex items-center gap-0.5 p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60">
            <button v-for="v in VIEWS" :key="v.id" @click="view = v.id"
              :class="['flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all',
                       view === v.id ? 'bg-white dark:bg-zinc-950 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200']">
              <component :is="v.icon" class="w-3.5 h-3.5" />{{ v.label }}
            </button>
          </div>
          <button @click="toggleSelectMode" v-if="view === 'list'"
            :class="['h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all',
                     selectMode ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800']">
            <CheckSquare class="w-3.5 h-3.5" />{{ selectMode ? 'Listo' : 'Seleccionar' }}
          </button>
          <Button @click="openSchedule()" class="gap-2 h-9 shadow-md shadow-violet-500/20 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 hover:from-violet-700 hover:to-fuchsia-700 hover:shadow-lg hover:shadow-violet-500/30 transition-all">
            <Sparkles class="w-4 h-4" /><span class="text-sm font-semibold">Programar</span>
          </Button>
        </div>
      </div>

      <!-- Fila 2: filtros + resumen -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Buscar -->
          <div class="relative">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input v-model="search" placeholder="Buscar cuenta…"
              class="h-8 w-44 pl-8 pr-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          </div>
          <!-- Modelo -->
          <select v-if="(props.assignedModels?.length || 0) > 1" v-model="filterModel"
            class="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background px-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/30">
            <option :value="'all'">Todas las modelos</option>
            <option v-for="m in props.assignedModels" :key="m.id" :value="m.id">{{ m.alias || m.name }}</option>
          </select>
          <!-- Tipo -->
          <div class="flex items-center gap-1">
            <button v-for="c in CONTENT_FILTERS" :key="c.id" @click="toggleType(c.id)"
              :class="['flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold border transition-all',
                       filterTypes.has(c.id)
                         ? `${typeMeta(c.id).soft} ${typeMeta(c.id).text} border-transparent`
                         : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800']">
              <component :is="typeMeta(c.id).icon" class="w-3 h-3" />{{ c.label }}
            </button>
          </div>
          <!-- Mostrar cancelados -->
          <button @click="showCancelled = !showCancelled"
            :class="['flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold border transition-all',
                     showCancelled ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-transparent' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800']">
            <Ban class="w-3 h-3" />Cancelados
          </button>
          <button v-if="activeFiltersCount" @click="clearFilters" class="text-[11px] font-bold text-violet-600 hover:underline px-1">Limpiar ({{ activeFiltersCount }})</button>
        </div>

        <!-- Resumen de estados -->
        <div class="hidden md:flex items-center gap-1.5">
          <span class="flex items-center gap-1 text-[11px] font-bold px-2 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>{{ periodStats.pending }}</span>
          <span v-if="periodStats.processing" class="flex items-center gap-1 text-[11px] font-bold px-2 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400"><Loader2 class="w-3 h-3 animate-spin" />{{ periodStats.processing }}</span>
          <span class="flex items-center gap-1 text-[11px] font-bold px-2 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{{ periodStats.published }}</span>
          <span v-if="periodStats.failed" class="flex items-center gap-1 text-[11px] font-bold px-2 h-7 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>{{ periodStats.failed }}</span>
        </div>
      </div>
    </div>

    <!-- ══ ÁREA DE VISTAS ══════════════════════════════════════════════════ -->
    <div class="relative flex-1 min-h-0">
      <div v-if="calendarLoading" class="absolute inset-0 flex items-center justify-center bg-background/50 z-20 rounded-xl backdrop-blur-[1px]">
        <Loader2 class="w-6 h-6 animate-spin text-violet-500" />
      </div>

      <!-- ── VISTA MES ──────────────────────────────────────────────────── -->
      <div v-if="view === 'month'" class="h-full flex flex-col min-h-0">
        <div class="grid grid-cols-7 mb-2 shrink-0">
          <div v-for="(d, i) in DAY_NAMES" :key="d"
            :class="['text-center text-[10px] font-black uppercase tracking-widest py-1', i >= 5 ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-400 dark:text-zinc-600']">{{ d }}</div>
        </div>
        <div class="grid grid-cols-7 gap-1.5 flex-1 min-h-0 overflow-y-auto auto-rows-fr content-start pr-0.5">
          <div v-for="(cell, idx) in calendarDays" :key="idx"
            @click="cell.date && openDay(cell.date)"
            @dragover="cell.date && onCellDragOver(keyOf(cell.date), $event)"
            @dragleave="cell.date && onCellDragLeave(keyOf(cell.date))"
            @drop="cell.date && onCellDrop(cell.date, null, $event)"
            :class="['group relative rounded-xl border p-1.5 flex flex-col transition-all duration-150 min-h-[104px]',
                     cell.date ? 'cursor-pointer hover:border-violet-400/50 hover:shadow-md hover:shadow-violet-500/5' : 'opacity-0 pointer-events-none border-transparent',
                     cell.date && dropTarget === keyOf(cell.date) ? 'ring-2 ring-violet-500 border-violet-500 bg-violet-500/[0.08]'
                       : (isToday(cell.date) ? 'border-violet-400/60 bg-violet-500/[0.05]' : 'border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40'),
                     isPast(cell.date) && !isToday(cell.date) ? 'opacity-65' : '']">
            <div class="flex items-center justify-between mb-1 px-0.5 shrink-0">
              <span :class="isToday(cell.date)
                ? 'w-5 h-5 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center text-[10px] font-black'
                : 'text-xs font-black leading-none text-zinc-500 dark:text-zinc-400'">{{ cell.date?.getDate() }}</span>
              <button v-if="cell.date" @click.stop="openSchedule(cell.date)"
                class="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition-all" title="Programar acá">
                <Plus class="w-3 h-3" />
              </button>
            </div>
            <template v-if="cell.date">
              <div class="space-y-1 overflow-hidden">
                <div v-for="it in itemsForDay(cell.date).slice(0, 3)" :key="it.key"
                  :draggable="canDrag(it)"
                  @dragstart="onDragStart(it, $event)" @dragend="onDragEnd"
                  @mouseenter="onHover(it, $event)" @mouseleave="offHover"
                  :class="['relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg overflow-hidden hover:brightness-105', chip(it.status),
                           canDrag(it) ? 'cursor-grab active:cursor-grabbing' : '',
                           dragKey === it.key ? 'opacity-40' : '']">
                  <span :class="['absolute left-0 top-0 bottom-0 w-1', accountColor(it)]"></span>
                  <div class="w-5 h-5 rounded-md overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center relative">
                    <img v-if="isImage(it.mediaUrl)" :src="it.mediaUrl" class="w-full h-full object-cover" />
                    <template v-else-if="it.mediaUrl">
                      <video :src="it.mediaUrl" class="w-full h-full object-cover" muted preload="metadata" />
                      <PlayCircle class="w-2.5 h-2.5 text-white/90 absolute drop-shadow" />
                    </template>
                    <component v-else :is="typeMeta(it.contentType).icon" class="w-2.5 h-2.5 text-zinc-400" />
                  </div>
                  <span class="text-[9px] font-black tabular-nums shrink-0">{{ formatTime(it.scheduledAt) }}</span>
                  <span class="text-[9px] font-bold truncate opacity-80">{{ it.title }}</span>
                </div>
                <button v-if="itemsForDay(cell.date).length > 3" @click.stop="openDay(cell.date)"
                  class="w-full text-left text-[9px] font-black text-violet-500 hover:text-violet-600 px-1.5 pt-0.5">
                  +{{ itemsForDay(cell.date).length - 3 }} más
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ── VISTA SEMANA (GRILLA HORARIA) ──────────────────────────────── -->
      <div v-else-if="view === 'week'" class="h-full flex flex-col min-h-0 rounded-xl border border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
        <!-- cabecera de días -->
        <div class="shrink-0 grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-900/40">
          <div class="flex items-end justify-center pb-1 text-[8px] font-black uppercase text-zinc-300 dark:text-zinc-700">{{ tzAbbrev() }}</div>
          <div v-for="d in weekDays" :key="keyOf(d)"
            :class="['px-2 py-2 text-center border-l border-zinc-100 dark:border-zinc-800/60', isToday(d) ? 'bg-violet-500/[0.06]' : '']">
            <p class="text-[10px] font-black uppercase tracking-wider text-zinc-400">{{ DAY_NAMES[(d.getDay() + 6) % 7] }}</p>
            <p :class="['text-sm font-black', isToday(d) ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-300']">{{ d.getDate() }}</p>
          </div>
        </div>

        <!-- grilla scrolleable -->
        <div ref="gridScroller" class="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <div class="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            <!-- eje horario -->
            <div class="relative" :style="{ height: HOURS.length * HOUR_PX + 'px' }">
              <div v-for="h in HOURS" :key="h"
                class="absolute right-1.5 -translate-y-1/2 text-[9px] font-black tabular-nums text-zinc-300 dark:text-zinc-600"
                :style="{ top: h * HOUR_PX + 'px' }">{{ pad2(h) }}:00</div>
            </div>
            <!-- columnas de días -->
            <div v-for="d in weekDays" :key="keyOf(d)"
              class="relative border-l border-zinc-100 dark:border-zinc-800/50"
              :style="{ height: HOURS.length * HOUR_PX + 'px' }">
              <!-- celdas de hora (drop + clic para crear) -->
              <div v-for="h in HOURS" :key="h"
                @dragover="onCellDragOver('g' + keyOf(d) + '-' + h, $event)"
                @dragleave="onCellDragLeave('g' + keyOf(d) + '-' + h)"
                @drop="onSlotDrop(d, h, $event)"
                @click="onSlotClick(d, h, $event)"
                :class="['absolute left-0 right-0 border-b border-zinc-50 dark:border-zinc-800/30 cursor-pointer hover:bg-violet-500/[0.05] transition-colors',
                         dropTarget === 'g' + keyOf(d) + '-' + h ? 'bg-violet-500/15 ring-1 ring-inset ring-violet-500/40' : '']"
                :style="{ top: h * HOUR_PX + 'px', height: HOUR_PX + 'px' }"></div>

              <!-- línea de AHORA -->
              <div v-if="isToday(d)" class="absolute left-0 right-0 z-30 pointer-events-none" :style="{ top: nowTop + 'px' }">
                <div class="h-0.5 bg-red-500"></div>
                <div class="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500 shadow"></div>
              </div>

              <!-- publicaciones posicionadas por hora -->
              <div v-for="it in itemsForDay(d)" :key="it.key"
                :draggable="canDrag(it)" @dragstart="onDragStart(it, $event)" @dragend="onDragEnd"
                @click.stop="openDay(d)"
                @mouseenter="onHover(it, $event)" @mouseleave="offHover"
                :style="{ top: topForItem(it) + 'px' }"
                :class="['absolute left-0.5 right-0.5 z-10 rounded-md overflow-hidden border shadow-sm hover:z-40 hover:shadow-md transition-shadow',
                         chip(it.status), 'border-black/5 dark:border-white/5',
                         canDrag(it) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                         dragKey === it.key ? 'opacity-40' : '',
                         dragKey ? 'pointer-events-none' : '']">
                <span :class="['absolute left-0 top-0 bottom-0 w-1', accountColor(it)]"></span>
                <div class="flex items-center gap-1 pl-2 pr-1 py-1">
                  <div class="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <img v-if="it.photoUrl" :src="it.photoUrl" class="w-full h-full object-cover" />
                    <Instagram v-else class="w-2 h-2 text-pink-500" />
                  </div>
                  <span class="text-[9px] font-black tabular-nums shrink-0">{{ formatTime(it.scheduledAt) }}</span>
                  <span class="text-[9px] font-bold truncate opacity-90">{{ it.title }}</span>
                  <component :is="typeMeta(it.contentType).icon" :class="['w-2.5 h-2.5 shrink-0 ml-auto', typeMeta(it.contentType).text]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── VISTA CUENTAS (SWIMLANES) ──────────────────────────────────── -->
      <div v-else-if="view === 'accounts'" class="h-full flex flex-col min-h-0 rounded-xl border border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
        <!-- cabecera de días -->
        <div class="shrink-0 grid grid-cols-[170px_repeat(7,minmax(0,1fr))] border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-900/40">
          <div class="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Users class="w-3.5 h-3.5" /> Cuenta
          </div>
          <div v-for="d in weekDays" :key="keyOf(d)"
            :class="['px-2 py-2 text-center border-l border-zinc-100 dark:border-zinc-800/60', isToday(d) ? 'bg-violet-500/[0.06]' : '']">
            <p class="text-[10px] font-black uppercase tracking-wider text-zinc-400">{{ DAY_NAMES[(d.getDay() + 6) % 7] }}</p>
            <p :class="['text-sm font-black', isToday(d) ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-600 dark:text-zinc-300']">{{ d.getDate() }}</p>
          </div>
        </div>

        <!-- filas por cuenta -->
        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <div v-if="loadingSwim" class="flex items-center justify-center h-32"><Loader2 class="w-5 h-5 animate-spin text-violet-500" /></div>
          <div v-else-if="!swimRows.length" class="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
            <Users class="w-8 h-8 opacity-30" />
            <p class="text-xs font-medium">No hay cuentas para mostrar</p>
          </div>
          <div v-for="acc in swimRows" :key="acc.id"
            class="grid grid-cols-[170px_repeat(7,minmax(0,1fr))] border-b border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20">
            <!-- etiqueta de cuenta -->
            <div class="px-3 py-2 flex items-center gap-2 border-r border-zinc-100 dark:border-zinc-800/40 sticky left-0 bg-white dark:bg-zinc-900/60 z-10">
              <span :class="['w-1 h-8 rounded-full shrink-0', accountColorByName(acc.handle)]"></span>
              <div class="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <img v-if="acc.photoUrl" :src="acc.photoUrl" class="w-full h-full object-cover" />
                <Instagram v-else class="w-3 h-3 text-pink-500" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-black truncate text-zinc-800 dark:text-zinc-200">{{ acc.handle }}</p>
                <span :class="['text-[8px] font-black uppercase tracking-wide', acc.ready ? 'text-emerald-500' : 'text-amber-500']">{{ acc.ready ? 'Lista' : acc.status }}</span>
              </div>
            </div>
            <!-- celdas por día -->
            <div v-for="d in weekDays" :key="keyOf(d)"
              @dragover="onCellDragOver('s' + acc.id + '-' + keyOf(d), $event)"
              @dragleave="onCellDragLeave('s' + acc.id + '-' + keyOf(d))"
              @drop="onCellDrop(d, acc.id, $event)"
              :class="['group/cell relative min-h-[64px] p-1 space-y-1 border-l border-zinc-100 dark:border-zinc-800/40 transition-colors',
                       dropTarget === 's' + acc.id + '-' + keyOf(d) ? 'bg-violet-500/10 ring-2 ring-inset ring-violet-500/50' : (isToday(d) ? 'bg-violet-500/[0.03]' : '')]">
              <div v-for="it in itemsForAccountDay(acc.id, d)" :key="it.key"
                @click="openDay(d)"
                :draggable="canDrag(it)" @dragstart="onDragStart(it, $event)" @dragend="onDragEnd"
                :class="['relative flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-md overflow-hidden', chip(it.status),
                         canDrag(it) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                         dragKey === it.key ? 'opacity-40' : '']">
                <GripVertical v-if="canDrag(it)" class="w-2.5 h-2.5 shrink-0 opacity-50" />
                <span class="text-[9px] font-black tabular-nums shrink-0">{{ formatTime(it.scheduledAt) }}</span>
                <component :is="typeMeta(it.contentType).icon" :class="['w-2.5 h-2.5 shrink-0', typeMeta(it.contentType).text]" />
              </div>
              <button @click.stop="openSchedule(d)"
                class="absolute inset-x-1 bottom-1 h-4 rounded flex items-center justify-center opacity-0 group-hover/cell:opacity-100 bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-all">
                <Plus class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── VISTA LISTA / AGENDA ───────────────────────────────────────── -->
      <div v-else class="h-full overflow-y-auto scrollbar-thin pr-1 space-y-4">
        <div v-if="!agendaGroups.length" class="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
          <Calendar class="w-10 h-10 opacity-30" />
          <p class="text-sm font-semibold">Sin publicaciones este mes</p>
          <Button variant="outline" size="sm" @click="openSchedule()" class="gap-1.5"><Plus class="w-3.5 h-3.5" />Programar una</Button>
        </div>
        <div v-for="g in agendaGroups" :key="keyOf(g.date)">
          <div class="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-1">
            <div :class="['flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0', isToday(g.date) ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800']">
              <span class="text-base font-black leading-none">{{ g.date.getDate() }}</span>
              <span class="text-[8px] font-black uppercase tracking-wider opacity-80">{{ MONTH_SHORT[g.date.getMonth()] }}</span>
            </div>
            <div>
              <p class="text-sm font-black capitalize text-zinc-800 dark:text-zinc-200">{{ g.date.toLocaleDateString('es-AR', { weekday: 'long' }) }}</p>
              <p class="text-[11px] text-zinc-400 font-semibold">{{ g.items.length }} publicación{{ g.items.length !== 1 ? 'es' : '' }}</p>
            </div>
          </div>
          <div class="space-y-1.5 pl-1">
            <div v-for="it in g.items" :key="it.key"
              @mouseenter="onHover(it, $event)" @mouseleave="offHover"
              @click="selectMode && it.isIg ? toggleSelect(it) : null"
              :class="['relative flex items-center gap-3 rounded-xl border bg-white dark:bg-zinc-900/40 p-2.5 pl-3.5 overflow-hidden transition-all',
                       selected.has(it.key) ? 'border-violet-500 ring-1 ring-violet-500/30 bg-violet-500/[0.04]' : 'border-zinc-100 dark:border-zinc-800 hover:shadow-md hover:-translate-y-px',
                       selectMode && it.isIg ? 'cursor-pointer' : '']">
              <span :class="['absolute left-0 top-0 bottom-0 w-1.5', accountColor(it)]"></span>
              <button v-if="selectMode && it.isIg" @click.stop="toggleSelect(it)"
                :class="['w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                         selected.has(it.key) ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-300 dark:border-zinc-600']">
                <CheckCheck v-if="selected.has(it.key)" class="w-3 h-3" />
              </button>
              <span class="text-sm font-black tabular-nums text-zinc-700 dark:text-zinc-300 w-12 shrink-0">{{ formatTime(it.scheduledAt) }}</span>
              <div class="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center relative">
                <img v-if="isImage(it.mediaUrl)" :src="it.mediaUrl" class="w-full h-full object-cover" />
                <template v-else-if="it.mediaUrl">
                  <video :src="it.mediaUrl" class="w-full h-full object-cover" muted preload="metadata" />
                  <PlayCircle class="w-4 h-4 text-white/90 absolute drop-shadow" />
                </template>
                <component v-else :is="typeMeta(it.contentType).icon" class="w-4 h-4 text-zinc-400" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <div class="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-pink-500/15 flex items-center justify-center">
                    <img v-if="it.photoUrl" :src="it.photoUrl" class="w-full h-full object-cover" />
                    <Instagram v-else class="w-2.5 h-2.5 text-pink-500" />
                  </div>
                  <p class="text-xs font-black truncate text-zinc-800 dark:text-zinc-200">{{ it.title }}</p>
                  <span :class="['text-[8px] font-black uppercase px-1.5 py-0.5 rounded', typeMeta(it.contentType).soft, typeMeta(it.contentType).text]">{{ contentLabel(it.contentType) }}</span>
                </div>
                <p v-if="it.caption" class="text-[11px] text-zinc-400 truncate mt-0.5">{{ it.caption }}</p>
              </div>
              <span :class="['text-[9px] font-black px-2 py-1 rounded-lg shrink-0 flex items-center gap-1', chip(it.status)]">
                <Loader2 v-if="it.status === 'PROCESSING'" class="w-2.5 h-2.5 animate-spin" />
                <span v-else :class="['w-1.5 h-1.5 rounded-full', dot(it.status)]"></span>{{ statusLabel(it.status) }}
              </span>
              <div class="flex items-center gap-1 shrink-0">
                <a v-if="it.postUrl" :href="it.postUrl" target="_blank" class="w-7 h-7 rounded-lg flex items-center justify-center text-violet-500 hover:bg-violet-500/10 transition-colors" title="Ver publicación"><ExternalLink class="w-3.5 h-3.5" /></a>
                <button v-if="it.isIg && it.status === 'PENDING'" @click.stop="openEdit(it)"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-sky-500 hover:bg-sky-500/10 transition-colors" title="Editar">
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button v-if="it.isIg" @click.stop="duplicateItem(it)"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-violet-500 hover:bg-violet-500/10 transition-colors" title="Duplicar">
                  <Copy class="w-3.5 h-3.5" />
                </button>
                <button v-if="it.status !== 'PROCESSING'"
                  @click="confirmKey === it.key ? doDelete(it) : askDelete(it)"
                  :class="['h-7 rounded-lg flex items-center justify-center transition-all', confirmKey === it.key ? 'px-2 bg-red-500 text-white text-[10px] font-bold gap-1' : 'w-7 text-zinc-400 hover:text-red-500 hover:bg-red-500/10']"
                  title="Eliminar">
                  <Trash2 class="w-3.5 h-3.5" /><span v-if="confirmKey === it.key">Seguro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ MODAL DE DÍA ════════════════════════════════════════════════════ -->
  <Dialog :open="!!dayModal" @update:open="v => { if (!v) dayModal = null }">
    <DialogContent class="sm:max-w-md p-0 gap-0 overflow-hidden">
      <DialogHeader class="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 space-y-0">
        <DialogTitle class="flex items-center justify-between">
          <div v-if="dayModal">
            <p class="text-sm font-black capitalize">{{ dayModal.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
            <p class="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{{ dayModalItems.length }} publicación{{ dayModalItems.length !== 1 ? 'es' : '' }} · {{ tzAbbrev() }}</p>
          </div>
          <button @click="dayModal && openSchedule(dayModal.date)" class="h-8 px-2.5 gap-1.5 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center hover:bg-violet-500/20 transition-colors text-xs font-bold">
            <Plus class="w-3.5 h-3.5" />Programar
          </button>
        </DialogTitle>
      </DialogHeader>

      <div class="max-h-[60vh] overflow-y-auto p-3 space-y-2 scrollbar-thin">
        <div v-if="!dayModalItems.length" class="flex flex-col items-center justify-center h-32 text-zinc-400 gap-2">
          <Calendar class="w-8 h-8 opacity-30" />
          <p class="text-xs font-medium">Sin publicaciones</p>
        </div>

        <div v-for="it in dayModalItems" :key="it.key"
          class="relative rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 pl-4 space-y-2 overflow-hidden">
          <span :class="['absolute left-0 top-0 bottom-0 w-1.5', accountColor(it)]"></span>
          <div class="flex items-start gap-2.5">
            <div class="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center relative">
              <img v-if="isImage(it.mediaUrl)" :src="it.mediaUrl" class="w-full h-full object-cover" />
              <template v-else-if="it.mediaUrl">
                <video :src="it.mediaUrl" class="w-full h-full object-cover" muted preload="metadata" />
                <PlayCircle class="w-4 h-4 text-white/90 absolute drop-shadow" />
              </template>
              <component v-else :is="typeMeta(it.contentType).icon" class="w-4 h-4 text-zinc-400" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <div class="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-pink-500/15 flex items-center justify-center">
                    <img v-if="it.photoUrl" :src="it.photoUrl" class="w-full h-full object-cover" />
                    <Instagram v-else class="w-2.5 h-2.5 text-pink-500" />
                  </div>
                  <p class="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate leading-none">{{ it.title }}</p>
                </div>
                <span :class="['text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1', chip(it.status)]">
                  <Loader2 v-if="it.status === 'PROCESSING'" class="w-2.5 h-2.5 animate-spin" />
                  <span v-else :class="['w-1.5 h-1.5 rounded-full', dot(it.status)]"></span>{{ statusLabel(it.status) }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 mt-1.5">
                <span class="text-sm font-black tabular-nums text-zinc-900 dark:text-zinc-100 leading-none">{{ formatTime(it.scheduledAt) }}</span>
                <span class="text-[8px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded">{{ tzAbbrev() }}</span>
                <span :class="['text-[10px] font-bold flex items-center gap-1', typeMeta(it.contentType).text]"><component :is="typeMeta(it.contentType).icon" class="w-3 h-3" />{{ contentLabel(it.contentType) }}</span>
              </div>
            </div>
          </div>

          <p v-if="it.caption" class="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{{ it.caption }}</p>

          <a v-if="it.postUrl" :href="it.postUrl" target="_blank" class="flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-400 font-semibold hover:underline">
            <ExternalLink class="w-3 h-3" /> Ver publicación
          </a>
          <a v-else-if="it.link" :href="it.link" target="_blank" class="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 truncate hover:underline font-medium">
            <ExternalLink class="w-3 h-3 shrink-0" /><span class="truncate">{{ it.link }}</span>
          </a>

          <div v-if="it.errorMessage" class="flex items-start gap-1.5 bg-red-500/10 rounded-lg p-2">
            <AlertTriangle class="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
            <p class="text-[10px] text-red-500 leading-relaxed">{{ it.errorMessage }}</p>
          </div>

          <!-- Acciones -->
          <div class="flex items-center gap-2 pt-1">
            <button v-if="it.isIg && it.status === 'PENDING'" @click="openEdit(it)"
              class="flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-lg py-1.5 px-2.5 transition-colors">
              <Pencil class="w-3 h-3" /> Editar
            </button>
            <button v-if="it.status === 'PENDING'" @click="cancelItem(it)"
              class="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg py-1.5 px-2.5 transition-colors">
              <Ban class="w-3 h-3" /> Cancelar
            </button>
            <button v-if="it.isIg" @click="duplicateItem(it)"
              class="flex items-center justify-center gap-1.5 text-[11px] font-bold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg py-1.5 px-2.5 transition-colors">
              <Copy class="w-3 h-3" /> Duplicar
            </button>
            <button v-if="it.status !== 'PROCESSING'"
              @click="confirmKey === it.key ? doDelete(it) : askDelete(it)"
              :class="['flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold rounded-lg py-1.5 transition-colors',
                       confirmKey === it.key ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10']">
              <Trash2 class="w-3 h-3" /> {{ confirmKey === it.key ? '¿Seguro? Tocá de nuevo' : 'Eliminar' }}
            </button>
            <div v-if="it.status === 'PROCESSING'" class="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-blue-500 py-1.5">
              <Loader2 class="w-3 h-3 animate-spin" /> Subiendo…
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- ══ BARRA DE ACCIONES MASIVAS ════════════════════════════════════════ -->
  <Transition name="bulkbar">
    <div v-if="selectMode && selected.size"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10">
      <span class="text-xs font-black px-2 tabular-nums">{{ selected.size }} seleccionada{{ selected.size !== 1 ? 's' : '' }}</span>
      <div class="w-px h-5 bg-white/15"></div>
      <button @click="bulkDuplicate" :disabled="bulkBusy" class="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
        <Copy class="w-3.5 h-3.5" /> Duplicar
      </button>
      <button @click="bulkCancel" :disabled="bulkBusy" class="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
        <Ban class="w-3.5 h-3.5" /> Cancelar
      </button>
      <button @click="bulkDelete" :disabled="bulkBusy" class="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 transition-colors disabled:opacity-50">
        <Loader2 v-if="bulkBusy" class="w-3.5 h-3.5 animate-spin" /><Trash2 v-else class="w-3.5 h-3.5" /> Eliminar
      </button>
      <button @click="clearSelection" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"><X class="w-3.5 h-3.5" /></button>
    </div>
  </Transition>

  <!-- ══ VISTA PREVIA AL PASAR EL MOUSE ═══════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="preview">
      <div v-if="hover" class="fixed z-[60] w-64 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl shadow-black/30 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden pointer-events-none"
        :style="{ left: hover.x + 'px', top: hover.y + 'px' }">
        <div class="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative">
          <img v-if="isImage(hover.it.mediaUrl)" :src="hover.it.mediaUrl" class="w-full h-full object-cover" />
          <template v-else-if="hover.it.mediaUrl">
            <video :src="hover.it.mediaUrl" class="w-full h-full object-cover" muted preload="metadata" />
            <PlayCircle class="w-10 h-10 text-white/90 absolute drop-shadow" />
          </template>
          <component v-else :is="typeMeta(hover.it.contentType).icon" class="w-10 h-10 text-zinc-300" />
          <span :class="['absolute top-2 left-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full backdrop-blur', typeMeta(hover.it.contentType).soft, typeMeta(hover.it.contentType).text]">{{ contentLabel(hover.it.contentType) }}</span>
        </div>
        <div class="p-3 space-y-1.5">
          <div class="flex items-center gap-1.5">
            <div class="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-pink-500/15 flex items-center justify-center">
              <img v-if="hover.it.photoUrl" :src="hover.it.photoUrl" class="w-full h-full object-cover" />
              <Instagram v-else class="w-3 h-3 text-pink-500" />
            </div>
            <p class="text-xs font-black truncate text-zinc-800 dark:text-zinc-200">{{ hover.it.title }}</p>
            <span :class="['ml-auto text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1', chip(hover.it.status)]">
              <span :class="['w-1.5 h-1.5 rounded-full', dot(hover.it.status)]"></span>{{ statusLabel(hover.it.status) }}
            </span>
          </div>
          <p class="text-[11px] font-bold text-zinc-500 tabular-nums">{{ formatTime(hover.it.scheduledAt) }} {{ tzAbbrev() }}</p>
          <p v-if="hover.it.caption" class="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed">{{ hover.it.caption }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Modal: programar -->
  <IgScheduleModal
    v-model:open="showSchedule"
    :assignedModels="assignedModels"
    :initialDate="scheduleDate"
    :initialTime="scheduleTime"
    @scheduled="onScheduled"
  />

  <!-- Modal: editar -->
  <IgPostEditModal v-model:open="showEdit" :post="editPost" @saved="onEdited" />
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(120,120,130,0.3); border-radius: 9999px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }

.bulkbar-enter-active, .bulkbar-leave-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.bulkbar-enter-from, .bulkbar-leave-to { opacity: 0; transform: translate(-50%, 16px); }

.preview-enter-active, .preview-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.preview-enter-from, .preview-leave-to { opacity: 0; transform: scale(0.96); }
</style>
