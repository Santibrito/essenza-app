import { ref, watch } from 'vue'

export interface ModelReportDraft {
  observations: string
  contentItems: string[]
  spenders: { name: string; username: string; amount: string }[]
}

const MODEL_REPORTS_KEY = 'essenza_model_reports'
const OBSERVATIONS_KEY = 'essenza_observations'

/**
 * Borradores de cierre de turno persistidos en localStorage:
 * observaciones generales + reportes por modelo en progreso.
 * Se autoguardan en cada cambio y se restauran al volver a entrar a la app,
 * para que el chatter no pierda lo cargado si cierra/reabre antes de finalizar.
 */
export function useReportDrafts() {
  const observations = ref('')
  const modelReports = ref<Record<number, ModelReportDraft>>({})

  function restoreDrafts() {
    try {
      const savedReports = localStorage.getItem(MODEL_REPORTS_KEY)
      if (savedReports) modelReports.value = JSON.parse(savedReports)
    } catch { /* ignore malformed data */ }
    try {
      const savedObs = localStorage.getItem(OBSERVATIONS_KEY)
      if (savedObs) observations.value = savedObs
    } catch { /* ignore */ }
  }

  function clearDrafts() {
    observations.value = ''
    modelReports.value = {}
    try {
      localStorage.removeItem(MODEL_REPORTS_KEY)
      localStorage.removeItem(OBSERVATIONS_KEY)
    } catch { /* ignore */ }
  }

  watch(modelReports, (val) => {
    try { localStorage.setItem(MODEL_REPORTS_KEY, JSON.stringify(val)) } catch { /* ignore */ }
  }, { deep: true })

  watch(observations, (val) => {
    try { localStorage.setItem(OBSERVATIONS_KEY, val) } catch { /* ignore */ }
  })

  return { observations, modelReports, restoreDrafts, clearDrafts }
}
