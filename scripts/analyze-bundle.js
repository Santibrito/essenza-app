#!/usr/bin/env node

/**
 * Script para analizar el tamaño del bundle y sugerir optimizaciones
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function analyzeBundle() {
  console.log('🔍 Analizando bundle de ESSENZA-APP...\n')
  
  const distPath = path.join(__dirname, '..', 'dist')
  
  if (!fs.existsSync(distPath)) {
    console.log('❌ No se encontró la carpeta dist. Ejecuta npm run build primero.')
    return
  }
  
  const analysis = {
    totalSize: 0,
    files: [],
    byType: {
      js: { count: 0, size: 0 },
      css: { count: 0, size: 0 },
      images: { count: 0, size: 0 },
      other: { count: 0, size: 0 }
    }
  }
  
  function analyzeDirectory(dir, relativePath = '') {
    const files = fs.readdirSync(dir)
    
    files.forEach(file => {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)
      const relativeFilePath = path.join(relativePath, file)
      
      if (stats.isDirectory()) {
        analyzeDirectory(filePath, relativeFilePath)
      } else {
        const sizeKB = Math.round(stats.size / 1024)
        analysis.totalSize += stats.size
        
        const fileInfo = {
          path: relativeFilePath,
          size: sizeKB,
          sizeBytes: stats.size
        }
        
        analysis.files.push(fileInfo)
        
        // Categorize by type
        const ext = path.extname(file).toLowerCase()
        if (['.js', '.mjs'].includes(ext)) {
          analysis.byType.js.count++
          analysis.byType.js.size += stats.size
        } else if (['.css'].includes(ext)) {
          analysis.byType.css.count++
          analysis.byType.css.size += stats.size
        } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
          analysis.byType.images.count++
          analysis.byType.images.size += stats.size
        } else {
          analysis.byType.other.count++
          analysis.byType.other.size += stats.size
        }
      }
    })
  }
  
  analyzeDirectory(distPath)
  
  // Sort files by size (largest first)
  analysis.files.sort((a, b) => b.sizeBytes - a.sizeBytes)
  
  // Display results
  console.log('📊 RESUMEN DEL BUNDLE')
  console.log('='.repeat(50))
  console.log(`📦 Tamaño total: ${Math.round(analysis.totalSize / 1024 / 1024 * 100) / 100} MB`)
  console.log(`📁 Total de archivos: ${analysis.files.length}`)
  console.log()
  
  console.log('📋 POR TIPO DE ARCHIVO')
  console.log('-'.repeat(30))
  Object.entries(analysis.byType).forEach(([type, data]) => {
    const sizeMB = Math.round(data.size / 1024 / 1024 * 100) / 100
    console.log(`${type.toUpperCase().padEnd(8)} ${data.count.toString().padStart(3)} archivos  ${sizeMB.toString().padStart(6)} MB`)
  })
  console.log()
  
  console.log('🔝 ARCHIVOS MÁS PESADOS (Top 10)')
  console.log('-'.repeat(40))
  analysis.files.slice(0, 10).forEach((file, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${file.path.padEnd(30)} ${file.size.toString().padStart(6)} KB`)
  })
  console.log()
  
  // Recommendations
  console.log('💡 RECOMENDACIONES')
  console.log('-'.repeat(20))
  
  const totalSizeMB = analysis.totalSize / 1024 / 1024
  const jsSize = analysis.byType.js.size / 1024 / 1024
  const cssSize = analysis.byType.css.size / 1024 / 1024
  const imageSize = analysis.byType.images.size / 1024 / 1024
  
  if (totalSizeMB > 15) {
    console.log('⚠️  Bundle muy grande (>15MB)')
    console.log('   - Considera lazy loading más agresivo')
    console.log('   - Revisa dependencias no utilizadas')
  }
  
  if (jsSize > 8) {
    console.log('⚠️  JavaScript muy pesado (>8MB)')
    console.log('   - Implementa code splitting')
    console.log('   - Usa tree shaking más agresivo')
  }
  
  if (imageSize > 2) {
    console.log('⚠️  Imágenes muy pesadas (>2MB)')
    console.log('   - Optimiza imágenes con herramientas como TinyPNG')
    console.log('   - Considera usar WebP')
  }
  
  const largeFiles = analysis.files.filter(f => f.size > 500)
  if (largeFiles.length > 0) {
    console.log(`⚠️  ${largeFiles.length} archivos >500KB detectados`)
    console.log('   - Revisa si se pueden dividir o comprimir')
  }
  
  if (totalSizeMB < 10) {
    console.log('✅ Bundle optimizado correctamente')
  }
  
  console.log()
  console.log('🎯 OBJETIVOS RECOMENDADOS')
  console.log('-'.repeat(25))
  console.log('📦 Bundle total: <10MB')
  console.log('🟨 JavaScript: <5MB')
  console.log('🎨 CSS: <1MB')
  console.log('🖼️  Imágenes: <1MB')
  console.log('📁 Archivos individuales: <500KB')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeBundle()
}

export { analyzeBundle }