<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import {
  Sparkles, RefreshCw, Trash2, Copy, Instagram, Loader2,
  PlayCircle, ScrollText, ShieldAlert, Image as ImageIcon, Check, X, Globe, ExternalLink, Pencil,
  KeyRound, RotateCcw, ShieldCheck,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useIgAccounts, type IgAccount, type IgAccountEvent } from '@/lib/useIgAccounts'
import { generateTotp } from '@/lib/totp'
import api from '@/api'
import { toast } from 'vue-sonner'

const {
  accounts, loading, busyId,
  fetchByModel, createProxySlot, attachInstagram,
  refreshStats, runStep, mark, remove, fetchEvents, setWebsite, setUsername,
  getCredentials, updateAccount, regenerateProxy,
} = useIgAccounts()

// ── Selector de modelo (el panel es standalone, marketing elige la modelo) ──
const models = ref<{ id: number; name: string }[]>([])
const selectedModelId = ref<number | null>(null)
const loadingModels = ref(false)

async function loadModels() {
  loadingModels.value = true
  try {
    const res = await api.get('/admin/models/active')
    models.value = (res.data || []).map((m: any) => ({ id: m.id, name: m.name || m.alias || `Modelo ${m.id}` }))
    if (models.value.length && selectedModelId.value == null) selectedModelId.value = models.value[0].id
  } catch {
    toast.error('No se pudieron cargar las modelos')
  } finally {
    loadingModels.value = false
  }
}
onMounted(loadModels)
watch(selectedModelId, (id) => { if (id) fetchByModel(id) })

// ── Generador de código 2FA (TOTP client-side; el seed no sale del equipo) ──
const show2faDialog = ref(false)
const seed2fa = ref('')
const code2fa = ref('')
const secondsLeft = ref(0)
const error2fa = ref('')
let totpTimer: ReturnType<typeof setInterval> | null = null

function open2fa(seed = '') {
  seed2fa.value = seed
  code2fa.value = ''
  error2fa.value = ''
  secondsLeft.value = 0
  show2faDialog.value = true
  if (seed) generate2fa()
}
async function generate2fa() {
  const seed = seed2fa.value.trim()
  if (!seed) { error2fa.value = 'Pegá la clave (seed) de 2FA'; return }
  try {
    const r = await generateTotp(seed)
    code2fa.value = r.code
    secondsLeft.value = r.secondsLeft
    error2fa.value = ''
    if (totpTimer) clearInterval(totpTimer)
    // Refresca el código y el contador cada segundo mientras el modal está abierto.
    totpTimer = setInterval(async () => {
      try {
        const rr = await generateTotp(seed2fa.value.trim())
        code2fa.value = rr.code
        secondsLeft.value = rr.secondsLeft
      } catch { /* seed cambiado/inválido: lo maneja el botón */ }
    }, 1000)
  } catch {
    error2fa.value = 'Seed inválido — revisá que sea el código Base32 de 2FA'
    code2fa.value = ''
  }
}
function stop2faTimer() {
  if (totpTimer) { clearInterval(totpTimer); totpTimer = null }
}
// Al cerrar el modal: borrar todo (el seed no queda en memoria).
watch(show2faDialog, (open) => {
  if (!open) { stop2faTimer(); seed2fa.value = ''; code2fa.value = ''; error2fa.value = ''; secondsLeft.value = 0 }
})
onUnmounted(stop2faTimer)

/** Abre el generador 2FA ya con el seed de una cuenta (lo trae de credenciales). */
async function quick2fa(a: IgAccount) {
  busyId.value = a.id
  const data = await getCredentials(a.id)
  busyId.value = null
  if (!data?.totpSeed) { toast.error('Esta cuenta no tiene seed de 2FA cargado'); return }
  open2fa(data.totpSeed)
}

// ── Configuración de la cuenta (ver/editar/copiar credenciales) ──
const showConfigDialog = ref(false)
const configAccount = ref<IgAccount | null>(null)
const loadingCfg = ref(false)
const savingCfg = ref(false)
const regenProxyConfirm = ref(false)
const cfg = ref<any>({})
async function openConfig(a: IgAccount) {
  configAccount.value = a
  showConfigDialog.value = true
  loadingCfg.value = true
  regenProxyConfirm.value = false
  const data = await getCredentials(a.id)
  cfg.value = data || {}
  loadingCfg.value = false
}
async function handleSaveConfig() {
  if (!configAccount.value) return
  savingCfg.value = true
  const ok = await updateAccount(configAccount.value.id, {
    igUsername: cfg.value.igUsername, igPassword: cfg.value.igPassword,
    totpSeed: cfg.value.totpSeed, backupCodes: cfg.value.backupCodes,
    email: cfg.value.email, emailPassword: cfg.value.emailPassword,
    proxy: cfg.value.proxy, fullName: cfg.value.fullName,
    bio: cfg.value.bio, externalUrl: cfg.value.externalUrl,
  })
  savingCfg.value = false
  if (ok) showConfigDialog.value = false
}
async function handleRegenProxy() {
  if (!configAccount.value) return
  if (!regenProxyConfirm.value) { regenProxyConfirm.value = true; return }
  const ok = await regenerateProxy(configAccount.value.id)
  regenProxyConfirm.value = false
  if (ok) { const d = await getCredentials(configAccount.value.id); if (d) cfg.value = d }
}
async function copyText(text: string, label = 'Copiado') {
  try { await navigator.clipboard.writeText(text || ''); toast.success(label) }
  catch { toast.error('No se pudo copiar') }
}

// ── Cambiar usuario de login (@ cambiado en IG) ──
const showUserDialog = ref(false)
const userAccount = ref<IgAccount | null>(null)
const newUsername = ref('')
const savingUser = ref(false)
function openEditUser(a: IgAccount) {
  userAccount.value = a
  newUsername.value = a.igUsername || ''
  showUserDialog.value = true
}
async function handleSetUsername() {
  if (!userAccount.value || !newUsername.value.trim()) return
  savingUser.value = true
  const ok = await setUsername(userAccount.value.id, newUsername.value.trim().replace(/^@/, ''))
  savingUser.value = false
  if (ok) showUserDialog.value = false
}

// ── Cambiar sitio web (link de la bio) ──
const showWebsiteDialog = ref(false)
const websiteAccount = ref<IgAccount | null>(null)
const websiteUrl = ref('')
const savingWebsite = ref(false)
function openProfile(a: IgAccount) {
  const user = (a.handle || a.igUsername || '').replace(/^@/, '').trim()
  if (!user) return
  window.open(`https://www.instagram.com/${user}`, '_blank', 'noopener')
}
function openWebsite(a: IgAccount) {
  websiteAccount.value = a
  websiteUrl.value = a.externalUrl || ''
  showWebsiteDialog.value = true
}
async function handleSetWebsite() {
  if (!websiteAccount.value || !websiteUrl.value.trim()) return
  savingWebsite.value = true
  const ok = await setWebsite(websiteAccount.value.id, websiteUrl.value.trim())
  savingWebsite.value = false
  if (ok) showWebsiteDialog.value = false
}

const DAYS_TO_READY = 5

const STATUS: Record<string, { label: string; cls: string }> = {
  PROXY_READY:    { label: 'Proxy listo',     cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  IMPORTED:       { label: 'Importada',       cls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  LOGGED_IN:      { label: 'Logueada',        cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  PHOTO_DONE:     { label: 'Foto puesta',     cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  BIO_DONE:       { label: 'Bio puesta',      cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  WARMING:        { label: 'Calentando 🔥',   cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  READY:          { label: 'LISTA ✅',         cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  SUSPENDED:      { label: 'Suspendida',      cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  BANNED:         { label: 'Baneada',         cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  CHALLENGED:     { label: 'Verificación',    cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  PHONE_REQUIRED: { label: 'Pide teléfono',   cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
}
const statusMeta = (s: string) => STATUS[s] || { label: s, cls: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' }

// AdsPower autocompleta host/port/user/pass al pegar "host:port:usuario:password" en el campo
// Host:Port (NO entiende la URL socks5://user:pass@host:port — ignora el @). El proxy guardado
// viene como socks5h://user:pass@host:port → lo convierto.
function toAdsPowerProxy(p?: string): string {
  if (!p) return ''
  const s = p.replace(/^socks5h?:\/\//i, '').replace(/^https?:\/\//i, '')
  const at = s.lastIndexOf('@')
  if (at === -1) return s
  const creds = s.slice(0, at)
  const server = s.slice(at + 1)
  const ci = creds.indexOf(':')
  const user = ci === -1 ? creds : creds.slice(0, ci)
  const pass = ci === -1 ? '' : creds.slice(ci + 1)
  const colon = server.lastIndexOf(':')
  const host = colon === -1 ? server : server.slice(0, colon)
  const port = colon === -1 ? '' : server.slice(colon + 1)
  return `${host}:${port}:${user}:${pass}`
}
function copyProxy(p?: string) {
  if (!p) return
  navigator.clipboard.writeText(toAdsPowerProxy(p))
  toast.success('Proxy copiado — pegalo en el campo Host:Port de AdsPower y se autocompleta')
}

// ── Crear slot (proxy) ──
const showSlotDialog = ref(false)
const slotForm = ref({ country: 'es', handle: '' })
const creatingSlot = ref(false)
async function handleCreateSlot() {
  if (!selectedModelId.value) { toast.error('Elegí una modelo primero'); return }
  creatingSlot.value = true
  const res = await createProxySlot({ modelId: selectedModelId.value, country: slotForm.value.country, handle: slotForm.value.handle.trim() || undefined })
  creatingSlot.value = false
  if (res) { showSlotDialog.value = false; slotForm.value = { country: 'es', handle: '' } }
}

// ── Enganchar Instagram ──
const showAttachDialog = ref(false)
const attachTarget = ref<IgAccount | null>(null)
const attachForm = ref({ bundle: '', fullName: '', bio: '', externalUrl: '', status: 'IMPORTED' })
const attachPhoto = ref<File | null>(null)
const attachPhotoPreview = ref<string | null>(null)
const attaching = ref(false)
function openAttach(acc: IgAccount) {
  attachTarget.value = acc
  attachForm.value = { bundle: '', fullName: '', bio: '', externalUrl: '', status: 'IMPORTED' }
  attachPhoto.value = null
  attachPhotoPreview.value = null
  showAttachDialog.value = true
}
function onPhotoChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) { attachPhoto.value = f; attachPhotoPreview.value = URL.createObjectURL(f) }
}
async function handleAttach() {
  if (!attachTarget.value) return
  if (!attachForm.value.bundle.trim()) { toast.error('Pegá el paquete de la cuenta'); return }
  attaching.value = true
  const res = await attachInstagram(attachTarget.value.id, {
    bundle: attachForm.value.bundle.trim(),
    fullName: attachForm.value.fullName.trim() || undefined,
    bio: attachForm.value.bio.trim() || undefined,
    externalUrl: attachForm.value.externalUrl.trim() || undefined,
    status: attachForm.value.status,
  }, attachPhoto.value)
  attaching.value = false
  if (res) {
    showAttachDialog.value = false
    refreshStats(res.id, true)
  }
}

// ── Auditoría ──
const showAuditDialog = ref(false)
const auditEvents = ref<IgAccountEvent[]>([])
const auditAccount = ref<IgAccount | null>(null)
const loadingAudit = ref(false)
async function openAudit(acc: IgAccount) {
  auditAccount.value = acc
  showAuditDialog.value = true
  loadingAudit.value = true
  auditEvents.value = await fetchEvents(acc.id)
  loadingAudit.value = false
}

function progressPct(a: IgAccount) {
  return Math.min(100, Math.round((a.warmupDay / DAYS_TO_READY) * 100))
}
const sortedAccounts = computed(() => accounts.value)
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-background p-4 rounded-xl border border-border/60 shadow-sm">
      <div class="flex items-center gap-3 min-w-0">
        <div>
          <h3 class="text-sm font-bold tracking-tight">Cuentas de Instagram</h3>
          <p class="text-[11px] text-muted-foreground mt-0.5">Gestión 100% API: generá el proxy, enganchá el IG, se calienta y publica solo.</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Selector de modelo -->
        <select v-model="selectedModelId"
          class="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]">
          <option v-if="!models.length" :value="null">{{ loadingModels ? 'Cargando…' : 'Sin modelos' }}</option>
          <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <Button size="sm" variant="outline" class="h-8 gap-2 font-semibold" @click="open2fa()">
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" /> Código 2FA
        </Button>
        <Button size="sm" :disabled="!selectedModelId" @click="showSlotDialog = true"
          class="h-8 gap-2 font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0">
          <Sparkles class="w-3.5 h-3.5" /> Nuevo (generar proxy)
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center p-8">
      <Loader2 class="w-5 h-5 animate-spin text-primary" />
    </div>

    <div v-else-if="!selectedModelId" class="text-center p-12 border border-dashed border-border/60 rounded-xl bg-muted/10">
      <Instagram class="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
      <p class="text-sm font-semibold">Elegí una modelo</p>
      <p class="text-[11px] text-muted-foreground mt-1">Seleccioná arriba la modelo para ver y gestionar sus cuentas de Instagram.</p>
    </div>

    <div v-else-if="accounts.length === 0" class="text-center p-12 border border-dashed border-border/60 rounded-xl bg-muted/10">
      <Instagram class="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
      <p class="text-sm font-semibold">Sin cuentas todavía</p>
      <p class="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">Tocá "Nuevo (generar proxy)" para arrancar: primero el proxy, después enganchás el Instagram.</p>
    </div>

    <!-- Listado -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div v-for="a in sortedAccounts" :key="a.id"
        class="rounded-xl border border-border/60 bg-background p-3.5 shadow-none flex flex-col gap-3">

        <!-- Top: foto + handle + estado -->
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-full bg-muted shrink-0 overflow-hidden flex items-center justify-center">
            <img v-if="a.profilePhotoUrl" :src="a.profilePhotoUrl" class="w-full h-full object-cover" />
            <ImageIcon v-else class="w-4 h-4 text-muted-foreground/40" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm truncate">{{ a.igUsername ? '@' + (a.handle || a.igUsername) : (a.handle || 'Slot sin IG') }}</span>
              <button v-if="a.igUsername" @click="openEditUser(a)" class="text-muted-foreground/60 hover:text-primary shrink-0" title="Editar usuario de login (si cambiaste el @ en IG)">
                <Pencil class="w-3 h-3" />
              </button>
              <Badge :class="['text-[9px] uppercase font-black tracking-wider border', statusMeta(a.status).cls]">{{ statusMeta(a.status).label }}</Badge>
            </div>
            <p v-if="a.fullName" class="text-[11px] text-muted-foreground truncate">{{ a.fullName }}</p>
            <p v-if="a.lastError" class="text-[10px] text-red-500 truncate mt-0.5">⚠ {{ a.lastError }}</p>
          </div>
        </div>

        <!-- Proxy (clave para AdsPower) -->
        <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5 border border-dashed border-border/40">
          <span class="text-[9px] font-black uppercase tracking-widest text-muted-foreground shrink-0">Proxy {{ a.proxyCountry }}</span>
          <span class="text-[10px] font-mono truncate flex-1 text-foreground/70">{{ a.proxy || '—' }}</span>
          <button @click="copyProxy(a.proxy)" class="text-muted-foreground hover:text-primary shrink-0" title="Copiar para AdsPower">
            <Copy class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Warmup progress -->
        <div v-if="['IMPORTED','LOGGED_IN','PHOTO_DONE','BIO_DONE','WARMING','READY'].includes(a.status)">
          <div class="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Warmup</span>
            <span class="font-bold">{{ a.status === 'READY' ? 'Completo' : `Día ${a.warmupDay}/${DAYS_TO_READY}` }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-muted overflow-hidden">
            <div class="h-full rounded-full transition-all"
              :class="a.status === 'READY' ? 'bg-emerald-500' : 'bg-amber-500'"
              :style="{ width: (a.status === 'READY' ? 100 : progressPct(a)) + '%' }" />
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-muted/30 py-1.5">
            <p class="text-sm font-black tabular-nums leading-none">{{ a.followers ?? '—' }}</p>
            <p class="text-[8px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">Seguidores</p>
          </div>
          <div class="rounded-lg bg-muted/30 py-1.5">
            <p class="text-sm font-black tabular-nums leading-none">{{ a.following ?? '—' }}</p>
            <p class="text-[8px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">Seguidos</p>
          </div>
          <div class="rounded-lg bg-muted/30 py-1.5">
            <p class="text-sm font-black tabular-nums leading-none">{{ a.posts ?? '—' }}</p>
            <p class="text-[8px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">Posts</p>
          </div>
        </div>

        <!-- Acciones -->
        <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40">
          <template v-if="a.status === 'PROXY_READY'">
            <Button size="sm" @click="openAttach(a)" class="h-7 text-[11px] font-semibold gap-1.5">
              <Instagram class="w-3 h-3" /> Enganchar IG
            </Button>
          </template>

          <template v-else>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px]" :disabled="busyId === a.id" @click="refreshStats(a.id)">
              <Loader2 v-if="busyId === a.id" class="w-3 h-3 animate-spin" /><RefreshCw v-else class="w-3 h-3" />
              <span class="ml-1">Stats</span>
            </Button>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px]" :disabled="busyId === a.id" @click="runStep(a.id)" title="Forzar el siguiente paso ya">
              <PlayCircle class="w-3 h-3" /><span class="ml-1">Paso</span>
            </Button>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px] text-emerald-600 dark:text-emerald-400" :disabled="busyId === a.id" @click="quick2fa(a)" title="Generar código 2FA de esta cuenta">
              <ShieldCheck class="w-3 h-3" /><span class="ml-1">2FA</span>
            </Button>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px]" :disabled="busyId === a.id" @click="openWebsite(a)" title="Cambiar el sitio web del perfil (link de la bio)">
              <Globe class="w-3 h-3" /><span class="ml-1">Sitio web</span>
            </Button>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px] text-pink-500 hover:text-pink-600" @click="openProfile(a)" title="Abrir el perfil de Instagram">
              <ExternalLink class="w-3 h-3" /><span class="ml-1">Perfil</span>
            </Button>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px]" @click="openConfig(a)" title="Ver/editar credenciales y proxy">
              <KeyRound class="w-3 h-3" /><span class="ml-1">Config</span>
            </Button>
          </template>

          <Button size="sm" variant="ghost" class="h-7 px-2 text-[11px]" @click="openAudit(a)">
            <ScrollText class="w-3 h-3" /><span class="ml-1">Auditoría</span>
          </Button>

          <div class="flex-1" />
          <Button v-if="!['SUSPENDED','BANNED'].includes(a.status)" size="sm" variant="ghost"
            class="h-7 w-7 p-0 text-orange-500/70 hover:text-orange-600" title="Marcar como basura" @click="mark(a.id, 'SUSPENDED')">
            <ShieldAlert class="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" class="h-7 w-7 p-0 text-destructive/70 hover:text-destructive" @click="remove(a.id)">
            <Trash2 class="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Dialog: generar código 2FA -->
    <Dialog v-model:open="show2faDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-lg font-black flex items-center gap-2"><ShieldCheck class="w-4 h-4 text-emerald-500" /> Código 2FA</DialogTitle>
          <DialogDescription class="text-xs">Pegá la clave (seed) de 2FA y te genera el código temporal. Se calcula en este equipo — la clave no se envía a ningún lado y se borra al cerrar.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3 py-2">
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clave / Seed (Base32)</Label>
            <Input v-model="seed2fa" placeholder="OF4E XXXX XXXX ..." class="h-9 text-xs font-mono" @keyup.enter="generate2fa" />
          </div>
          <Button size="sm" class="h-8 text-xs font-semibold gap-1.5" @click="generate2fa">
            <ShieldCheck class="w-3.5 h-3.5" /> Generar código
          </Button>
          <p v-if="error2fa" class="text-[11px] text-red-500">{{ error2fa }}</p>

          <div v-if="code2fa" class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col items-center gap-2">
            <p class="text-3xl font-black tracking-[0.3em] tabular-nums text-emerald-600 dark:text-emerald-400">{{ code2fa }}</p>
            <div class="flex items-center gap-2 w-full max-w-[200px]">
              <div class="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                <div class="h-full bg-emerald-500 transition-all" :style="{ width: (secondsLeft / 30 * 100) + '%' }" />
              </div>
              <span class="text-[10px] font-bold text-muted-foreground tabular-nums w-6 text-right">{{ secondsLeft }}s</span>
            </div>
            <Button size="sm" variant="outline" class="h-7 text-[11px] gap-1.5 mt-1" @click="copyText(code2fa, 'Código copiado')">
              <Copy class="w-3 h-3" /> Copiar código
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="show2faDialog = false" class="h-8 text-xs font-semibold">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: crear slot (proxy) -->
    <Dialog :open="showSlotDialog" @update:open="showSlotDialog = $event">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-lg font-black flex items-center gap-2"><Sparkles class="w-4 h-4 text-violet-500" /> Nuevo slot (proxy)</DialogTitle>
          <DialogDescription class="text-xs">Se genera el proxy ahora. Lo copiás a AdsPower, hacés tu warmup manual + cambio de @, y después enganchás el Instagram con ESE mismo proxy.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-3">
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">País del proxy</Label>
            <select v-model="slotForm.country" class="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="es">España (es)</option>
              <option value="us">USA (us)</option>
              <option value="mx">México (mx)</option>
              <option value="ar">Argentina (ar)</option>
              <option value="gb">UK (gb)</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etiqueta (opcional)</Label>
            <Input v-model="slotForm.handle" placeholder="ej: cuenta-britanny" class="h-9 text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showSlotDialog = false" :disabled="creatingSlot" class="h-8 text-xs font-semibold">Cancelar</Button>
          <Button size="sm" @click="handleCreateSlot" :disabled="creatingSlot" class="h-8 text-xs font-semibold gap-1.5">
            <Loader2 v-if="creatingSlot" class="w-3 h-3 animate-spin" /><Sparkles v-else class="w-3 h-3" /> Generar proxy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: enganchar Instagram -->
    <Dialog :open="showAttachDialog" @update:open="showAttachDialog = $event">
      <DialogContent class="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle class="text-lg font-black flex items-center gap-2"><Instagram class="w-4 h-4 text-pink-500" /> Enganchar Instagram</DialogTitle>
          <DialogDescription class="text-xs">Solo el paquete es obligatorio. Si la cuenta ya tiene el perfil hecho, elegí el estado para saltar el setup. Usa el proxy ya generado.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paquete (user:pass:seed:backup:email:emailpass) *</Label>
            <Textarea v-model="attachForm.bundle" placeholder="britanny...:britanny7834:OF4E...:0678... :mail@outlook.com:pass" class="min-h-[60px] text-xs font-mono resize-none" />
          </div>
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado inicial</Label>
            <select v-model="attachForm.status" class="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="IMPORTED">Nueva — hacer login, foto, bio y warmup automático</option>
              <option value="WARMING">Perfil ya hecho — solo calentar</option>
              <option value="READY">Perfil ya hecho y caliente — LISTA para publicar</option>
            </select>
            <p class="text-[10px] text-muted-foreground leading-snug">
              Con <b>WARMING</b> o <b>LISTA</b> se saltan foto y bio (la cuenta ya las tiene). La foto/descripción de abajo quedan opcionales.
            </p>
          </div>
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Foto de perfil <span class="text-muted-foreground/50 normal-case font-medium">(opcional)</span></Label>
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                <img v-if="attachPhotoPreview" :src="attachPhotoPreview" class="w-full h-full object-cover" />
                <ImageIcon v-else class="w-4 h-4 text-muted-foreground/40" />
              </div>
              <input type="file" accept="image/*" @change="onPhotoChange" class="text-xs" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1.5">
              <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</Label>
              <Input v-model="attachForm.fullName" placeholder="Britanny" class="h-9 text-xs" />
            </div>
            <div class="grid gap-1.5">
              <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Link (bio)</Label>
              <Input v-model="attachForm.externalUrl" placeholder="https://onlyfans.com/..." class="h-9 text-xs" />
            </div>
          </div>
          <div class="grid gap-1.5">
            <Label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descripción (bio) <span class="text-muted-foreground/50 normal-case font-medium">(opcional)</span></Label>
            <Textarea v-model="attachForm.bio" placeholder="Modelo · link abajo 🔥" class="min-h-[50px] text-xs resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showAttachDialog = false" :disabled="attaching" class="h-8 text-xs font-semibold">Cancelar</Button>
          <Button size="sm" @click="handleAttach" :disabled="attaching" class="h-8 text-xs font-semibold gap-1.5">
            <Loader2 v-if="attaching" class="w-3 h-3 animate-spin" /><Check v-else class="w-3 h-3" /> Enganchar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: auditoría -->
    <Dialog :open="showAuditDialog" @update:open="showAuditDialog = $event">
      <DialogContent class="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle class="text-base font-black flex items-center gap-2"><ScrollText class="w-4 h-4 text-primary" /> Auditoría — {{ auditAccount?.igUsername ? '@' + auditAccount.igUsername : auditAccount?.handle }}</DialogTitle>
          <DialogDescription class="text-xs">Todo lo que el sistema hizo sobre esta cuenta.</DialogDescription>
        </DialogHeader>
        <div v-if="loadingAudit" class="flex justify-center p-6"><Loader2 class="w-5 h-5 animate-spin text-primary" /></div>
        <div v-else-if="auditEvents.length === 0" class="text-center py-8 text-xs text-muted-foreground">Sin eventos todavía.</div>
        <div v-else class="max-h-[55vh] overflow-y-auto space-y-1.5 pr-1">
          <div v-for="ev in auditEvents" :key="ev.id"
            class="flex items-start gap-2.5 p-2.5 rounded-lg border text-xs"
            :class="ev.success ? 'border-border/50 bg-background' : 'border-red-500/20 bg-red-500/5'">
            <component :is="ev.success ? Check : X" class="w-3.5 h-3.5 mt-0.5 shrink-0" :class="ev.success ? 'text-emerald-500' : 'text-red-500'" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold uppercase text-[9px] tracking-wider text-muted-foreground">{{ ev.type }}</span>
                <span class="text-[9px] text-muted-foreground tabular-nums">{{ new Date(ev.createdAt).toLocaleString('es-AR') }}</span>
              </div>
              <p class="text-foreground/80 leading-snug mt-0.5">{{ ev.detail }}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showAuditDialog = false" class="h-8 text-xs font-semibold">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Configuración / credenciales de la cuenta -->
    <Dialog v-model:open="showConfigDialog">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-base font-black"><KeyRound class="w-4 h-4 text-primary" /> Configuración de la cuenta</DialogTitle>
          <DialogDescription>Ver, copiar y editar todo lo de esta cuenta. Si cambiaste algo en IG, actualizalo acá.</DialogDescription>
        </DialogHeader>

        <div v-if="loadingCfg" class="flex justify-center py-10"><Loader2 class="w-5 h-5 animate-spin text-primary" /></div>
        <div v-else class="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-1">
          <div class="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
            <code class="text-[10px] font-mono text-muted-foreground truncate flex-1">{{ cfg.bundle }}</code>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-[10px] shrink-0" @click="copyText(cfg.bundle, 'Paquete copiado')"><Copy class="w-3 h-3" /> Paquete</Button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">Usuario <button @click="copyText(cfg.igUsername, 'Usuario copiado')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button></Label>
              <Input v-model="cfg.igUsername" class="h-8 text-xs font-mono" />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">Contraseña <button @click="copyText(cfg.igPassword, 'Contraseña copiada')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button></Label>
              <Input v-model="cfg.igPassword" class="h-8 text-xs font-mono" />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">Email <button @click="copyText(cfg.email, 'Email copiado')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button></Label>
              <Input v-model="cfg.email" class="h-8 text-xs font-mono" />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">Pass del email <button @click="copyText(cfg.emailPassword, 'Copiado')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button></Label>
              <Input v-model="cfg.emailPassword" class="h-8 text-xs font-mono" />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">2FA seed
                <span class="flex items-center gap-1.5">
                  <button @click="open2fa(cfg.totpSeed)" class="text-emerald-600/70 hover:text-emerald-600" title="Generar código ahora"><ShieldCheck class="w-3 h-3" /></button>
                  <button @click="copyText(cfg.totpSeed, 'Seed copiado')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button>
                </span>
              </Label>
              <Input v-model="cfg.totpSeed" class="h-8 text-xs font-mono" />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">Backup codes <button @click="copyText(cfg.backupCodes, 'Copiado')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button></Label>
              <Input v-model="cfg.backupCodes" class="h-8 text-xs font-mono" />
            </div>
          </div>

          <div class="space-y-1">
            <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
              Proxy ({{ cfg.proxyCountry }})
              <button @click="copyText(toAdsPowerProxy(cfg.proxy), 'Proxy copiado para AdsPower')" class="text-muted-foreground/60 hover:text-primary"><Copy class="w-3 h-3" /></button>
            </Label>
            <Input v-model="cfg.proxy" class="h-8 text-[10px] font-mono" />
            <Button size="sm" variant="outline" class="h-7 px-2 text-[10px] gap-1.5 mt-1" :class="regenProxyConfirm ? 'text-red-500 border-red-500/40' : ''" :disabled="busyId === configAccount?.id" @click="handleRegenProxy">
              <RotateCcw class="w-3 h-3" /> {{ regenProxyConfirm ? '¿Seguro? Cambiar de IP puede levantar sospechas — tocá de nuevo' : 'Regenerar proxy' }}
            </Button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Nombre</Label>
              <Input v-model="cfg.fullName" class="h-8 text-xs" />
            </div>
            <div class="space-y-1">
              <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Link (bio)</Label>
              <Input v-model="cfg.externalUrl" class="h-8 text-xs" />
            </div>
          </div>
          <div class="space-y-1">
            <Label class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Bio</Label>
            <Textarea v-model="cfg.bio" rows="2" class="text-xs resize-none" />
          </div>
          <p class="text-[10px] text-muted-foreground">Esto edita los datos guardados. Para aplicar el link/bio/foto en el perfil real usá "Sitio web" o el flujo de setup.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showConfigDialog = false" :disabled="savingCfg" class="h-8 text-xs font-semibold">Cerrar</Button>
          <Button size="sm" @click="handleSaveConfig" :disabled="savingCfg || loadingCfg" class="h-8 text-xs font-semibold gap-1.5">
            <Loader2 v-if="savingCfg" class="w-3.5 h-3.5 animate-spin" /><Check v-else class="w-3.5 h-3.5" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Cambiar usuario de login -->
    <Dialog v-model:open="showUserDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-base font-black"><Pencil class="w-4 h-4 text-primary" /> Editar usuario de login</DialogTitle>
          <DialogDescription>
            Si cambiaste el @ de la cuenta en Instagram (por AdsPower), poné acá el <b>nuevo usuario</b> para que el login funcione.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5 py-2">
          <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Usuario (@)</Label>
          <Input v-model="newUsername" placeholder="nuevo_usuario" class="h-9 text-sm" @keyup.enter="handleSetUsername" />
          <p class="text-[10px] text-muted-foreground">Tip: si la cuenta tiene email cargado, igual puede loguear por email aunque el @ esté desactualizado.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showUserDialog = false" :disabled="savingUser" class="h-8 text-xs font-semibold">Cancelar</Button>
          <Button size="sm" @click="handleSetUsername" :disabled="savingUser || !newUsername.trim()" class="h-8 text-xs font-semibold gap-1.5">
            <Loader2 v-if="savingUser" class="w-3.5 h-3.5 animate-spin" /><Check v-else class="w-3.5 h-3.5" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Cambiar sitio web -->
    <Dialog v-model:open="showWebsiteDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-base font-black"><Globe class="w-4 h-4 text-primary" /> Cambiar sitio web</DialogTitle>
          <DialogDescription>
            Actualiza el link de la bio de <b>@{{ websiteAccount?.igUsername }}</b> por API (lo que IG bloquea en mobile).
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5 py-2">
          <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sitio web (URL)</Label>
          <Input v-model="websiteUrl" placeholder="https://onlyfans.com/..." class="h-9 text-sm" @keyup.enter="handleSetWebsite" />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showWebsiteDialog = false" :disabled="savingWebsite" class="h-8 text-xs font-semibold">Cancelar</Button>
          <Button size="sm" @click="handleSetWebsite" :disabled="savingWebsite || !websiteUrl.trim()" class="h-8 text-xs font-semibold gap-1.5">
            <Loader2 v-if="savingWebsite" class="w-3.5 h-3.5 animate-spin" /><Check v-else class="w-3.5 h-3.5" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
