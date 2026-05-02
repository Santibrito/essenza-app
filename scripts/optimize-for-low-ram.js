#!/usr/bin/env node

/**
 * Script para optimizar ESSENZA-APP en sistemas con poca RAM
 * Se ejecuta automáticamente al iniciar la app
 */

import os from 'os'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getTotalRAM() {
  return Math.round(os.totalmem() / (1024 * 1024 * 1024)) // GB
}

function isLowRAMSystem() {
  const totalRAM = getTotalRAM()
  console.log(`[RAM Check] Sistema detectado con ${totalRAM}GB de RAM`)
  return totalRAM <= 6 // 6GB o menos se considera "low RAM"
}

function setEnvironmentOptimizations() {
  if (isLowRAMSystem()) {
    console.log('[Optimization] Aplicando optimizaciones para sistemas con poca RAM...')
    
    // Set environment variables for Electron
    process.env.DISABLE_GPU = 'true'
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
    process.env.ELECTRON_NO_ATTACH_CONSOLE = 'true'
    
    // Chrome flags for memory optimization
    process.env.ELECTRON_EXTRA_LAUNCH_ARGS = [
      '--memory-pressure-off',
      '--max-old-space-size=512',
      '--max-semi-space-size=64',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-gpu-memory-buffer-video-frames',
      '--disable-software-rasterizer'
    ].join(' ')
    
    console.log('[Optimization] ✅ Optimizaciones aplicadas')
  } else {
    console.log('[Optimization] Sistema con RAM suficiente, usando configuración estándar')
  }
}

// Crear archivo de configuración para el main process
function createOptimizationConfig() {
  const config = {
    isLowRAM: isLowRAMSystem(),
    totalRAM: getTotalRAM(),
    timestamp: new Date().toISOString(),
    optimizations: {
      disableGPU: isLowRAMSystem(),
      memoryLimits: isLowRAMSystem(),
      backgroundThrottling: isLowRAMSystem()
    }
  }
  
  const configPath = path.join(__dirname, '..', 'optimization-config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`[Config] Configuración guardada en ${configPath}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setEnvironmentOptimizations()
  createOptimizationConfig()
}

export {
  isLowRAMSystem,
  getTotalRAM,
  setEnvironmentOptimizations,
  createOptimizationConfig
}