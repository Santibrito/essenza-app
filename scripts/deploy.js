#!/usr/bin/env node

/**
 * Script de deploy automatizado para ESSENZA-APP
 * Maneja versionado, build y publicación a GitHub releases
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packagePath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

function getCurrentVersion() {
  return packageJson.version
}

function incrementVersion(type = 'patch') {
  const [major, minor, patch] = packageJson.version.split('.').map(Number)
  
  let newVersion
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`
      break
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`
      break
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`
      break
  }
  
  return newVersion
}

function updateVersion(newVersion) {
  packageJson.version = newVersion
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
  console.log(`✅ Versión actualizada a ${newVersion}`)
}

function runCommand(command, description) {
  console.log(`🔄 ${description}...`)
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log(`✅ ${description} completado`)
  } catch (error) {
    console.error(`❌ Error en ${description}:`, error.message)
    process.exit(1)
  }
}

function deploy(versionType = 'patch', releaseNotes = '') {
  console.log('🚀 Iniciando deploy de ESSENZA-APP...\n')
  
  const currentVersion = getCurrentVersion()
  const newVersion = incrementVersion(versionType)
  
  console.log(`📦 Versión actual: ${currentVersion}`)
  console.log(`📦 Nueva versión: ${newVersion}\n`)
  
  // 1. Actualizar versión
  updateVersion(newVersion)
  
  // 2. Build optimizado
  runCommand('npm run build', 'Build optimizado')
  
  // 3. Commit cambios
  runCommand('git add .', 'Staging cambios')
  runCommand(`git commit -m "Release v${newVersion}"`, 'Commit de release')
  
  // 4. Crear tag
  runCommand(`git tag v${newVersion}`, 'Creación de tag')
  
  // 5. Push cambios y tag
  runCommand('git push origin main', 'Push a main')
  runCommand(`git push origin v${newVersion}`, 'Push del tag')
  
  // 6. Build y publish con electron-builder
  const publishCommand = releaseNotes 
    ? `npm run dist -- --publish always -c.releaseInfo.releaseNotes="${releaseNotes}"`
    : 'npm run dist -- --publish always'
    
  runCommand(publishCommand, 'Build y publicación a GitHub releases')
  
  console.log('\n🎉 Deploy completado exitosamente!')
  console.log(`📦 Versión ${newVersion} publicada en GitHub releases`)
  console.log(`🔗 Los usuarios recibirán la actualización automáticamente`)
  console.log(`\n💡 Para verificar: https://github.com/santibdev/ESSENZA-APP/releases/tag/v${newVersion}`)
}

// CLI interface
const args = process.argv.slice(2)
const versionType = args[0] || 'patch' // patch, minor, major
const releaseNotes = args[1] || ''

if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 Deploy Script para ESSENZA-APP

Uso:
  npm run deploy [tipo] [notas]
  
Tipos de versión:
  patch  - 1.0.0 → 1.0.1 (default)
  minor  - 1.0.0 → 1.1.0  
  major  - 1.0.0 → 2.0.0

Ejemplos:
  npm run deploy
  npm run deploy patch
  npm run deploy minor "Nuevas funcionalidades de customs"
  npm run deploy major "Rediseño completo de la UI"
`)
    process.exit(0)
  }
  
  deploy(versionType, releaseNotes)
}

export { deploy, incrementVersion, getCurrentVersion }