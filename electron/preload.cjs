const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize:      () => ipcRenderer.send('window:minimize'),
    maximize:      () => ipcRenderer.send('window:maximize'),
    close:         () => ipcRenderer.send('window:close'),
    isMaximized:   () => ipcRenderer.invoke('window:is-maximized'),
    onStateChanged: (cb) => {
      ipcRenderer.on('window:state-changed', (_event, isMaximized) => cb(isMaximized))
      return () => ipcRenderer.removeAllListeners('window:state-changed')
    },
  },
  screen: {
    takeScreenshot:      () => ipcRenderer.invoke('get-screenshot'),
    getIdleTime:         () => ipcRenderer.invoke('get-idle-time'),
    getActiveWindowName: () => ipcRenderer.invoke('get-active-window'),
  },
  shift: {
    // Notify main process so the tray stays in sync
    started:   (data)   => ipcRenderer.send('shift:started', data),
    stopped:   ()       => ipcRenderer.send('shift:stopped'),
    paused:    ()       => ipcRenderer.send('shift:paused'),
    resumed:   ()       => ipcRenderer.send('shift:resumed'),
    syncTime:  (data)   => ipcRenderer.send('shift:sync-time', data),
  },
  sendNotification: (payload) => ipcRenderer.send('notification:send', payload),
  
  // ─── Cache management ────────────────────────────────────────────────────
  clearCache: () => ipcRenderer.send('clear-cache'),

  // ─── Auto Updater ────────────────────────────────────────────────────────
  updater: {
    onStatusChange: (cb) => {
      ipcRenderer.on('updater:status', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('updater:status')
    },
    onProgress: (cb) => {
      ipcRenderer.on('updater:progress', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('updater:progress')
    },
    installNow: () => ipcRenderer.send('updater:install-now'),
    checkNow: () => ipcRenderer.send('updater:check-now'),
  },
})
