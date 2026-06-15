<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, defineAsyncComponent } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useShiftManager } from '@/composables/useShiftManager'
import { useReportDrafts } from '@/composables/useReportDrafts'
import { useUserSchedule } from '@/composables/useUserSchedule'

// UI Primitives
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogScrollContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Plus, X, Play, Monitor, Layers } from 'lucide-vue-next'

// Modular Components - Lazy loaded for better performance
const DashboardSidebar = defineAsyncComponent(() => import('@/components/dashboard/DashboardSidebar.vue'))
const Topbar = defineAsyncComponent(() => import('@/components/dashboard/Topbar.vue'))
const TrackerCard = defineAsyncComponent(() => import('@/components/dashboard/TrackerCard.vue'))
const StatsCards = defineAsyncComponent(() => import('@/components/dashboard/StatsCards.vue'))
const NotesCard = defineAsyncComponent(() => import('@/components/dashboard/NotesCard.vue'))
const AnnouncementsBanner = defineAsyncComponent(() => import('@/components/dashboard/AnnouncementsBanner.vue'))
const MarketingPanel = defineAsyncComponent(() => import('@/components/dashboard/MarketingPanel.vue'))
const CreativityWall = defineAsyncComponent(() => import('@/components/dashboard/CreativityWall.vue'))
const LeadsKanban = defineAsyncComponent(() => import('@/components/dashboard/LeadsKanban.vue'))
const UserShiftHistory = defineAsyncComponent(() => import('@/components/dashboard/UserShiftHistory.vue'))
const ModelReportsSection = defineAsyncComponent(() => import('@/components/dashboard/ModelReportsSection.vue'))
const ModelKnowledgeBase = defineAsyncComponent(() => import('@/components/dashboard/ModelKnowledgeBase.vue'))
const CustomsList = defineAsyncComponent(() => import('@/components/customs/CustomsList.vue'))
const CreateCustomModal = defineAsyncComponent(() => import('@/components/customs/CreateCustomModal.vue'))
const ContentManagerKanban = defineAsyncComponent(() => import('@/components/customs/ContentManagerKanban.vue'))
const PublicationsCalendar = defineAsyncComponent(() => import('@/components/dashboard/PublicationsCalendar.vue'))
const PaymentReceiptsSection = defineAsyncComponent(() => import('@/components/dashboard/PaymentReceiptsSection.vue'))
const AccountsPanel = defineAsyncComponent(() => import('@/components/dashboard/AccountsPanel.vue'))
import { useCustomsNotifications } from '@/lib/useCustomsNotifications'
import { postWithOutbox, flushOutbox } from '@/lib/outbox'

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
const { startTour, hasCompletedTour, markAsCompleted } = useOnboardingTour((tab) => {
  activeTab.value = tab
}, auth.user?.role)

// Usar el nuevo ShiftManager robusto
const {
  state: shiftState,
  ui: shiftUI,
  effectiveWorkSeconds,
  statusLabel,
  statusDot,
  displayTime,
  startShift: startShiftRobust,
  endShift: endShiftRobust,
  toggleBreak: toggleBreakRobust,
  forceSync,
  recoverShift,
  formatTime,
  isWorking,
  isPaused,
  currentShiftId
} = useShiftManager()

function startTourManually() {
  startTour()
}

// --- State (simplificado - ahora manejado por ShiftManager) ---
const isExtraHoursSelection = ref(false)
const showStartModal = ref(false)
const showReportModal = ref(false)
const errorDialog = ref<{ show: boolean; message: string }>({ show: false, message: "" })

const {
  userSchedule, assignedModels, offDaysArray, isWithinSchedule,
  fetchUserSchedule, fetchUserAllSchedules, fetchTemplates, loadHandoff
} = useUserSchedule()
const userOffDays = ref('')
const shiftTarget = ref<number>(0)
const modelsHistory = ref<Record<number, HistoryEntry[]>>({})
const activeTab = ref<'tracker' | 'history' | 'crm' | 'creative' | 'context' | 'customs' | 'publications' | 'marketing' | 'receipts' | 'accounts'>('tracker')
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

// Marketing-specific end-of-shift report (lo producido durante el turno).
// Antes no se capturaba al cerrar → se perdían los datos de marketing.
const reportReelsEdited = ref(0)
const reportPostsCreated = ref(0)
const reportIdeasGenerated = ref(0)

const { observations, modelReports, restoreDrafts, clearDrafts } = useReportDrafts()
const isForceExit = ref(false)
const emergencyReason = ref('')

const perModelReports = ref<ModelExitReport[]>([])
const selectedModelReportIdx = ref(0)
const isSubmittingEndShift = ref(false)

// Screen capture target selection
const selectedScreenId = ref(localStorage.getItem('selectedScreenId') || null)
const availableScreens = ref<any[]>([])
const showScreenSelector = ref(false)

const handleGlobalShortcuts = async (e: KeyboardEvent) => {
  // Ctrl + Alt + M opens the screen selector (which monitor to capture)
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
    e.preventDefault()
    if (window.electronAPI?.screen) {
      availableScreens.value = await window.electronAPI.screen.getScreenSources()
      showScreenSelector.value = true
    }
  }
}

// Computed bridge to ShiftManager UI state
const statusColor = computed(() => {
  if (!isWorking.value) return 'zinc'
  if (isPaused.value) return 'amber'
  return 'emerald'
})
const isServerDown = computed(() => shiftUI.connectionStatus === 'disconnected')

const dailySummary = ref<any>(null)

// --- Computed (actualizados para usar ShiftManager) ---
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

const totalTodayAccumulated = computed(() => {
  const previousSeconds = dailySummary.value?.todayActiveSeconds || 0
  return previousSeconds + effectiveWorkSeconds.value
})

const missingShiftSeconds = computed(() => {
  if (shiftState.isExtraHours) return 0
  return Math.max(0, SHIFT_TARGET.value - totalTodayAccumulated.value)
})

const shiftCompliancePercent = computed(() =>
  Math.min(100, Math.round((totalTodayAccumulated.value / SHIFT_TARGET.value) * 100))
)

const hasHoursDebt = computed(() => (dailySummary.value?.todayActiveSeconds || 0) < SHIFT_TARGET.value)
const debtMinutes = computed(() => Math.max(0, Math.floor((SHIFT_TARGET.value - (dailySummary.value?.todayActiveSeconds || 0)) / 60)))

// Horarios, modelos asignadas, offDays e isWithinSchedule viven en useUserSchedule().

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

// --- Funciones de utilidad ---

// --- Shift Actions (Robustas con ShiftManager) ---
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
    // Preparar datos iniciales según el rol
    const initialData = isMarketing.value ? {
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
    
    const result = await startShiftRobust(isExtra, initialData)
    
    if (result.success) {
      showStartModal.value = false
    }
    
  } catch (error) {
    console.error('Error starting shift:', error)
  }
}

// ── Integración con MarketingPanel (tab "Métricas Sociales") ──
// El panel persiste su avance en localStorage; acá lo leemos para prellenar
// el modal de cierre y para mandar las actividades sociales al backend.
const MARKETING_PANEL_KEY = 'essenza_marketing_panel'
function readMarketingPanel(): any | null {
  try {
    const saved = localStorage.getItem(MARKETING_PANEL_KEY)
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

function prefillMarketingReport() {
  if (!isMarketing.value) return
  const panel = readMarketingPanel()
  if (!panel) return
  // Solo prellenamos campos que el usuario todavía no tocó en el modal
  if (!reportReelsEdited.value) reportReelsEdited.value = panel.reelsEdited || 0
  if (!reportPostsCreated.value) reportPostsCreated.value = panel.postsCreated || 0
  if (!reportIdeasGenerated.value) reportIdeasGenerated.value = panel.ideasGenerated || 0
}

async function endShiftPrompt() {
  // El cierre ya NO se bloquea por meta/AFK ni requiere doble-clic: el chatter termina
  // normalmente y, si no llegó al objetivo, queda AUDITADO como "tiempo adeudado" en el
  // panel del administrador (Registro de Turnos).
  isForceExit.value = false
  initModelReports()
  prefillMarketingReport()
  showReportModal.value = true
}

async function submitEndShift(startExtras: boolean) {
  // Guard anti doble-click: el ref existía pero nunca se seteaba, así que los
  // botones "Terminar Turno" jamás se deshabilitaban durante el request.
  if (isSubmittingEndShift.value) return
  isSubmittingEndShift.value = true
  try {
    // Capturamos el id ANTES de cerrar: endShiftRobust limpia el estado del turno.
    const closingShiftId = currentShiftId.value
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

    // Actividad social por cuenta (cargada en "Métricas Sociales").
    // Se calcula acá porque va en DOS lados: el JSON del reporte (lo que ve
    // el admin en ShiftDetails) y el batch a /marketing/reports.
    const marketingActivities = isMarketing.value
      ? (readMarketingPanel()?.socialActivity || [])
          .filter((a: any) => a.posts || a.stories || a.reels || a.likes || a.comments || a.followersCount || a.comment)
          .map((a: any) => ({
            accountId: a.accountId,
            handle: a.handle,
            platform: a.platform,
            posts: a.posts || 0,
            stories: a.stories || 0,
            reels: a.reels || 0,
            likes: a.likes || 0,
            comments: a.comments || 0,
            followersCount: a.followersCount || 0,
            socialDataJson: a.socialDataJson || '',
            comment: a.comment || ''
          }))
      : []

    payload = {
      observations: finalObs,
      force: isForceExit.value,
      modelReports: filteredReports.map(r => ({
        modelId: r.modelId,
        modelName: r.modelName,
        soldContentJson: JSON.stringify(r.contentItems),
        spendersJson: JSON.stringify(r.spenders.filter(s => s.name || s.username || s.amount))
      }))
    }

    // Motivo del cierre forzado como campo propio (el backend lo guarda en
    // shift.closeReason para que el admin lo vea como badge, no solo en notas)
    if (isForceExit.value) {
      payload.closeReason = emergencyReason.value || ''
    }

    if (isMarketing.value) {
      // Reporte de marketing: lo producido durante el turno.
      // El backend marca el reporte como MARKETING si viene `reelsEdited`.
      payload.reelsEdited = reportReelsEdited.value
      payload.postsCreated = reportPostsCreated.value
      payload.ideasGenerated = reportIdeasGenerated.value
      if (marketingActivities.length > 0) {
        payload.socialActivityJson = JSON.stringify(marketingActivities)
      }
    } else {
      // Reporte de chatter: facturación.
      payload.earnings = startEarnings.value
      payload.earningsMessages = startEarningsMessages.value
      payload.earningsTips = startEarningsTips.value
      payload.earningsPosts = startEarningsPosts.value
      payload.growthPercentage = startGrowthPercentage.value
    }

    const result = await endShiftRobust(payload, isForceExit.value)
    
    if (!result.success) {
      if (result.code === 'INCOMPLETE') {
        toast.error(result.error || 'El turno está incompleto.')
        showReportModal.value = false
        return
      }
      if (result.code === 'AUTH') {
        // Sesión expirada: ya se disparó el logout/redirect. No mostramos error.
        toast.error(result.error || 'Tu sesión expiró. Volvé a iniciar sesión.')
        showReportModal.value = false
        return
      }
      if (result.code === 'NETWORK') {
        // Server caído: el turno sigue activo. Dejamos el modal ABIERTO
        // (con lo que ya escribió) para que pueda reintentar.
        toast.error('No se pudo cerrar el turno', {
          duration: 10000,
          description: result.error
        })
        return
      }
      throw new Error(result.error)
    }

    // Marketing: enviar actividad social por cuenta al registro estructurado
    if (isMarketing.value && closingShiftId && marketingActivities.length > 0) {
      const sent = await postWithOutbox('/marketing/reports/activities/batch', { shiftId: closingShiftId, activities: marketingActivities })
      if (!sent) {
        toast.info('Actividades de marketing guardadas localmente', {
          description: 'Se reenviarán automáticamente cuando vuelva la conexión.'
        })
      }
    }

    // Save to logbook for handoff view
    if (filteredReports.length > 0) {
      const logbookEntries = filteredReports.map(r => ({
        ofModelId: r.modelId,
        shiftId: closingShiftId,
        message: r.handoffNotes || '',
        soldContentJson: JSON.stringify(r.contentItems),
        spendersJson: JSON.stringify(r.spenders.filter(s => s.name || s.username || s.amount))
      }))
      
      await postWithOutbox('/admin/models/logbook/batch', logbookEntries)
    }

    // Reset local state
    resetLocalState()
    fetchDailySummary()
    showReportModal.value = false

    if (startExtras) { 
      toast.info('Turno cerrado. Iniciando extras...')
      setTimeout(() => startShift(true), 1200) 
    } else { 
      toast.success('Turno finalizado correctamente.')
    }
    
  } catch (e: any) {
    console.error('Error ending shift:', e)
    errorDialog.value = { show: true, message: e?.message || String(e) }
  } finally {
    isSubmittingEndShift.value = false
  }
}

async function toggleBreak() {
  try {
    await toggleBreakRobust()
  } catch (error) {
    console.error('Error toggling break:', error)
  }
}

// Función para resetear estado local (no el del ShiftManager)
function resetLocalState() {
  // Reset solo las variables locales del componente
  startEarnings.value = 0
  startEarningsMessages.value = 0
  startEarningsTips.value = 0
  startEarningsPosts.value = 0
  startGrowthPercentage.value = 0
  startReelsEdited.value = 0
  startPostsCreated.value = 0
  startIdeasGenerated.value = 0
  reportReelsEdited.value = 0
  reportPostsCreated.value = 0
  reportIdeasGenerated.value = 0
  isForceExit.value = false
  emergencyReason.value = ''
  perModelReports.value = []

  // Limpiar borradores de reporte (observaciones + reportes por modelo) + panel marketing
  clearDrafts()
  try {
    localStorage.removeItem(MARKETING_PANEL_KEY)
  } catch (e) {
    console.warn('Failed to clear localStorage:', e)
  }
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

// Reintento de envíos pendientes (marketing/logbook que fallaron por red)
let outboxInterval: any = null

onMounted(async () => {
  // Token is already validated by the router guard (validateSession).
  // If we got here, the token is valid or the server is unreachable (offline tolerance).
  if (!auth.user?.token) {
    toast.error('No hay sesión activa', {
      description: 'Por favor, iniciá sesión para continuar.',
      duration: 5000
    })
    return
  }

  // System capabilities detection is now handled by ShiftManager
  
  auth.refreshUserProfile()
  fetchTemplates()
  fetchUserAllSchedules()
  fetchDailySummary()
  // Restore in-progress report data from previous session
  restoreDrafts()
  // Shift recovery is now handled automatically by useShiftManager()

  try {
    await fetchUserSchedule()

    // Only load handoff for Chatters (they see ModelReportsSection)
    if (!isContentManager.value && !isMarketing.value) {
      await loadHandoff()
    }

    // Start customs notifications polling (only for Chatters and Managers, not Marketing)
    if (!isMarketing.value) {
      customsNotifications.start()
    }
  } catch { }

  window.addEventListener('keydown', handleGlobalShortcuts)

  // Vaciar la cola de envíos pendientes ahora y cada 60s
  flushOutbox()
  outboxInterval = setInterval(flushOutbox, 60000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcuts)
  if (outboxInterval) clearInterval(outboxInterval)
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
          :class="['flex-1 bg-muted/30 dark:bg-zinc-950 relative', (activeTab === 'context' || activeTab === 'publications') ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700']">
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
            :class="[activeTab === 'context' ? 'max-w-none !p-0 h-full flex flex-col' : (activeTab === 'publications' ? 'max-w-[1600px] p-4 lg:p-6 h-full flex flex-col' : 'max-w-[1400px] p-4 lg:p-8 space-y-8 min-h-full'), 'mx-auto relative z-10 transition-all']">
            <AnnouncementsBanner />

            <!-- Case: TRACKER -->
            <template v-if="activeTab === 'tracker'">
              <!-- Modular Stats Overview -->
              <StatsCards :shift-compliance-percent="shiftCompliancePercent" :work-time="shiftState.workTime" :idle-time="shiftState.idleTime"
                :break-time="shiftState.breakTime" :daily-summary="dailySummary" />

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Modular Tracker/Timer Card -->
                <TrackerCard 
                  data-tour="shift-status"
                  :effective-work-seconds="effectiveWorkSeconds"
                  :idle-time="shiftState.idleTime"
                  :is-working="isWorking"
                  :is-paused="isPaused"
                  :status-label="statusLabel" 
                  :status-dot="statusDot"
                  :shift-start-time="shiftState.shiftStartTime ?? undefined" 
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

            <!-- Case: MÉTRICAS SOCIALES (Marketing only) -->
            <template v-else-if="activeTab === 'marketing'">
              <MarketingPanel :shift-id="currentShiftId" />
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

            <!-- Case: PUBLICACIONES (Marketing only) -->
            <template v-else-if="activeTab === 'publications'">
              <div class="flex-1 min-h-0">
                <PublicationsCalendar :assigned-models="assignedModels" />
              </div>
            </template>

            <!-- Case: COMPROBANTES DE PAGO -->
            <template v-else-if="activeTab === 'receipts'">
              <PaymentReceiptsSection />
            </template>

            <!-- Case: CUENTAS (Marketing only) — gestión completa de cuentas IG + 2FA -->
            <template v-else-if="activeTab === 'accounts'">
              <AccountsPanel />
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
            <DialogTitle class="text-xl font-bold tracking-tight">
              {{ isForceExit ? 'Cierre anticipado del turno' : 'Reporte de cierre de turno' }}
            </DialogTitle>
            <DialogDescription class="text-zinc-500 dark:text-zinc-400">
              {{ isForceExit
                ? 'Tu turno aún no llega a la meta. Indicá el motivo para abandonarlo.'
                : 'Revisá el resumen y completá tu reporte para finalizar.' }}
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-6 py-4">
            <!-- Resumen del turno: contexto de por qué podés / no podés cerrar -->
            <div class="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Tiempo efectivo (sin AFK)</span>
                <span class="font-bold tabular-nums">{{ formatTime(totalTodayAccumulated) }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Meta del día</span>
                <span class="font-bold tabular-nums">{{ formatTime(SHIFT_TARGET) }}</span>
              </div>
              <div v-if="missingShiftSeconds > 0 && !shiftState.isExtraHours"
                class="flex items-center justify-between text-sm text-amber-500">
                <span>Te falta</span>
                <span class="font-bold tabular-nums">{{ formatTime(missingShiftSeconds) }}</span>
              </div>
              <div v-else class="flex items-center justify-between text-sm text-emerald-500">
                <span>Meta cumplida</span>
                <span class="font-bold">✓</span>
              </div>
              <p v-if="shiftState.idleTime > 0"
                class="text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                Se descontaron {{ formatTime(shiftState.idleTime) }} de tiempo AFK (inactivo) de tu tiempo efectivo.
              </p>
            </div>

            <!-- Force exit warning -->
            <div v-if="isForceExit"
              class="relative w-full rounded-lg border border-destructive/20 bg-destructive/10 p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-destructive">
              <AlertTriangle class="w-4 h-4" />
              <h5 class="mb-1 font-medium leading-none tracking-tight text-destructive">Cierre anticipado</h5>
              <div class="text-sm [&_p]:leading-relaxed text-destructive/90 mb-3">
                Estás cerrando el turno sin completar la meta. Indicá el motivo; queda registrado para tu supervisor.
              </div>
              <Textarea v-model="emergencyReason" placeholder="Motivo del cierre anticipado..."
                class="bg-background/50 border-destructive/30 focus-visible:ring-destructive/30 text-sm resize-none" />
            </div>

            <!-- Chatter: facturación (no aplica a marketing ni content manager) -->
            <div v-if="!isContentManager && !isMarketing" class="grid gap-2">
              <Label for="earnings" class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Facturación Neta ($)
              </Label>
              <Input id="earnings" type="number" v-model="startEarnings" placeholder="0"
                class="h-14 text-3xl font-black bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 transition-all" />
            </div>

            <!-- Marketing: producción del turno (antes no se capturaba → se perdía) -->
            <div v-if="isMarketing" class="grid grid-cols-3 gap-3">
              <div class="grid gap-1.5">
                <Label class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Reels editados</Label>
                <Input type="number" v-model.number="reportReelsEdited" placeholder="0" class="h-12 text-xl font-bold" />
              </div>
              <div class="grid gap-1.5">
                <Label class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Posts creados</Label>
                <Input type="number" v-model.number="reportPostsCreated" placeholder="0" class="h-12 text-xl font-bold" />
              </div>
              <div class="grid gap-1.5">
                <Label class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Ideas generadas</Label>
                <Input type="number" v-model.number="reportIdeasGenerated" placeholder="0" class="h-12 text-xl font-bold" />
              </div>
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
            <Button variant="outline" @click="showReportModal = false"
              class="w-full sm:w-auto order-3 sm:order-1">
              Seguir Trabajando
            </Button>
            <Button v-if="!shiftState.isExtraHours && !isForceExit" @click="submitEndShift(true)" variant="secondary"
              :disabled="isSubmittingEndShift"
              class="w-full sm:w-auto order-2 sm:order-2">
              {{ isSubmittingEndShift ? 'Cerrando...' : 'Cerrar e Iniciar Extras' }}
            </Button>
            <Button @click="submitEndShift(false)" :variant="isForceExit ? 'destructive' : 'default'"
              :disabled="isSubmittingEndShift"
              class="w-full sm:w-auto text-white order-1 sm:order-3 font-bold shadow-lg shadow-primary/20">
              {{ isSubmittingEndShift ? 'Finalizando...' : 'Terminar Turno' }}
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

    <!-- ── Stealth Screen Selector ── -->
    <Dialog v-model:open="showScreenSelector">
      <DialogContent class="sm:max-w-md bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden shadow-2xl">
        <DialogHeader class="p-6 pb-0">
          <DialogTitle class="text-primary font-black uppercase tracking-tighter flex items-center gap-2">
            <Monitor class="w-5 h-5" /> Protocolo de Pantalla
          </DialogTitle>
          <DialogDescription class="text-zinc-400 text-xs">
            Selecciona el monitor que deseas capturar. Este ajuste es persistente y discreto.
          </DialogDescription>
        </DialogHeader>
        
        <div class="p-6 space-y-3">
          <div v-for="screen in availableScreens" :key="screen.id" 
            @click="selectedScreenId = screen.id; localStorage.setItem('selectedScreenId', screen.id); showScreenSelector = false; toast.success('Protocolo activado')"
            class="flex items-center justify-between p-4 rounded-xl border border-zinc-800 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Monitor class="w-5 h-5 text-zinc-600 group-hover:text-primary transition-colors" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold truncate">{{ screen.name }}</p>
                <p class="text-[10px] text-zinc-500 font-mono truncate">{{ screen.id }}</p>
              </div>
            </div>
            <div v-if="selectedScreenId === screen.id" class="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
          </div>
          
          <div @click="selectedScreenId = null; localStorage.removeItem('selectedScreenId'); showScreenSelector = false"
            class="flex items-center justify-between p-4 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 cursor-pointer transition-all group mt-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center">
                <Layers class="w-5 h-5 text-zinc-600 group-hover:text-zinc-400" />
              </div>
              <p class="text-sm font-bold text-zinc-500 group-hover:text-zinc-300">Capturar todo (Global)</p>
            </div>
            <div v-if="!selectedScreenId" class="w-2.5 h-2.5 rounded-full bg-zinc-600" />
          </div>
        </div>
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
