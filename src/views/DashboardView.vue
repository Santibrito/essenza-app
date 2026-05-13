<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, defineAsyncComponent } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useOnboardingTour } from '@/composables/useOnboardingTour'

// UI Primitives
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogScrollContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Plus, X, Play, Zap } from 'lucide-vue-next'

// Modular Components - Lazy loaded for better performance
const DashboardSidebar = defineAsyncComponent(() => import('@/components/dashboard/DashboardSidebar.vue'))
const Topbar = defineAsyncComponent(() => import('@/components/dashboard/Topbar.vue'))
const TrackerCard = defineAsyncComponent(() => import('@/components/dashboard/TrackerCard.vue'))
const StatsCards = defineAsyncComponent(() => import('@/components/dashboard/StatsCards.vue'))
const NotesCard = defineAsyncComponent(() => import('@/components/dashboard/NotesCard.vue'))
const AnnouncementsBanner = defineAsyncComponent(() => import('@/components/dashboard/AnnouncementsBanner.vue'))
const ModelHandoffCard = defineAsyncComponent(() => import('@/components/dashboard/ModelHandoffCard.vue'))
const MarketingPanel = defineAsyncComponent(() => import('@/components/dashboard/MarketingPanel.vue'))
const CreativityWall = defineAsyncComponent(() => import('@/components/dashboard/CreativityWall.vue'))
const LeadsKanban = defineAsyncComponent(() => import('@/components/dashboard/LeadsKanban.vue'))
const UserShiftHistory = defineAsyncComponent(() => import('@/components/dashboard/UserShiftHistory.vue'))
const ModelReportsSection = defineAsyncComponent(() => import('@/components/dashboard/ModelReportsSection.vue'))
const ModelKnowledgeBase = defineAsyncComponent(() => import('@/components/dashboard/ModelKnowledgeBase.vue'))
const CustomsList = defineAsyncComponent(() => import('@/components/customs/CustomsList.vue'))
const CreateCustomModal = defineAsyncComponent(() => import('@/components/customs/CreateCustomModal.vue'))
const ContentManagerKanban = defineAsyncComponent(() => import('@/components/customs/ContentManagerKanban.vue'))
const ShiftModelReport = defineAsyncComponent(() => import('@/components/dashboard/ShiftModelReport.vue'))
import { useCustomsNotifications } from '@/lib/useCustomsNotifications'

// Types
interface AssignedModel { id: number; name: string; alias?: string }
interface HistoryEntry {
  id: number; createdAt: string; type: string
  observations: string; earnings: number; growthPercentage: number
}
interface ModelExitReport {
  modelId: number
  modelName: string
  observations: string        // general notes about the shift with this model
  contentItems: string[]      // sold content tags e.g. ['mixto', 'foto en 4']
  spenders: { name: string; username: string; amount: string }[]
}

interface ModelReport {
  observations: string
  contentItems: string[]
  spenders: { name: string; username: string; amount: string }[]
}

const auth = useAuthStore()
const router = useRouter()
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
const { startTour, hasCompletedTour, markAsCompleted } = useOnboardingTour((tab) => {
  activeTab.value = tab
}, auth.user?.role)

function startTourManually() {
  startTour()
}

// --- State ---
const isWorking = ref(false)
const isPaused = ref(false)
const isAfk = ref(false)
const workTime = ref(0)
const breakTime = ref(0)
const idleTime = ref(0)
const currentShiftId = ref<number | null>(null)
const isExtraHours = ref(false)
const isExtraHoursSelection = ref(false)

const showStartModal = ref(false)
const showReportModal = ref(false)
const errorDialog = ref<{ show: boolean; message: string }>({ show: false, message: "" })

const userSchedule = ref<any>(null)
const userOffDays = ref('')
const shiftTarget = ref<number>(0)
const assignedModels = ref<AssignedModel[]>([])
const modelsHistory = ref<Record<number, HistoryEntry[]>>({})
const activeTab = ref<'tracker' | 'history' | 'crm' | 'creative' | 'context' | 'customs'>('tracker')
const showCreateCustom = ref(false)
const customsNotifications = useCustomsNotifications(() => assignedModels.value.map((m: any) => m.id))
const sidebarOpen = ref(false)

const startEarnings = ref(0)
const startEarningsMessages = ref(0)
const startEarningsTips = ref(0)
const startEarningsPosts = ref(0)
const startGrowthPercentage = ref(0)

// Marketing-specific start values
const startReelsEdited = ref(0)
const startPostsCreated = ref(0)
const startIdeasGenerated = ref(0)

const observations = ref('')
const isForceExit = ref(false)
const emergencyReason = ref('')

const perModelReports = ref<ModelExitReport[]>([])
const selectedModelReportIdx = ref(0)
const shiftTemplates = ref<any[]>([])
const isSubmittingEndShift = ref(false)
const modelReports = ref<Record<number, ModelReport>>({})
const dailySummary = ref<any>(null)
const shiftStartTime = ref<string | null>(null)

// ── persistence ───────────────────────────────────────────────
import { watch as vWatch } from 'vue'
const modelReportsKey = () => `essenza_model_reports`
const observationsKey = () => `essenza_observations`

function restoreModelReports() {
  try {
    const saved = localStorage.getItem(modelReportsKey())
    if (saved) modelReports.value = JSON.parse(saved)
  } catch { /* ignore malformed data */ }
}

function restoreObservations() {
  try {
    const saved = localStorage.getItem(observationsKey())
    if (saved) observations.value = saved
  } catch { }
}

vWatch(modelReports, (val) => {
  try { localStorage.setItem(modelReportsKey(), JSON.stringify(val)) } catch { }
}, { deep: true })

vWatch(observations, (val) => {
  try { localStorage.setItem(observationsKey(), val) } catch { }
})
const userAllSchedules = ref<any[]>([])

// --- Computed ---
const isMarketing = computed(() => auth.user?.role === 'ROLE_MARKETING')
const isContentManager = computed(() => auth.user?.role === 'ROLE_MANAGER' || auth.user?.role === 'ROLE_CONTENT_MANAGER')
const SHIFT_TARGET = computed(() => {
  // 1. Prioridad: Lo que diga el turno actual (si ya inició)
  if (shiftTarget.value) return shiftTarget.value
  // 2. Perfil del usuario (lo que configuró el admin)
  if (auth.user?.shiftTargetSeconds) return auth.user.shiftTargetSeconds
  // 3. Fallback absoluto (8h)
  return 28800
})
const effectiveWorkSeconds = computed(() => Math.max(0, workTime.value - idleTime.value))
const totalTodayAccumulated = computed(() => {
  const previousSeconds = dailySummary.value?.todayActiveSeconds || 0
  return previousSeconds + effectiveWorkSeconds.value
})

const missingShiftSeconds = computed(() => {
  if (isExtraHours.value) return 0
  return Math.max(0, SHIFT_TARGET.value - totalTodayAccumulated.value)
})

const shiftCompliancePercent = computed(() =>
  Math.min(100, Math.round((totalTodayAccumulated.value / SHIFT_TARGET.value) * 100))
)
const statusLabel = computed(() => {
  if (!isWorking.value) return 'Offline'
  if (isPaused.value) return 'En Pausa'
  if (isExtraHours.value) return 'Horas Extras'
  return 'En Turno'
})

const hasHoursDebt = computed(() => (dailySummary.value?.todayActiveSeconds || 0) < SHIFT_TARGET.value)
const debtMinutes = computed(() => Math.max(0, Math.floor((SHIFT_TARGET.value - (dailySummary.value?.todayActiveSeconds || 0)) / 60)))
const statusColor = computed(() => {
  if (!isWorking.value) return 'bg-zinc-500'
  if (isPaused.value) return 'bg-amber-500'
  if (isAfk.value) return 'bg-orange-500'
  return 'bg-emerald-500'
})
const statusDot = computed(() => statusColor.value)

const dayTranslations: Record<string, string> = {
  'MONDAY': 'Lun', 'TUESDAY': 'Mar', 'WEDNESDAY': 'Mié', 'THURSDAY': 'Jue',
  'FRIDAY': 'Vie', 'SATURDAY': 'Sáb', 'SUNDAY': 'Dom'
}
const allDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

const offDaysArray = computed(() => {
  const scheduledDays = userAllSchedules.value.map(s => s.dayOfWeek)
  if (scheduledDays.length === 0) return [] // Si no hay agenda cargada, no mostramos nada para evitar ruidos
  return allDays.filter(day => !scheduledDays.includes(day)).map(day => dayTranslations[day])
})

const isWithinSchedule = computed(() => {
  if (!userSchedule.value?.template) return true // Si no hay horario cargado, permitimos
  const { startTime, endTime } = userSchedule.value.template
  if (!startTime || !endTime) return true

  const now = new Date()
  const currentTz = userSchedule.value.timezone || auth.user?.timezone || 'America/Argentina/Buenos_Aires'

  // Convert current time to the configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: currentTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const parts = formatter.formatToParts(now)
  const hour = parts.find(p => p.type === 'hour')?.value || '00'
  const minute = parts.find(p => p.type === 'minute')?.value || '00'
  const currentTimeStr = `${hour}:${minute}`

  return currentTimeStr >= startTime.slice(0, 5) && currentTimeStr <= endTime.slice(0, 5)
})

// --- Fetch Templates ---
async function fetchTemplates() {
  // TODO: Backend endpoint not implemented yet
  // try {
  //   const res = await api.get('/shifts/templates/batch')
  //   shiftTemplates.value = res.data || []
  // } catch (e) {
  //   console.error('Error fetching templates:', e)
  // }
}

async function fetchUserAllSchedules() {
  if (!auth.user?.id) return
  try {
    const res = await api.get(`/admin/users/schedule/user/${auth.user.id}`)
    userAllSchedules.value = res.data || []
  } catch (e) { console.error('Error fetching schedules:', e) }
}

async function fetchDailySummary() {
  try {
    const res = await api.get('/shifts/daily-summary')
    dailySummary.value = res.data
  } catch (e) { console.error('Error fetching daily summary:', e) }
}

const formatMetaLabel = (secs: number) => {
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
let timerInterval: any = null
let breakInterval: any = null
let pollingInterval: any = null
let syncInterval: any = null
let autoScreenshotInterval: any = null
let healthCheckInterval: any = null
let isSyncing = false
let isPolling = false
let isCapturing = false
let hasNotifiedTargetReached = false
let isServerDown = ref(false)
let consecutiveFailures = ref(0)

// System capabilities - adjusted based on hardware
let systemCapabilities = ref<any>(null)
let screenshotInterval = ref(6 * 60 * 1000) // Default 6 minutes
let syncIntervalMs = ref(10000) // Default 10 seconds
let screenshotQuality = ref(0.5) // Default quality
let screenshotMaxWidth = ref(800)
let screenshotMaxHeight = ref(450)

const authHeaders = () => ({
  'Authorization': `Bearer ${auth.user?.token}`,
  'Content-Type': 'application/json'
})

function startWorkTimer() {
  if (timerInterval) clearInterval(timerInterval)
  let lastTick = Date.now()
  timerInterval = setInterval(() => {
    if (!isWorking.value || isPaused.value) { if (timerInterval) clearInterval(timerInterval); return }
    const now = Date.now()
    const delta = Math.floor((now - lastTick) / 1000)
    if (delta >= 1) {
      workTime.value += delta
      if (isAfk.value) idleTime.value += delta
      lastTick = now - ((now - lastTick) % 1000)
      window.electronAPI?.shift?.syncTime(workTime.value)
      if (!hasNotifiedTargetReached && !isExtraHours.value && workTime.value >= SHIFT_TARGET.value) {
        hasNotifiedTargetReached = true
        isPaused.value = true
        if (timerInterval) clearInterval(timerInterval)
        toast.success('¡Meta Diaria Alcanzada! 🎉', { duration: 10000, description: 'Completá el reporte para continuar o finalizar.' })
        initModelReports()
        showReportModal.value = true
        window.electronAPI.sendNotification?.({ title: '¡Meta Alcanzada!', body: 'La sesión se pausó. Completá el reporte obligatorio.' })
      }
    }
  }, 1000)
}

// --- Shift Actions ---
async function startShift(isExtra = false) {
  // Regla: Si está fuera de horario, solo permitimos inicio regular si todavía debe horas del día (deuda).
  // Si ya cumplió su meta, debe entrar obligatoriamente como Horas Extras.
  if (!isExtra && !isWithinSchedule.value) {
    if (!hasHoursDebt.value) {
      toast.error('Jornada Completada', {
        description: `Ya cumpliste tu meta de ${formatMetaLabel(SHIFT_TARGET.value)}. Para seguir trabajando fuera de tu horario (${userSchedule.value?.template?.startTime?.slice(0, 5)} - ${userSchedule.value?.template?.endTime?.slice(0, 5)}), debés iniciar como "Horas Extras".`,
        duration: 8000
      })
      return
    } else {
      // Tiene deuda, le avisamos que está "pagando" horas fuera de término
      toast.info('Completando Jornada', {
        description: `Estás fuera de tu horario asignado, pero se te permite iniciar para completar tus ${debtMinutes.value} min restantes de hoy.`,
        duration: 5000
      })
    }
  }

  try {
    // CRITICAL: Validate token before starting shift
    if (!auth.user?.token) {
      toast.error('Error de Autenticación', {
        description: 'No se encontró tu sesión. Por favor, cerrá sesión y volvé a entrar.',
        duration: 10000
      })
      return
    }

    const endpoint = isExtra ? `${apiUrl}/shifts/start-extra` : `${apiUrl}/shifts/start`
    
    // Different body for Marketing vs Chatter
    const body = isMarketing.value ? {
      initialReelsEdited: startReelsEdited.value,
      initialPostsCreated: startPostsCreated.value,
      initialIdeasGenerated: startIdeasGenerated.value
    } : {
      initialEarnings: startEarnings.value, 
      initialEarningsMessages: startEarningsMessages.value,
      initialEarningsTips: startEarningsTips.value, 
      initialEarningsPosts: startEarningsPosts.value,
      initialGrowthPercentage: startGrowthPercentage.value
    }
    
    const res = await fetch(endpoint, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
    
    // CRITICAL: Check response status BEFORE parsing
    if (!res.ok) {
      const errorText = await res.text()
      let errorMessage = 'Error al iniciar turno'
      
      if (res.status === 401 || res.status === 403) {
        errorMessage = 'Tu sesión expiró. Cerrá sesión y volvé a entrar.'
      } else if (res.status === 500) {
        errorMessage = 'Error del servidor. Intentá de nuevo en unos segundos.'
      }
      
      console.error('Shift start failed:', res.status, errorText)
      toast.error('No se pudo iniciar el turno', {
        description: errorMessage,
        duration: 10000
      })
      return
    }
    
    const data = await res.json()
    
    // CRITICAL: Validate response has shift ID
    if (!data || !data.id) {
      console.error('Invalid shift response:', data)
      toast.error('Error al iniciar turno', {
        description: 'El servidor no devolvió un turno válido. Intentá de nuevo.',
        duration: 10000
      })
      return
    }
    
    currentShiftId.value = data.id
    // Save shift ID to localStorage for recovery after app restart
    localStorage.setItem('currentShiftId', data.id.toString())
    localStorage.setItem('shiftStartTime', Date.now().toString())
    
    // CRITICAL: Verify shift was created by fetching current shift
    try {
      const verifyRes = await fetch(`${apiUrl}/shifts/current`, { headers: authHeaders() })
      if (verifyRes.ok) {
        const currentShift = await verifyRes.json()
        if (!currentShift || currentShift.id !== data.id) {
          throw new Error('Shift ID mismatch')
        }
      } else {
        throw new Error('Cannot verify shift')
      }
    } catch (verifyError) {
      console.error('Shift verification failed:', verifyError)
      toast.warning('Turno iniciado pero no se pudo verificar', {
        description: 'Si tenés problemas al cerrar, cerrá sesión y volvé a entrar.',
        duration: 8000
      })
    }
    
    workTime.value = 0; idleTime.value = 0
    isWorking.value = true; isPaused.value = false; isExtraHours.value = isExtra
    hasNotifiedTargetReached = false
    startWorkTimer(); startPolling(); startSync(); startAutoScreenshot(); startHealthCheck()
    window.electronAPI?.shift?.started({ apiUrl, token: auth.user?.token, shiftId: data.id })
    toast.success(isExtra ? 'Horas extras iniciadas' : 'Turno iniciado correctamente', {
      description: `ID del turno: ${data.id}`,
      duration: 3000
    })
    showStartModal.value = false
  } catch (e) { 
    console.error('Shift start error:', e)
    toast.error('Error al iniciar el turno', {
      description: 'Verificá tu conexión a internet y volvé a intentar. Si el problema persiste, cerrá sesión y volvé a entrar.',
      duration: 10000
    })
  }
}

let clickCount = 0
let clickTimeout: any = null
async function endShiftPrompt() {
  if (isExtraHours.value || missingShiftSeconds.value <= 0) {
    isForceExit.value = false; initModelReports(); showReportModal.value = true; return
  }
  clickCount++
  if (clickCount >= 2) {
    isForceExit.value = true; initModelReports(); showReportModal.value = true
    clickCount = 0; if (clickTimeout) clearTimeout(clickTimeout); return
  }
  toast.warning('Jornada incompleta', { duration: 5000, description: `Faltan ${formatTime(missingShiftSeconds.value)}. Hacé clic otra vez para forzar el cierre.` })
  if (clickTimeout) clearTimeout(clickTimeout)
  clickTimeout = setTimeout(() => { clickCount = 0 }, 5000)
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function submitEndShift(startExtras: boolean) {
  // Prevent multiple simultaneous submissions
  if (isSubmittingEndShift.value) {
    return
  }
  
  isSubmittingEndShift.value = true
  
  try {
    let payload: any = {}
    const finalObs = isForceExit.value
      ? `[CIERRE FORZADO] Razón: ${emergencyReason.value}. ${observations.value ? '\nNotas: ' + observations.value : ''}`
      : observations.value

    // Build model reports from modelReports (from dashboard)
    const filteredReports = assignedModels.value
      .map(m => {
        const report = modelReports.value[m.id]
        if (!report) return null

        const hasContent = report.handoffNotes ||
          (report.contentItems && report.contentItems.length > 0) ||
          (report.spenders && report.spenders.some(s => s.name || s.username || s.amount))

        if (!hasContent) return null

        return {
          modelId: m.id,
          modelName: m.name,
          handoffNotes: report.handoffNotes || '',
          contentItems: report.contentItems || [],
          spenders: report.spenders || []
        }
      })
      .filter(r => r !== null)

    payload = {
      earnings: startEarnings.value, earningsMessages: startEarningsMessages.value,
      earningsTips: startEarningsTips.value, earningsPosts: startEarningsPosts.value,
      growthPercentage: startGrowthPercentage.value, observations: finalObs, force: isForceExit.value,
      modelReports: filteredReports.map(r => ({
        modelId: r.modelId,
        modelName: r.modelName,
        soldContentJson: JSON.stringify(r.contentItems),
        spendersJson: JSON.stringify(r.spenders.filter(s => s.name || s.username || s.amount))
      }))
    }

    const res = await fetch(`${apiUrl}/shifts/${currentShiftId.value}/end`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
    if (res.status === 412) { const e = await res.json(); toast.error(e.message || 'El turno está incompleto.'); showReportModal.value = false; return }
    if (!res.ok) { const errBody = await res.json().catch(() => null); throw new Error(errBody?.message || errBody?.error || ("HTTP " + res.status)) }

    // Save to logbook for handoff view
    if (filteredReports.length > 0) {
      const logbookEntries = filteredReports.map(r => ({
        ofModelId: r.modelId,
        shiftId: currentShiftId.value,
        message: r.handoffNotes || '',
        soldContentJson: JSON.stringify(r.contentItems),
        spendersJson: JSON.stringify(r.spenders.filter(s => s.name || s.username || s.amount))
      }))
      await fetch(`${apiUrl}/admin/models/logbook/batch`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(logbookEntries) }).catch(console.error)
    }

    resetState()
    fetchDailySummary()
    window.electronAPI?.shift?.stopped()
    showReportModal.value = false

    if (startExtras) { toast.info('Turno cerrado. Iniciando extras...'); setTimeout(() => startShift(true), 1200) }
    else { toast.success('Turno finalizado correctamente.'); currentShiftId.value = null }
  } catch (e: any) { 
    console.error(e); 
    errorDialog.value = { show: true, message: e?.message || String(e) } 
  } finally {
    // Always reset the submission state, even if there was an error
    isSubmittingEndShift.value = false
  }
}

async function toggleBreak() {
  if (!isWorking.value) return
  isPaused.value = !isPaused.value
  if (isPaused.value) {
    await fetch(`${apiUrl}/shifts/${currentShiftId.value}/pause`, { method: 'POST', headers: authHeaders() })
    if (timerInterval) clearInterval(timerInterval)
    breakInterval = setInterval(() => breakTime.value++, 1000)
    window.electronAPI?.shift?.paused(); toast.info('Break iniciado')
  } else {
    await fetch(`${apiUrl}/shifts/${currentShiftId.value}/resume`, { method: 'POST', headers: authHeaders() })
    if (breakInterval) clearInterval(breakInterval)
    startWorkTimer(); window.electronAPI?.shift?.resumed(); toast.success('Break finalizado — ¡A trabajar!')
  }
}

// --- Services ---
function startSync() {
  if (syncInterval) clearTimeout(syncInterval)
  const runner = async () => {
    if (!isWorking.value || isSyncing) return
    isSyncing = true
    try {
      if (window.electronAPI?.screen) {
        const afkSecs = await window.electronAPI.screen.getIdleTime()
        if (afkSecs > 60 && !isAfk.value) isAfk.value = true
        else if (afkSecs < 10 && isAfk.value) isAfk.value = false
        const activeApp = await window.electronAPI.screen.getActiveWindowName()
        await fetch(`${apiUrl}/shifts/${currentShiftId.value}/sync-app`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ activeApp, idleTimeSeconds: idleTime.value, activeTimeSeconds: workTime.value, breakTimeSeconds: breakTime.value, isAfk: isAfk.value }) })
      }
    } catch (err) { }
    finally { isSyncing = false; if (isWorking.value) syncInterval = setTimeout(runner, 5000) }
  }
  runner()
}

async function captureAndUpload() {
  if (!isWorking.value || !currentShiftId.value || isCapturing) return
  isCapturing = true
  try {
    if (window.electronAPI?.screen) {
      const screensRaw = await window.electronAPI.screen.takeScreenshot({
        quality: screenshotQuality.value,
        maxWidth: screenshotMaxWidth.value,
        maxHeight: screenshotMaxHeight.value
      })
      if (screensRaw?.length > 0) {
        await fetch(`${apiUrl}/shifts/${currentShiftId.value}/upload-screenshot`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ image: JSON.stringify(screensRaw.map((s: any) => s.image)) })
        })
      }
    }
  } catch (err) { 
    console.error('Capture error:', err)
    // Don't crash the app if screenshot fails - just log and continue
  }
  finally { isCapturing = false }
}

function startAutoScreenshot() {
  if (autoScreenshotInterval) clearTimeout(autoScreenshotInterval)
  const runner = async () => {
    // Don't capture if paused (break) or not working
    if (!isWorking.value || isPaused.value) return
    await captureAndUpload()
    // Only schedule next capture if still working and not paused
    if (isWorking.value && !isPaused.value) autoScreenshotInterval = setTimeout(runner, screenshotInterval.value)
  }
  setTimeout(runner, 1000)
}

function startPolling() {
  if (pollingInterval) clearTimeout(pollingInterval)
  const runner = async () => {
    if (!isWorking.value || isPolling) return
    isPolling = true
    try {
      const res = await fetch(`${apiUrl}/shifts/current`, { headers: authHeaders() })
      
      // Reset server down state on successful response
      if (isServerDown.value) {
        isServerDown.value = false
        consecutiveFailures.value = 0
        toast.success('Conexión restablecida', { description: 'La conexión con el servidor se ha recuperado.' })
      }
      
      if (res.status === 204) {
        try {
          if (currentShiftId.value) {
            const evRes = await fetch(`${apiUrl}/shifts/${currentShiftId.value}/events`, { headers: authHeaders() })
            if (evRes.ok) {
              const events = await evRes.json()
              const forceEndEvent = events.find((e: any) => e.eventType === 'FORCE_END')
              if (forceEndEvent && forceEndEvent.detail) {
                toast.error(`Cierre Forzado: ${forceEndEvent.detail}`, { duration: 15000 })
                window.electronAPI?.sendNotification?.({ title: 'Turno Terminado', body: forceEndEvent.detail })
                resetState()
                return
              }
            }
          }
        } catch {}
        toast.error('Sesión terminada por el administrador', { duration: 10000 })
        resetState()
        return
      }
      const data = await res.json()

      // 1. Mensajes pendientes
      if (data?.pendingMessage) {
        toast.info('Mensaje de Administración', { description: data.pendingMessage, duration: 10000 })
        window.electronAPI?.sendNotification?.({ title: 'Notificación', body: data.pendingMessage })
        fetch(`${apiUrl}/shifts/${currentShiftId.value}/clear-message`, { method: 'POST', headers: authHeaders() }).catch(console.error)
      }

      // 2. Captura manual solicitada por Admin
      if (data?.screenshotRequested) {
        console.log('📸 Screenshot requested by admin, capturing...')
        captureAndUpload()
      }
    } catch (err) {
      consecutiveFailures.value++
      if (consecutiveFailures.value >= 3 && !isServerDown.value) {
        isServerDown.value = true
        toast.error('Conexión perdida', { 
          description: 'No se puede conectar con el servidor. Verificá tu conexión a internet.', 
          duration: 10000 
        })
        window.electronAPI?.sendNotification?.({ 
          title: 'Conexión Perdida', 
          body: 'No se puede conectar con el servidor. El turno se pausará hasta recuperar la conexión.' 
        })
      }
    }
    finally { isPolling = false; if (isWorking.value) pollingInterval = setTimeout(runner, 10000) }
  }
  runner()
}

// Health check - verifica cada 30 segundos que el servidor responde
function startHealthCheck() {
  if (healthCheckInterval) clearInterval(healthCheckInterval)
  healthCheckInterval = setInterval(async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const res = await fetch(`${apiUrl}/health`, { 
        headers: authHeaders(),
        signal: controller.signal 
      })
      
      clearTimeout(timeoutId)
      
      if (res.ok) {
        if (isServerDown.value) {
          isServerDown.value = false
          consecutiveFailures.value = 0
          toast.success('Conexión restablecida', { description: 'La conexión con el servidor se ha recuperado.' })
        }
      } else {
        throw new Error('Health check failed')
      }
    } catch (err) {
      consecutiveFailures.value++
      if (consecutiveFailures.value >= 2 && !isServerDown.value) {
        isServerDown.value = true
        toast.error('Conexión perdida', { 
          description: 'No se puede conectar con el servidor. Verificá tu conexión a internet.', 
          duration: 10000 
        })
      }
    }
  }, 30000) // Check every 30 seconds
}

// --- Handlers ---
function initModelReports() {
  selectedModelReportIdx.value = 0
  perModelReports.value = assignedModels.value.map(m => {
    const saved = modelReports.value[m.id] || { observations: '', contentItems: [], spenders: [{ name: '', username: '', amount: '' }] }
    return {
      modelId: m.id,
      modelName: m.name,
      observations: saved.observations || '',
      contentItems: saved.contentItems?.length ? [...saved.contentItems] : [],
      spenders: saved.spenders?.length ? [...saved.spenders] : [{ name: '', username: '', amount: '' }],
    }
  })
}


function resetState() {
  showReportModal.value = false; currentShiftId.value = null
  isWorking.value = false; isPaused.value = false
  workTime.value = 0; breakTime.value = 0; idleTime.value = 0; observations.value = ''
  // Clear persisted report data since the shift is now submitted
  modelReports.value = {}
  try { 
    localStorage.removeItem(modelReportsKey()) 
    localStorage.removeItem(observationsKey())
    // Clear shift ID from localStorage
    localStorage.removeItem('currentShiftId')
    localStorage.removeItem('shiftStartTime')
  } catch { }
  clearAllTimers()
}

function clearAllTimers() {
  if (timerInterval) clearInterval(timerInterval)
  if (breakInterval) clearInterval(breakInterval)
  if (pollingInterval) clearTimeout(pollingInterval)
  if (syncInterval) clearTimeout(syncInterval)
  if (autoScreenshotInterval) clearTimeout(autoScreenshotInterval)
  if (healthCheckInterval) clearInterval(healthCheckInterval)
}

const handoffData = ref<Record<number, any[]>>({})
async function loadHandoff() {
  if (!assignedModels.value.length) return
  try {
    const ids = assignedModels.value.map(m => m.id).join(',')
    const res = await fetch(`${apiUrl}/admin/models/handoff?modelIds=${ids}`, { headers: authHeaders() })
    if (res.ok) handoffData.value = await res.json()
  } catch { }
}

onMounted(async () => {
  // CRITICAL: Validate authentication before doing anything
  if (!auth.user?.token) {
    toast.error('No hay sesión activa', {
      description: 'Por favor, iniciá sesión para continuar.',
      duration: 5000
    })
    return
  }

  // Health check in background - don't await, don't block data loading
  fetch(`${apiUrl}/admin/users/me`, { 
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000)
  }).then(healthCheck => {
    if (!healthCheck.ok && (healthCheck.status === 401 || healthCheck.status === 403)) {
      console.warn('Token validation failed')
      toast.warning('Posible problema de sesión', {
        description: 'Si tenés problemas al iniciar turno, cerrá sesión y volvé a entrar.',
        duration: 8000
      })
    }
  }).catch(err => {
    console.error('Health check failed:', err)
  })

  // Detect system capabilities and adjust intervals for low-end hardware
  if (window.electronAPI?.screen?.getSystemCapabilities) {
    try {
      systemCapabilities.value = await window.electronAPI.screen.getSystemCapabilities()
      console.log('[System] Capabilities detected:', systemCapabilities.value)
      
      if (systemCapabilities.value.isLowEnd) {
        console.log('[System] Low-end hardware detected - applying optimizations')
        screenshotInterval.value = systemCapabilities.value.recommendedScreenshotInterval
        syncIntervalMs.value = systemCapabilities.value.recommendedSyncInterval
        screenshotQuality.value = systemCapabilities.value.screenshotQuality
        screenshotMaxWidth.value = systemCapabilities.value.maxScreenshotWidth
        screenshotMaxHeight.value = systemCapabilities.value.maxScreenshotHeight
        
        toast.info(`Sistema optimizado para ${systemCapabilities.value.totalRAM}GB RAM`, {
          description: 'Capturas cada 10 minutos para mejor rendimiento'
        })
      }
    } catch (err) {
      console.error('[System] Failed to detect capabilities:', err)
    }
  }
  
  auth.refreshUserProfile()
  fetchTemplates()
  fetchUserAllSchedules()
  fetchDailySummary()
  // Restore in-progress report data from previous session
  restoreModelReports()
  restoreObservations()
  // Initial data load
  try {
    const res = await fetch(`${apiUrl}/shifts/current`, { headers: authHeaders() })
    if (res.status === 200) {
      const data = await res.json()
      if (data && data.status !== 'COMPLETED') {
        currentShiftId.value = data.id; workTime.value = data.activeTimeSeconds || 0
        // Save to localStorage for recovery
        localStorage.setItem('currentShiftId', data.id.toString())
        if (data.targetSeconds) shiftTarget.value = data.targetSeconds
        isWorking.value = true; isPaused.value = data.status === 'PAUSED'
        if (!isPaused.value) startWorkTimer()
        startPolling(); startSync(); startAutoScreenshot(); startHealthCheck()
      }
    } else if (res.status === 401 || res.status === 403) {
      // Token expired or invalid - try to recover from localStorage
      const savedShiftId = localStorage.getItem('currentShiftId')
      if (savedShiftId) {
        toast.error('Sesión expirada', {
          description: 'Tu sesión ha expirado. Por favor, cerrá sesión y volvé a entrar para recuperar tu turno.',
          duration: 10000
        })
      }
    }
  } catch { }

  try {
    const sRes = await fetch(`${apiUrl}/admin/users/schedule/current`, { headers: authHeaders() })
    if (sRes.ok) {
      userSchedule.value = await sRes.json()
      const models = userSchedule.value.assignedModels || []
      assignedModels.value = models.sort((a: any, b: any) => a.name.localeCompare(b.name))
      
      // Only load handoff for Chatters (they see ModelReportsSection)
      if (!isContentManager.value && !isMarketing.value) {
        await loadHandoff()
      }
      
      // Start customs notifications polling (only for Chatters and Managers, not Marketing)
      if (!isMarketing.value) {
        customsNotifications.start()
      }
    }
  } catch { }
})

onUnmounted(() => {
  clearAllTimers()
})
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="h-full flex bg-background text-foreground overflow-hidden font-sans select-none">

      <!-- Modular Sidebar -->
      <DashboardSidebar v-model:activeTab="activeTab" v-model:open="sidebarOpen" :is-marketing="isMarketing"
        :is-content-manager="isContentManager"
        :pending-customs-count="customsNotifications.pendingCount.value"
        :off-days="offDaysArray" @logout="auth.logout(); router.push({ name: 'login' })" />

      <main class="flex-1 flex flex-col min-w-0 relative overflow-hidden transition-colors duration-300 ">

        <!-- Modular Topbar -->
        <Topbar :active-tab="activeTab" :is-working="isWorking" :is-paused="isPaused" :status-label="statusLabel"
          :status-color="statusColor" :shift-target="missingShiftSeconds" :is-server-down="isServerDown" @toggle-sidebar="sidebarOpen = !sidebarOpen"
          @start-shift="isExtraHoursSelection = $event; showStartModal = true" @toggle-break="toggleBreak"
          @end-shift="endShiftPrompt" @start-tour="startTourManually" />
        
        <div
          :class="['flex-1 bg-muted/30 dark:bg-zinc-950 relative', activeTab === 'context' ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700']">
          <!-- Textura de grilla sutil -->
          <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-[0.03] z-0" viewBox="0 0 400 400"
            preserveAspectRatio="none">
            <defs>
              <pattern id="dashboard-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-width="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dashboard-grid)" class="text-foreground" />
          </svg>

          <div
            :class="[activeTab === 'context' ? 'max-w-none !p-0 h-full flex flex-col' : 'max-w-[1400px] p-4 lg:p-8 space-y-8 min-h-full', 'mx-auto relative z-10 transition-all']">
            <AnnouncementsBanner />

            <!-- Case: TRACKER -->
            <template v-if="activeTab === 'tracker'">
              <!-- Modular Stats Overview -->
              <StatsCards :shift-compliance-percent="shiftCompliancePercent" :work-time="workTime" :idle-time="idleTime"
                :break-time="breakTime" :daily-summary="dailySummary" />

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Modular Tracker/Timer Card -->
                <TrackerCard 
                  data-tour="shift-status"
                  :effective-work-seconds="effectiveWorkSeconds" 
                  :is-working="isWorking"
                  :is-paused="isPaused" 
                  :status-label="statusLabel" 
                  :status-dot="statusDot"
                  :shift-start-time="shiftStartTime ?? undefined" 
                  :daily-summary="dailySummary ?? undefined"
                  :schedule-info="userSchedule ?? undefined" 
                  :is-within-schedule="isWithinSchedule"
                  @toggle-break="toggleBreak" 
                  @start-shift="isExtraHoursSelection = $event; showStartModal = true"
                  @end-shift="endShiftPrompt" 
                />

                <!-- Modular Notes/Observations Card -->
                <NotesCard 
                  data-tour="logbook"
                  v-model="observations" 
                />
              </div>

              <!-- Model Reports Section — only for Chatters (not Marketing, not Content Manager) -->
              <ModelReportsSection 
                data-tour="models-tabs"
                v-if="!isContentManager && !isMarketing" 
                v-model:model-reports="modelReports" 
                :assigned-models="assignedModels"
                :is-working="isWorking"
              />
            </template>

            <template v-else-if="activeTab === 'context'">
              <div class="w-full h-full flex flex-col">
                <ModelKnowledgeBase data-tour="knowledge-base" :assigned-models="assignedModels" />
              </div>
            </template>

            <!-- Case: CRM / MARKETING -->
            <template v-else-if="activeTab === 'crm'">
              <LeadsKanban />
            </template>

            <!-- Case: CREATIVIDAD -->
            <template v-else-if="activeTab === 'creative'">
              <CreativityWall />
            </template>

            <!-- Case: HISTORY -->
            <template v-else-if="activeTab === 'history'">
              <!-- Content Manager sees only CREATED customs (pending to process) -->
              <CustomsList 
                v-if="isContentManager"
                data-tour="customs-pending"
                :model-ids="[]"
                :models="[]"
                :is-on-shift="isWorking"
                :filter-status="'CREATED'"
                :show-only-pending="true"
              />
              <!-- Regular users see shift history -->
              <UserShiftHistory v-else data-tour="history-section" />
            </template>

            <!-- Case: CUSTOMS -->
            <template v-else-if="activeTab === 'customs'">
              <!-- Content Manager sees the Kanban board -->
              <template v-if="isContentManager">
                <ContentManagerKanban />
              </template>
              <!-- Chatter sees their customs list -->
              <template v-else>
                
                <CustomsList 
                  data-tour="customs"
                  :model-ids="assignedModels.map(m => m.id)" 
                  :models="assignedModels"
                  :is-on-shift="isWorking"
                />
                <CreateCustomModal v-model:open="showCreateCustom" :models="assignedModels" @created="() => {}" />
              </template>
            </template>

          </div>
        </div>
      </main>

      <!-- ── Modals ── -->
      <!-- Start Shift -->
      <Dialog v-model:open="showStartModal">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preparar Turno</DialogTitle>
            <DialogDescription>
              {{ isExtraHoursSelection ? 'Iniciando Horas Extras' : 'Iniciando Jornada Regular' }}
            </DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <!-- Marketing: Reels, Posts, Ideas (optional, defaults to 0) -->
            <template v-if="isMarketing">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">Reels Editados Iniciales (opcional)</label>
                <Input type="number" v-model.number="startReelsEdited" placeholder="0" class="h-11 text-base font-bold" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">Posts Creados Iniciales (opcional)</label>
                <Input type="number" v-model.number="startPostsCreated" placeholder="0" class="h-11 text-base font-bold" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">Ideas Generadas Iniciales (opcional)</label>
                <Input type="number" v-model.number="startIdeasGenerated" placeholder="0" class="h-11 text-base font-bold" />
              </div>
            </template>
            
            <!-- Chatter: Facturación (optional, defaults to 0) -->
            <div v-else-if="!isContentManager" class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">Facturación Inicial ($ - opcional)</label>
              <Input type="number" v-model="startEarnings" placeholder="0.00" class="h-11 text-base font-bold" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="showStartModal = false">Cancelar</Button>
            <Button @click="startShift(isExtraHoursSelection)">Iniciar Turno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- End Shift / Report -->
      <Dialog v-model:open="showReportModal">
        <DialogScrollContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle class="text-xl font-bold tracking-tight">Reporte de Turno</DialogTitle>
            <DialogDescription class="text-zinc-500 dark:text-zinc-400">
              Completá los datos para finalizar la sesión
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-6 py-4">
            <!-- Force exit warning -->
            <div v-if="isForceExit"
              class="relative w-full rounded-lg border border-destructive/20 bg-destructive/10 p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-destructive">
              <AlertTriangle class="w-4 h-4" />
              <h5 class="mb-1 font-medium leading-none tracking-tight text-destructive">Cierre Anticipado</h5>
              <div class="text-sm [&_p]:leading-relaxed text-destructive/90 mb-3">
                Por favor, indicá la razón por la cual estás cerrando el turno antes de tiempo.
              </div>
              <Textarea v-model="emergencyReason" placeholder="Razón del cierre anticipado..."
                class="bg-background/50 border-destructive/30 focus-visible:ring-destructive/30 text-sm resize-none" />
            </div>

            <!-- Earnings -->
            <!-- Earnings — not for Content Manager -->
            <div v-if="!isContentManager" class="grid gap-2">
              <Label for="earnings" class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Facturación Neta ($)
              </Label>
              <Input id="earnings" type="number" v-model="startEarnings" placeholder="0"
                class="h-14 text-3xl font-black bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 transition-all" />
            </div>

            <!-- General Observations -->
            <div class="grid gap-2">
              <Label for="observations" class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Observaciones Generales
              </Label>
              <Textarea id="observations" v-model="observations" placeholder="Notas generales sobre el turno..."
                class="min-h-[120px] text-sm resize-none bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 transition-all" />
            </div>
          </div>

          <DialogFooter class="flex flex-col sm:flex-row gap-2">
            <Button v-if="!isExtraHours && !isForceExit" @click="submitEndShift(true)" variant="secondary"
              :disabled="isSubmittingEndShift"
              class="w-full sm:w-auto order-2 sm:order-1">
              {{ isSubmittingEndShift ? 'Cerrando...' : 'Cerrar e Iniciar Extras' }}
            </Button>
            <Button @click="submitEndShift(false)" :variant="isForceExit ? 'destructive' : 'default'"
              :disabled="isSubmittingEndShift"
              class="w-full sm:w-auto text-white order-1 sm:order-2 font-bold shadow-lg shadow-primary/20">
              {{ isSubmittingEndShift ? 'Finalizando...' : 'Finalizar Turno' }}
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>


    <!-- Error Dialog -->
    <Dialog v-model:open="errorDialog.show">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle class="text-destructive flex items-center gap-2">
            <AlertTriangle class="w-5 h-5" /> Error al enviar el reporte
          </DialogTitle>
          <DialogDescription class="sr-only">Detalle del error</DialogDescription>
        </DialogHeader>
        <div class="rounded-lg bg-zinc-950 border border-red-900/40 p-4 font-mono text-xs text-red-400 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">{{ errorDialog.message }}</div>
        <DialogFooter>
          <Button variant="outline" @click="errorDialog.show = false">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.font-sans {
  font-family: 'Plus Jakarta Sans', sans-serif;
}

/* Custom Scrollbar for a premium look */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(155, 155, 155, 0.1);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(155, 155, 155, 0.2);
}
</style>
