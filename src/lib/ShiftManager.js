/**
 * ShiftManager - Sistema robusto de manejo de turnos
 * 
 * Soluciona:
 * - Race conditions en start/end
 * - Múltiples timers desincronizados
 * - Pérdida de estado en crashes
 * - Manejo inconsistente de errores
 * - Recuperación automática
 */

class ShiftManager {
  constructor() {
    this.state = {
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
    }
    
    this.config = {
      syncInterval: 5000,        // 5 segundos
      screenshotInterval: 360000, // 6 minutos
      healthCheckInterval: 30000, // 30 segundos
      maxRetries: 3,
      retryDelay: 2000
    }
    
    this.timers = {
      work: null,
      sync: null,
      screenshot: null,
      healthCheck: null,
      break: null
    }
    
    this.locks = {
      starting: false,
      ending: false,
      syncing: false
    }
    
    this.callbacks = {
      onStateChange: null,
      onError: null,
      onNotification: null,
      onAuthExpired: null
    }

    // Evita disparar el flujo de "sesión expirada" más de una vez
    this._authExpiredHandled = false

    this.apiUrl = null
    this.authHeaders = null
    
    // Recuperar estado al inicializar
    this.restoreState()
  }
  
  /**
   * Inicializa el manager con configuración
   */
  initialize(apiUrl, authHeaders, callbacks = {}) {
    this.apiUrl = apiUrl
    this.authHeaders = authHeaders
    this.callbacks = { ...this.callbacks, ...callbacks }
    
    // Intentar recuperar shift activo del servidor
    this.recoverActiveShift()
    
    console.log('ShiftManager initialized')
  }
  
  /**
   * Recupera estado desde localStorage
   */
  restoreState() {
    try {
      const saved = localStorage.getItem('shiftManager_state')
      if (saved) {
        const savedState = JSON.parse(saved)
        this.state = { ...this.state, ...savedState }
        console.log('State restored from localStorage:', this.state)
      }
    } catch (e) {
      console.warn('Failed to restore state:', e)
    }
  }
  
  /**
   * Persiste estado en localStorage
   */
  persistState() {
    try {
      localStorage.setItem('shiftManager_state', JSON.stringify(this.state))
      localStorage.setItem('shiftManager_lastUpdate', Date.now().toString())
    } catch (e) {
      console.warn('Failed to persist state:', e)
    }
  }
  
  /**
   * Recupera shift activo del servidor al iniciar
   */
  async recoverActiveShift() {
    if (!this.apiUrl || !this.authHeaders) return
    
    try {
      const response = await this.makeRequest('/shifts/current', 'GET')
      
      if (response.status === 204) {
        // No hay shift activo
        this.resetState()
        return
      }
      
      if (response.ok) {
        const shift = await response.json()
        
        // Recuperar estado del shift activo
        this.state.currentShiftId = shift.id
        this.state.isWorking = shift.status === 'ACTIVE' || shift.status === 'PAUSED'
        this.state.isPaused = shift.status === 'PAUSED'
        this.state.isExtraHours = shift.isExtraHours || false
        this.state.shiftStartTime = shift.startTime
        this.state.breakTime = shift.breakTimeSeconds || 0
        this.state.idleTime = shift.idleTimeSeconds || 0
        // activeTimeSeconds del servidor es EFECTIVO (sin AFK). Reconstruimos el
        // workTime BRUTO sumándole el idle para que effectiveWorkSeconds vuelva a
        // dar el valor correcto y no se reste el AFK dos veces.
        this.state.workTime = (shift.activeTimeSeconds || 0) + this.state.idleTime
        
        if (this.state.isWorking) {
          this.notify('info', 'Shift recuperado', `Continuando turno #${shift.id}`)
          this.startAllTimers()
        }
        
        this.persistState()
        this.notifyStateChange()
        
        console.log('Active shift recovered:', shift)
      }
    } catch (e) {
      console.error('Failed to recover active shift:', e)
    }
  }
  
  /**
   * Inicia un nuevo turno
   */
  async startShift(isExtra = false, initialData = {}) {
    // Prevenir múltiples starts simultáneos
    if (this.locks.starting) {
      console.warn('Start already in progress')
      return { success: false, error: 'Start already in progress' }
    }
    
    if (this.state.isWorking) {
      console.warn('Shift already active')
      return { success: false, error: 'Shift already active' }
    }
    
    this.locks.starting = true
    
    try {
      const endpoint = isExtra ? '/shifts/start-extra' : '/shifts/start'
      const response = await this.makeRequest(endpoint, 'POST', initialData)

      if (response.status === 401) {
        return { success: false, error: 'Tu sesión expiró. Volvé a iniciar sesión.', code: 'AUTH' }
      }

      if (!response.ok) {
        const error = await this.parseError(response)
        throw new Error(error)
      }
      
      const shift = await response.json()
      
      if (!shift || !shift.id) {
        throw new Error('Invalid shift response from server')
      }
      
      // Actualizar estado
      this.state.currentShiftId = shift.id
      this.state.isWorking = true
      this.state.isPaused = false
      this.state.isExtraHours = isExtra
      this.state.shiftStartTime = shift.startTime
      this.state.workTime = 0
      this.state.breakTime = 0
      this.state.idleTime = 0
      this.state.lastSyncTime = Date.now()
      
      // Verificar que el shift se creó correctamente
      await this.verifyShiftCreation(shift.id)
      
      this.startAllTimers()
      this.persistState()
      this.notifyStateChange()
      
      this.notify('success', 'Turno iniciado', `Shift #${shift.id} ${isExtra ? '(Horas Extra)' : ''}`)
      
      console.log('Shift started successfully:', shift)
      return { success: true, shift }
      
    } catch (e) {
      console.error('Failed to start shift:', e)
      this.notify('error', 'Error al iniciar turno', e.message)
      return { success: false, error: e.message }
    } finally {
      this.locks.starting = false
    }
  }
  
  /**
   * Verifica que el shift se creó correctamente
   */
  async verifyShiftCreation(shiftId) {
    try {
      const response = await this.makeRequest('/shifts/current', 'GET')
      if (response.ok) {
        const currentShift = await response.json()
        if (!currentShift || currentShift.id !== shiftId) {
          throw new Error('Shift verification failed - ID mismatch')
        }
      } else {
        throw new Error('Cannot verify shift creation')
      }
    } catch (e) {
      console.warn('Shift verification failed:', e)
      this.notify('warning', 'Verificación fallida', 'El turno se inició pero no se pudo verificar')
    }
  }
  
  /**
   * Finaliza el turno actual
   */
  async endShift(reportData = {}, force = false) {
    if (this.locks.ending) {
      console.warn('End already in progress')
      return { success: false, error: 'End already in progress' }
    }
    
    if (!this.state.isWorking || !this.state.currentShiftId) {
      console.warn('No active shift to end')
      return { success: false, error: 'No active shift to end' }
    }
    
    this.locks.ending = true
    
    try {
      const payload = {
        ...reportData,
        force
      }
      
      const response = await this.makeRequest(`/shifts/${this.state.currentShiftId}/end`, 'POST', payload)

      if (response.status === 401) {
        this.locks.ending = false
        return { success: false, error: 'Tu sesión expiró. Volvé a iniciar sesión para cerrar el turno.', code: 'AUTH' }
      }

      if (response.status === 412) {
        // Precondition failed - shift incomplete
        const error = await response.json()
        this.locks.ending = false
        return { success: false, error: error.message, code: 'INCOMPLETE' }
      }
      
      if (!response.ok) {
        const error = await this.parseError(response)
        throw new Error(error)
      }
      
      const result = await response.json()
      
      this.stopAllTimers()
      this.resetState()
      this.persistState()
      this.notifyStateChange()
      
      this.notify('success', 'Turno finalizado', 'Turno cerrado correctamente')
      
      console.log('Shift ended successfully:', result)
      return { success: true, result }
      
    } catch (e) {
      console.error('Failed to end shift:', e)
      this.notify('error', 'Error al finalizar turno', e.message)
      return { success: false, error: e.message }
    } finally {
      this.locks.ending = false
    }
  }
  
  /**
   * Alterna pausa/break
   */
  async toggleBreak() {
    if (!this.state.isWorking || !this.state.currentShiftId) {
      return { success: false, error: 'No active shift' }
    }
    
    try {
      const endpoint = this.state.isPaused ? 'resume' : 'pause'
      const response = await this.makeRequest(`/shifts/${this.state.currentShiftId}/${endpoint}`, 'POST')

      if (response.status === 401) {
        return { success: false, error: 'Tu sesión expiró. Volvé a iniciar sesión.', code: 'AUTH' }
      }

      if (!response.ok) {
        const error = await this.parseError(response)
        throw new Error(error)
      }
      
      this.state.isPaused = !this.state.isPaused
      
      if (this.state.isPaused) {
        this.stopTimer('work')
        this.startTimer('break')
        this.notify('info', 'Break iniciado', 'Pausa activada')
      } else {
        this.stopTimer('break')
        this.startTimer('work')
        this.notify('success', 'Break finalizado', 'Trabajo reanudado')
      }
      
      this.persistState()
      this.notifyStateChange()
      
      return { success: true }
      
    } catch (e) {
      console.error('Failed to toggle break:', e)
      this.notify('error', 'Error en break', e.message)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Inicia todos los timers necesarios
   */
  startAllTimers() {
    this.startTimer('work')
    this.startTimer('sync')
    this.startTimer('screenshot')
    this.startTimer('healthCheck')
  }
  
  /**
   * Detiene todos los timers
   */
  stopAllTimers() {
    Object.keys(this.timers).forEach(timer => this.stopTimer(timer))
  }
  
  /**
   * Inicia un timer específico
   */
  startTimer(type) {
    this.stopTimer(type) // Asegurar que no hay duplicados
    
    switch (type) {
      case 'work':
        if (!this.state.isPaused) {
          this.timers.work = setInterval(() => {
            if (this.state.isWorking && !this.state.isPaused) {
              this.state.workTime++
              if (this.state.isAfk) {
                this.state.idleTime++
              }
              this.persistState()
              this.notifyStateChange()
            }
          }, 1000)
        }
        break
        
      case 'break':
        this.timers.break = setInterval(() => {
          if (this.state.isWorking && this.state.isPaused) {
            this.state.breakTime++
            this.persistState()
            this.notifyStateChange()
          }
        }, 1000)
        break
        
      case 'sync':
        this.timers.sync = setInterval(() => {
          this.syncWithServer()
        }, this.config.syncInterval)
        break
        
      case 'screenshot':
        this.timers.screenshot = setInterval(() => {
          this.captureScreenshot()
        }, this.config.screenshotInterval)
        break
        
      case 'healthCheck':
        this.timers.healthCheck = setInterval(() => {
          this.performHealthCheck()
        }, this.config.healthCheckInterval)
        break
    }
  }
  
  /**
   * Detiene un timer específico
   */
  stopTimer(type) {
    if (this.timers[type]) {
      clearInterval(this.timers[type])
      this.timers[type] = null
    }
  }
  
  /**
   * Sincroniza con el servidor
   */
  async syncWithServer() {
    if (this.locks.syncing || !this.state.isWorking || !this.state.currentShiftId) {
      return
    }
    
    this.locks.syncing = true
    
    try {
      // Obtener datos del sistema si están disponibles
      let systemData = {}
      if (window.electronAPI?.screen) {
        try {
          const idleTime = await window.electronAPI.screen.getIdleTime()
          const activeApp = await window.electronAPI.screen.getActiveWindowName()
          
          // Actualizar estado AFK
          if (idleTime > 60 && !this.state.isAfk) {
            this.state.isAfk = true
            this.notifyStateChange()
          } else if (idleTime < 10 && this.state.isAfk) {
            this.state.isAfk = false
            this.notifyStateChange()
          }
          
          // El tiempo que cuenta para la meta del turno es el EFECTIVO
          // (trabajado − AFK). Antes mandábamos workTime (incluía el AFK), por lo
          // que el AFK no descontaba realmente del cierre. Ahora el AFK sí resta.
          const effectiveSeconds = Math.max(0, this.state.workTime - this.state.idleTime)

          systemData = {
            activeApp,
            idleTimeSeconds: this.state.idleTime,
            activeTimeSeconds: effectiveSeconds,
            breakTimeSeconds: this.state.breakTime,
            isAfk: this.state.isAfk
          }
        } catch (e) {
          console.warn('Failed to get system data:', e)
        }
      }
      
      const response = await this.makeRequest(`/shifts/${this.state.currentShiftId}/sync-app`, 'POST', systemData)
      
      if (response.ok) {
        const updatedShift = await response.json()

        // Reconciliación con el servidor (fuente de verdad si tiene más tiempo).
        // OJO: el servidor guarda activeTimeSeconds como tiempo EFECTIVO (ya sin AFK),
        // mientras que localmente llevamos workTime BRUTO. Para no doble-restar el AFK,
        // reconstruimos el bruto como efectivo_servidor + idle local.
        if (updatedShift.idleTimeSeconds > this.state.idleTime) {
          this.state.idleTime = updatedShift.idleTimeSeconds
        }
        if (typeof updatedShift.activeTimeSeconds === 'number') {
          const localEffective = Math.max(0, this.state.workTime - this.state.idleTime)
          if (updatedShift.activeTimeSeconds > localEffective) {
            this.state.workTime = updatedShift.activeTimeSeconds + this.state.idleTime
          }
        }
        if (updatedShift.breakTimeSeconds > this.state.breakTime) {
          this.state.breakTime = updatedShift.breakTimeSeconds
        }

        this.state.lastSyncTime = Date.now()
        this.persistState()
        this.notifyStateChange()
      }
      
    } catch (e) {
      console.warn('Sync failed:', e)
    } finally {
      this.locks.syncing = false
    }
  }
  
  /**
   * Captura screenshot
   */
  async captureScreenshot() {
    if (!this.state.isWorking || this.state.isPaused || !this.state.currentShiftId) {
      return
    }
    
    try {
      if (window.electronAPI?.screen) {
        const screenshots = await window.electronAPI.screen.takeScreenshot({
          quality: 0.5,
          maxWidth: 800,
          maxHeight: 450
        })
        
        if (screenshots?.length > 0) {
          await this.makeRequest(`/shifts/${this.state.currentShiftId}/upload-screenshot`, 'POST', {
            image: JSON.stringify(screenshots.map(s => s.image))
          })
        }
      }
    } catch (e) {
      console.warn('Screenshot failed:', e)
    }
  }
  
  /**
   * Verifica salud de la conexión
   */
  async performHealthCheck() {
    if (!this.state.isWorking || !this.state.currentShiftId) {
      return
    }
    
    try {
      const response = await this.makeRequest('/shifts/current', 'GET')
      
      if (response.status === 204) {
        // El shift fue terminado externamente
        this.notify('warning', 'Turno terminado', 'El turno fue cerrado por un administrador')
        this.stopAllTimers()
        this.resetState()
        this.persistState()
        this.notifyStateChange()
        return
      }
      
      if (response.ok) {
        const shift = await response.json()
        
        // Verificar mensajes pendientes
        if (shift.pendingMessage) {
          this.notify('info', 'Mensaje del administrador', shift.pendingMessage)
          // Limpiar mensaje
          await this.makeRequest(`/shifts/${this.state.currentShiftId}/clear-message`, 'POST')
        }
        
        // Verificar solicitud de screenshot
        if (shift.screenshotRequested) {
          console.log('Screenshot requested by admin')
          this.captureScreenshot()
        }
      }
      
    } catch (e) {
      console.warn('Health check failed:', e)
    }
  }
  
  /**
   * Realiza request HTTP con retry automático
   */
  async makeRequest(endpoint, method = 'GET', body = null, retries = 0) {
    try {
      const options = {
        method,
        headers: this.authHeaders()
      }
      
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
      }
      
      const response = await fetch(`${this.apiUrl}${endpoint}`, options)
      // 401 = token ausente/expirado (el backend ahora devuelve 401, no 403).
      // Disparamos el flujo de re-login una sola vez.
      if (response.status === 401) {
        this.handleAuthExpired()
      }
      return response

    } catch (e) {
      if (retries < this.config.maxRetries) {
        console.warn(`Request failed, retrying (${retries + 1}/${this.config.maxRetries}):`, e)
        await this.sleep(this.config.retryDelay * (retries + 1))
        return this.makeRequest(endpoint, method, body, retries + 1)
      }
      throw e
    }
  }
  
  /**
   * Maneja una sesión expirada (HTTP 401). Detiene los timers y avisa al
   * contenedor (composable) para que cierre sesión y mande al login. Se ejecuta
   * una sola vez por instancia para no spamear logout/reload.
   */
  handleAuthExpired() {
    if (this._authExpiredHandled) return
    this._authExpiredHandled = true
    this.stopAllTimers()
    this.notify('error', 'Sesión expirada', 'Tu sesión venció. Iniciá sesión de nuevo para continuar.')
    if (this.callbacks.onAuthExpired) {
      this.callbacks.onAuthExpired()
    }
  }

  /**
   * Parsea errores de respuesta HTTP
   */
  async parseError(response) {
    try {
      const error = await response.json()
      return error.message || error.error || `HTTP ${response.status}`
    } catch {
      return `HTTP ${response.status}`
    }
  }
  
  /**
   * Resetea el estado
   */
  resetState() {
    this.state = {
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
    }
  }
  
  /**
   * Notifica cambios de estado
   */
  notifyStateChange() {
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }
  }
  
  /**
   * Envía notificación
   */
  notify(type, title, message) {
    if (this.callbacks.onNotification) {
      this.callbacks.onNotification(type, title, message)
    }
  }
  
  /**
   * Utilidad para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Obtiene el estado actual
   */
  getState() {
    return { ...this.state }
  }
  
  /**
   * Limpia recursos al destruir
   */
  destroy() {
    this.stopAllTimers()
    this.persistState()
  }
}

export default ShiftManager