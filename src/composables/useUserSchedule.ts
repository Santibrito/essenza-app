import { ref, computed } from 'vue'
import api from '@/api'
import { useAuthStore } from '@/stores/auth'

const DAY_TRANSLATIONS: Record<string, string> = {
  MONDAY: 'Lun', TUESDAY: 'Mar', WEDNESDAY: 'Mié', THURSDAY: 'Jue',
  FRIDAY: 'Vie', SATURDAY: 'Sáb', SUNDAY: 'Dom'
}
const ALL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

/**
 * Horario del usuario, modelos asignadas y handoff.
 * - userSchedule: horario actual + template (con startTime/endTime/timezone) + assignedModels.
 * - assignedModels: modelos que el usuario tiene asignadas hoy (ordenadas por nombre).
 * - offDaysArray: días NO agendados (etiquetas cortas) para mostrar como "días libres".
 * - isWithinSchedule: si la hora actual (en la TZ del horario) cae dentro del turno.
 */
export function useUserSchedule() {
  const auth = useAuthStore()

  const userSchedule = ref<any>(null)
  const assignedModels = ref<any[]>([])
  const userAllSchedules = ref<any[]>([])
  const handoffData = ref<Record<number, any[]>>({})

  const offDaysArray = computed(() => {
    const scheduledDays = userAllSchedules.value.map(s => s.dayOfWeek)
    if (scheduledDays.length === 0) return [] // sin agenda → no mostramos nada para evitar ruido
    return ALL_DAYS.filter(day => !scheduledDays.includes(day)).map(day => DAY_TRANSLATIONS[day])
  })

  const isWithinSchedule = computed(() => {
    if (!userSchedule.value?.template) return true // sin horario cargado → permitimos
    const { startTime, endTime } = userSchedule.value.template
    if (!startTime || !endTime) return true

    const now = new Date()
    const currentTz = userSchedule.value.timezone || auth.user?.timezone || 'America/Argentina/Buenos_Aires'

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: currentTz, hour: '2-digit', minute: '2-digit', hour12: false
    })
    const parts = formatter.formatToParts(now)
    const hour = parts.find(p => p.type === 'hour')?.value || '00'
    const minute = parts.find(p => p.type === 'minute')?.value || '00'
    const currentTimeStr = `${hour}:${minute}`

    return currentTimeStr >= startTime.slice(0, 5) && currentTimeStr <= endTime.slice(0, 5)
  })

  // Horario actual + modelos asignadas (puede lanzar; el caller decide cómo manejarlo).
  async function fetchUserSchedule() {
    const res = await api.get('/admin/users/schedule/current')
    userSchedule.value = res.data
    const models = userSchedule.value?.assignedModels || []
    assignedModels.value = models.sort((a: any, b: any) => a.name.localeCompare(b.name))
  }

  async function fetchUserAllSchedules() {
    if (!auth.user?.id) return
    try {
      const res = await api.get(`/admin/users/schedule/user/${auth.user.id}`)
      userAllSchedules.value = res.data || []
    } catch (e) { console.error('Error fetching schedules:', e) }
  }

  // Reservado: el backend de templates aún no está implementado.
  async function fetchTemplates() { /* TODO: backend endpoint */ }

  async function loadHandoff() {
    if (!assignedModels.value.length) return
    try {
      const ids = assignedModels.value.map(m => m.id).join(',')
      const res = await api.get(`/admin/models/handoff?modelIds=${ids}`)
      handoffData.value = res.data || {}
    } catch { /* ignore */ }
  }

  return {
    userSchedule, assignedModels, userAllSchedules, handoffData,
    offDaysArray, isWithinSchedule,
    fetchUserSchedule, fetchUserAllSchedules, fetchTemplates, loadHandoff
  }
}
