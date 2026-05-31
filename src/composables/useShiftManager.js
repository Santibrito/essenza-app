/**
 * Composable para manejo robusto de turnos
 * Integra ShiftManager con Vue 3 Composition API
 */

import { ref, reactive, readonly, onMounted, onUnmounted, computed } from 'vue'
import { toast } from 'vue-sonner'
import ShiftManager from '@/lib/ShiftManager.js'
import { useAuthStore } from '@/stores/auth'

export function useShiftManager() {
  const auth = useAuthStore()
  const shiftManager = new ShiftManager()
  
  // Estado reactivo
  const state = reactive({
    isWorking: false,
    isPaused: false,
    isAfk: false,
    currentShiftId: null,
    workTime: 0,
    breakTime: 0,
    idleTime: 0,
    isExtraHours: false,
    shiftStartTime: null,
    lastSyncTime: 0
  })
  
  // Estado de UI
  const ui = reactive({
    isStarting: false,
    isEnding: false,
    isToggling: false,
    connectionStatus: 'connected', // connected, disconnected, reconnecting
    lastError: null
  })
  
  // Configuración de API
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
  
  const authHeaders = () => ({
    'Authorization': `Bearer ${auth.user?.token}`,
    'Content-Type': 'application/json'
  })
  
  // Callbacks para el ShiftManager
  const callbacks = {
    onStateChange: (newState) => {
      Object.assign(state, newState)
    },
    
    onNotification: (type, title, message) => {
      toast[type](title, { description: message })
      
      // Notificación del sistema si está disponible
      if (window.electronAPI?.sendNotification) {
        window.electronAPI.sendNotification({ title, body: message })
      }
    },
    
    onError: (error) => {
      ui.lastError = error
      console.error('ShiftManager error:', error)
    }
  }
  
  // Computeds
  const effectiveWorkSeconds = computed(() => Math.max(0, state.workTime - state.idleTime))
  
  const statusLabel = computed(() => {
    if (!state.isWorking) return 'Offline'
    if (state.isPaused) return 'En Pausa'
    if (state.isExtraHours) return 'Horas Extras'
    return 'En Turno'
  })
  
  const statusDot = computed(() => {
    if (!state.isWorking) return 'bg-zinc-500'
    if (state.isPaused) return 'bg-amber-500'
    if (state.isAfk) return 'bg-orange-500'
    return 'bg-emerald-500'
  })
  
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  
  const displayTime = computed(() => formatTime(effectiveWorkSeconds.value))
  
  // Métodos principales
  const startShift = async (isExtra = false, initialData = {}) => {
    if (ui.isStarting) return
    
    ui.isStarting = true
    ui.lastError = null
    
    try {
      const result = await shiftManager.startShift(isExtra, initialData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // Notificar a Electron
      if (window.electronAPI?.shift?.started) {
        window.electronAPI.shift.started({
          apiUrl,
          token: auth.user?.token,
          shiftId: result.shift.id
        })
      }
      
      return result
      
    } catch (error) {
      ui.lastError = error.message
      throw error
    } finally {
      ui.isStarting = false
    }
  }
  
  const endShift = async (reportData = {}, force = false) => {
    if (ui.isEnding) return
    
    ui.isEnding = true
    ui.lastError = null
    
    try {
      const result = await shiftManager.endShift(reportData, force)
      
      if (!result.success) {
        if (result.code === 'INCOMPLETE') {
          // Turno incompleto - devolver error específico
          return result
        }
        throw new Error(result.error)
      }
      
      // Notificar a Electron
      if (window.electronAPI?.shift?.stopped) {
        window.electronAPI.shift.stopped()
      }
      
      return result
      
    } catch (error) {
      ui.lastError = error.message
      throw error
    } finally {
      ui.isEnding = false
    }
  }
  
  const toggleBreak = async () => {
    if (ui.isToggling) return
    
    ui.isToggling = true
    ui.lastError = null
    
    try {
      const result = await shiftManager.toggleBreak()
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // Notificar a Electron
      if (window.electronAPI?.shift) {
        if (state.isPaused) {
          window.electronAPI.shift.paused?.()
        } else {
          window.electronAPI.shift.resumed?.()
        }
      }
      
      return result
      
    } catch (error) {
      ui.lastError = error.message
      throw error
    } finally {
      ui.isToggling = false
    }
  }
  
  // Métodos de utilidad
  const addManualTime = (minutes) => {
    const secondsToAdd = minutes * 60
    state.workTime += secondsToAdd
    
    toast.success(`Tiempo agregado: +${minutes} minutos`)
    
    // Sincronizar con Electron
    if (window.electronAPI?.shift?.syncTime) {
      window.electronAPI.shift.syncTime(state.workTime)
    }
  }
  
  const forceSync = async () => {
    try {
      await shiftManager.syncWithServer()
      toast.success('Sincronización forzada completada')
    } catch (error) {
      toast.error('Error en sincronización', { description: error.message })
    }
  }
  
  const recoverShift = async () => {
    try {
      await shiftManager.recoverActiveShift()
      toast.info('Recuperación de turno completada')
    } catch (error) {
      toast.error('Error en recuperación', { description: error.message })
    }
  }
  
  // Lifecycle
  onMounted(() => {
    // Inicializar ShiftManager
    shiftManager.initialize(apiUrl, authHeaders, callbacks)
    
    // Manejar atajos de teclado globales
    const handleKeyboard = (e) => {
      // Ctrl + Alt + S = Sincronización forzada
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        forceSync()
      }
      
      // Ctrl + Alt + R = Recuperar turno
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        recoverShift()
      }
    }
    
    window.addEventListener('keydown', handleKeyboard)
    
    // Cleanup en beforeunload
    const handleBeforeUnload = () => {
      shiftManager.persistState()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyboard)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  })
  
  onUnmounted(() => {
    shiftManager.destroy()
  })
  
  // Monitoreo de conexión
  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/shifts/current`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(5000) // 5 segundos timeout
      })
      
      if (ui.connectionStatus !== 'connected') {
        ui.connectionStatus = 'connected'
        toast.success('Conexión restablecida')
      }
      
      return true
    } catch (error) {
      if (ui.connectionStatus === 'connected') {
        ui.connectionStatus = 'disconnected'
        toast.error('Conexión perdida', { 
          description: 'Intentando reconectar...',
          duration: 5000 
        })
      }
      return false
    }
  }
  
  // Monitoreo periódico de conexión
  let connectionInterval = null
  onMounted(() => {
    connectionInterval = setInterval(checkConnection, 30000) // cada 30 segundos
  })
  
  onUnmounted(() => {
    if (connectionInterval) {
      clearInterval(connectionInterval)
    }
  })
  
  return {
    // Estado
    state: readonly(state),
    ui: readonly(ui),
    
    // Computeds
    effectiveWorkSeconds,
    statusLabel,
    statusDot,
    displayTime,
    
    // Métodos
    startShift,
    endShift,
    toggleBreak,
    addManualTime,
    forceSync,
    recoverShift,
    formatTime,
    checkConnection,
    
    // Utilidades
    isWorking: computed(() => state.isWorking),
    isPaused: computed(() => state.isPaused),
    currentShiftId: computed(() => state.currentShiftId)
  }
}