const { app, BrowserWindow, ipcMain, desktopCapturer, powerMonitor, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'

// Load optimization config
let optimizationConfig = { isLowRAM: false, optimizations: {} }
try {
  const configPath = path.join(__dirname, 'optimization-config.json')
  if (fs.existsSync(configPath)) {
    optimizationConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    console.log(`[Optimization] Loaded config: ${optimizationConfig.totalRAM}GB RAM, Low RAM: ${optimizationConfig.isLowRAM}`)
  }
} catch (e) {
  console.log('[Optimization] Using default config')
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false
autoUpdater.logger = require('electron').app ? null : null

// Check for updates every 30 minutes
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000

autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] Checking for update...')
})

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] Update available:', info.version)
  mainWindow?.webContents.send('updater:status', { 
    type: 'available', 
    info,
    message: `Nueva versión ${info.version} disponible. Descargando...`
  })
})

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] No update available. Current:', info.version)
})

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent)
  console.log(`[AutoUpdater] Download: ${percent}%`)
  mainWindow?.webContents.send('updater:progress', { percent })
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded:', info.version)
  mainWindow?.webContents.send('updater:status', { 
    type: 'ready', 
    info,
    message: `Versión ${info.version} lista. Se instalará al cerrar la app.`
  })
  
  // Auto-install after 5 seconds if no user interaction
  setTimeout(() => {
    if (!app.isQuitting) {
      console.log('[AutoUpdater] Auto-installing update...')
      autoUpdater.quitAndInstall()
    }
  }, 5000)
})

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err?.message || err)
  console.error('[AutoUpdater] Stack:', err?.stack)
  mainWindow?.webContents.send('updater:status', { 
    type: 'error', 
    message: 'Error al buscar actualizaciones'
  })
})

// El renderer puede pedirle al main que instale y reinicie
ipcMain.on('updater:install-now', () => {
  console.log('[AutoUpdater] Manual install requested')
  autoUpdater.quitAndInstall()
})

ipcMain.on('updater:check-now', () => {
  console.log('[AutoUpdater] Manual check requested')
  if (!isDev) {
    autoUpdater.checkForUpdates().catch(e => 
      console.error('[AutoUpdater] Manual check error:', e?.message)
    )
  }
})

// Verificar actualizaciones periódicamente
setInterval(() => {
  if (!isDev && !app.isQuitting) {
    console.log('[AutoUpdater] Periodic check triggered')
    autoUpdater.checkForUpdates().catch(e => 
      console.error('[AutoUpdater] Periodic check error:', e?.message)
    )
  }
}, UPDATE_CHECK_INTERVAL)

let mainWindow = null
let tray = null
let isShiftActive = false
let shiftTimerSeconds = 0
let shiftTimerInterval = null

// Helper to get asset path (public in dev, dist in prod)
function getAssetPath(filename) {
  return path.join(__dirname, isDev ? '../public' : '../dist', filename)
}

// Build tray icon using Essenza logo
function buildTrayIcon() {
  const iconPath = getAssetPath('essenza.ico')
  let icon = nativeImage.createFromPath(iconPath)
  
  // Resize to proper tray size
  const size = process.platform === 'darwin' ? 22 : 16
  icon = icon.resize({ width: size, height: size })
  
  return icon
}

function formatTrayTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

function updateTrayTooltip() {
  if (!tray) return
  const status = isShiftActive ? `Turno activo — ${formatTrayTime(shiftTimerSeconds)}` : 'Sin turno activo'
  tray.setToolTip(`Essenza Models\n${status}`)
  tray.setTitle(isShiftActive ? formatTrayTime(shiftTimerSeconds) : '')
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: isShiftActive
        ? `🟢 Trabajando — ${formatTrayTime(shiftTimerSeconds)}`
        : 'Sin turno activo',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Abrir Essenza',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Salir completamente',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])
}

function createTray() {
  tray = new Tray(buildTrayIcon())
  tray.setToolTip('Essenza Models')

  // Left-click → show/focus window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    }
  })

  tray.setContextMenu(buildContextMenu())

  // Refresh context menu every 5s so the time stays updated
  setInterval(() => {
    if (tray) {
      tray.setContextMenu(buildContextMenu())
      tray.setImage(buildTrayIcon())
      updateTrayTooltip()
    }
  }, 5000)
}

// ─── Main window ─────────────────────────────────────────────────────────────
app.setName('Essenza Models')

function createWindow() {
  const webPreferences = {
    backgroundThrottling: false,
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: !isDev,
    enableRemoteModule: false,
    sandbox: false,
    experimentalFeatures: false,
  }

  // Apply low-RAM optimizations if needed
  if (optimizationConfig.isLowRAM) {
    console.log('[Optimization] Applying low-RAM window settings')
    webPreferences.disableHardwareAcceleration = true
    webPreferences.enableWebSQL = false
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#08080f',
    icon: getAssetPath('essenza.ico'),
    webPreferences,
    show: false,
  })

  // Memory management for low-RAM systems
  if (optimizationConfig.isLowRAM && process.platform === 'win32') {
    console.log('[Optimization] Setting memory limits for Windows')
    app.commandLine.appendSwitch('--max-old-space-size', '512')
    app.commandLine.appendSwitch('--max-semi-space-size', '64')
    app.commandLine.appendSwitch('--memory-pressure-off')
    
    // Reduce GPU memory usage
    app.commandLine.appendSwitch('--disable-gpu-memory-buffer-video-frames')
    app.commandLine.appendSwitch('--disable-software-rasterizer')
    app.commandLine.appendSwitch('--disable-gpu-sandbox')
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Maximize / unmaximize state events
  mainWindow.on('maximize',   () => mainWindow.webContents.send('window:state-changed', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state-changed', false))

  // ──────────────────────────────────────────────────────────────────────────
  // KEY FIX: intercept the close event — hide to tray instead of quitting
  // unless app.isQuitting is set (i.e. user chose "Salir completamente")
  // ──────────────────────────────────────────────────────────────────────────
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()

      // Notify tray (Windows shows a balloon the first time)
      if (tray && isShiftActive) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'Essenza Monitor',
          content: '🟢 Tu turno sigue activo en segundo plano.',
        })
      }
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ─── IPC: Cache management ──────────────────────────────────────────────────
ipcMain.on('clear-cache', async () => {
  try {
    if (mainWindow) {
      const session = mainWindow.webContents.session
      
      // Clear all cache, cookies, and storage
      await session.clearCache()
      await session.clearStorageData({
        storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      })
      
      console.log('[Cache] Cleared all cache and storage')
    }
  } catch (err) {
    console.error('[Cache] Error clearing cache:', err)
  }
})

// ─── IPC: Window controls ────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window:close', () => {
  // Respect the close interceptor above — just call close (it will hide)
  mainWindow?.close()
})

ipcMain.handle('window:is-maximized', (e) =>
  BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
)

// ─── IPC: Notifications ──────────────────────────────────────────────────────
ipcMain.on('notification:send', (_e, { title, body, silent }) => {
  const { Notification } = require('electron')
  new Notification({ 
    title, 
    body, 
    silent: silent ?? false,
    icon: getAssetPath('icon.png')
  }).show()
})

// ─── IPC: Shift state (sent from renderer so tray stays in sync) ──────────
let backgroundSyncData = {
  apiUrl: '',
  token: '',
  shiftId: null,
  isPaused: false
}

async function performBackgroundSync() {
  if (!isShiftActive || backgroundSyncData.isPaused || !backgroundSyncData.token || !backgroundSyncData.shiftId) return

  try {
    const { net } = require('electron')
    const url = `${backgroundSyncData.apiUrl}/shifts/${backgroundSyncData.shiftId}/sync-app`
    
    // Get active app name from main process (more reliable)
    let activeApp = 'Sistema'
    try {
      const activeWin = await import('active-win')
      const win = await activeWin.default()
      if (win) {
        activeApp = win.owner?.name || win.title || 'Sistema';
      }
    } catch {}

    const idleTimeSeconds = powerMonitor.getSystemIdleTime()

    const request = net.request({
      method: 'POST',
      url: url,
    })
    request.setHeader('Authorization', `Bearer ${backgroundSyncData.token}`)
    request.setHeader('Content-Type', 'application/json')
    
    const payload = JSON.stringify({
      activeApp,
      idleTimeSeconds,
      activeTimeSeconds: shiftTimerSeconds
    })
    
    request.on('error', (err) => console.error('BG Sync Network Error:', err))
    request.write(payload)
    request.end()
  } catch (err) {
    console.error('Background sync failed:', err)
  }
}

// Global interval for background sync (every 10 seconds)
setInterval(() => {
  if (isShiftActive && !backgroundSyncData.isPaused) {
    performBackgroundSync()
  }
}, 10000)

ipcMain.on('shift:started', (_e, data) => {
  isShiftActive = true
  shiftTimerSeconds = 0
  
  if (data) {
    backgroundSyncData = { ...backgroundSyncData, ...data, isPaused: false }
  }

  if (shiftTimerInterval) clearInterval(shiftTimerInterval)
  shiftTimerInterval = setInterval(() => {
    if (!isShiftActive) {
      clearInterval(shiftTimerInterval)
      return
    }
    shiftTimerSeconds++
    updateTrayTooltip()
  }, 1000)
})

ipcMain.on('shift:stopped', () => {
  isShiftActive = false
  shiftTimerSeconds = 0
  backgroundSyncData = { apiUrl: '', token: '', shiftId: null, isPaused: false }
  
  if (shiftTimerInterval) {
    clearInterval(shiftTimerInterval)
    shiftTimerInterval = null
  }
  
  updateTrayTooltip()
})

ipcMain.on('shift:paused', () => {
  backgroundSyncData.isPaused = true
})

ipcMain.on('shift:resumed', () => {
  backgroundSyncData.isPaused = false
})

// Renderer can push the current seconds for resuming a recovered shift
ipcMain.on('shift:sync-time', (_e, data) => {
  if (typeof data === 'number') {
    shiftTimerSeconds = data
  } else if (data && typeof data === 'object') {
    shiftTimerSeconds = data.seconds || shiftTimerSeconds
    if (data.token) backgroundSyncData.token = data.token
    if (data.apiUrl) backgroundSyncData.apiUrl = data.apiUrl
    if (data.shiftId) backgroundSyncData.shiftId = data.shiftId
  }
})

// ─── IPC: Screen / activity ──────────────────────────────────────────────────
ipcMain.handle('get-screenshot', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 800, height: 450 } })
  return sources.map(source => ({
    name: source.name,
    id: source.id,
    image: source.thumbnail.toDataURL('image/jpeg', 0.5)
  }))
})

ipcMain.handle('get-idle-time', () => powerMonitor.getSystemIdleTime())

ipcMain.handle('get-active-window', async () => {
  try {
    const activeWin = await import('active-win')
    const win = await activeWin.default()
    if (win) {
      return win.owner?.name || win.title || 'Sistema';
    }
    return 'Sistema'
  } catch (e) {
    return 'Sistema'
  }
})

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Memory optimizations for low-RAM systems
  if (optimizationConfig.isLowRAM) {
    app.commandLine.appendSwitch('--disable-background-timer-throttling')
    app.commandLine.appendSwitch('--disable-renderer-backgrounding')
    app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows')
    app.commandLine.appendSwitch('--disable-dev-shm-usage')
    app.commandLine.appendSwitch('--no-sandbox')
  }
  
  createWindow()
  createTray()

  // Periodic memory cleanup (every 5 minutes for low-RAM, 10 minutes for normal)
  const cleanupInterval = optimizationConfig.isLowRAM ? 3 * 60 * 1000 : 10 * 60 * 1000
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Force garbage collection
      mainWindow.webContents.executeJavaScript(`
        if (window.gc) {
          window.gc();
        }
        // Clear old fetch cache
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => {
              if (name.includes('fetch') || name.includes('api')) {
                caches.delete(name);
              }
            });
          });
        }
        // Clear old console logs in low-RAM mode
        ${optimizationConfig.isLowRAM ? 'console.clear();' : ''}
      `).catch(() => {})
      
      if (optimizationConfig.isLowRAM) {
        // More aggressive cleanup for low-RAM systems
        mainWindow.webContents.session.clearCache().catch(() => {})
      }
    }
  }, cleanupInterval)

  // Buscar actualizaciones 5 segundos después de que la app cargue
  // (solo en producción, no en dev)
  if (!isDev) {
    app.setAppUserModelId('com.essenzamodels.monitor')
    setTimeout(() => autoUpdater.checkForUpdates(), 5000)
  }
})

// Prevent quitting when all windows are closed (we hide to tray instead)
app.on('window-all-closed', () => {
  // On macOS the convention is to keep the app open until the user quits explicitly
  if (process.platform === 'darwin') return
  // On Windows/Linux: do NOT quit — we live in the tray
  // (app.quit() will only be called when "Salir completamente" is clicked)
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

app.on('before-quit', () => {
  app.isQuitting = true
})
