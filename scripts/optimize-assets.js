#!/usr/bin/env node

/**
 * Script para optimizar assets de ESSENZA-APP
 * Reduce el tamaño de imágenes y elimina archivos innecesarios
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getFileSizeKB(filePath) {
  try {
    const stats = fs.statSync(filePath)
    return Math.round(stats.size / 1024)
  } catch {
    return 0
  }
}

function optimizeAssets() {
  console.log('[Asset Optimizer] Analizando assets...')
  
  const publicDir = path.join(__dirname, '..', 'public')
  const files = fs.readdirSync(publicDir)
  
  let totalSizeBefore = 0
  let totalSizeAfter = 0
  
  files.forEach(file => {
    const filePath = path.join(publicDir, file)
    const sizeBefore = getFileSizeKB(filePath)
    totalSizeBefore += sizeBefore
    
    console.log(`📁 ${file}: ${sizeBefore}KB`)
    
    // Optimizaciones específicas
    if (file === 'icon.png' && sizeBefore > 50) {
      console.log(`⚠️  ${file} es muy pesado (${sizeBefore}KB). Considera optimizarlo con:`)
      console.log(`   - Reducir resolución a 256x256 o 512x512`)
      console.log(`   - Usar herramientas como TinyPNG o ImageOptim`)
      console.log(`   - Convertir a WebP si es posible`)
    }
  })
  
  console.log(`\n📊 Tamaño total de assets: ${totalSizeBefore}KB`)
  
  // Verificar si hay archivos innecesarios en dist
  const distDir = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(distDir)) {
    console.log('\n🔍 Analizando build output...')
    analyzeDistSize(distDir)
  }
}

function analyzeDistSize(distDir) {
  function getDirSize(dir) {
    let size = 0
    const files = fs.readdirSync(dir)
    
    files.forEach(file => {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)
      
      if (stats.isDirectory()) {
        size += getDirSize(filePath)
      } else {
        size += stats.size
      }
    })
    
    return size
  }
  
  const totalSize = getDirSize(distDir)
  const totalSizeMB = Math.round(totalSize / (1024 * 1024) * 100) / 100
  
  console.log(`📦 Tamaño total del build: ${totalSizeMB}MB`)
  
  if (totalSizeMB > 10) {
    console.log('⚠️  El build es grande. Considera:')
    console.log('   - Tree shaking más agresivo')
    console.log('   - Lazy loading de componentes')
    console.log('   - Eliminar dependencias no utilizadas')
  }
}

// Crear configuración de optimización para electron-builder
function createElectronBuilderOptimizations() {
  const packagePath = path.join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  
  // Optimizaciones para electron-builder
  packageJson.build = {
    ...packageJson.build,
    compression: 'maximum',
    nsis: {
      ...packageJson.build.nsis,
      differentialPackage: true
    },
    // Excluir archivos innecesarios
    files: [
      'dist/**/*',
      'electron/**/*',
      'package.json',
      '!node_modules/**/*',
      '!src/**/*',
      '!scripts/**/*',
      '!*.md',
      '!*.log'
    ],
    // Optimizar asar
    asar: {
      smartUnpack: false
    }
  }
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
  console.log('✅ Configuración de electron-builder optimizada')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  optimizeAssets()
  createElectronBuilderOptimizations()
}

export {
  optimizeAssets,
  getFileSizeKB
}