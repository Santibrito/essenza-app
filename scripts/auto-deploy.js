#!/usr/bin/env node

/**
 * Script de deploy SÚPER AUTOMÁTICO para ESSENZA-APP
 * Un solo comando hace todo: versiona, buildea, commitea, pushea y publica
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
    return true
  } catch (error) {
    console.error(`❌ Error en ${description}:`, error.message)
    return false
  }
}

function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { 
      encoding: 'utf8', 
      cwd: path.join(__dirname, '..') 
    })
    return status.trim().length === 0
  } catch {
    return false
  }
}

function autoDeploy(versionType = 'patch', message = '') {
  console.log('🚀 DEPLOY AUTOMÁTICO DE ESSENZA-APP')
  console.log('=' .repeat(50))
  
  const currentVersion = getCurrentVersion()
  const newVersion = incrementVersion(versionType)
  
  console.log(`📦 Versión actual: ${currentVersion}`)
  console.log(`📦 Nueva versión: ${newVersion}`)
  console.log(`💬 Mensaje: ${message || 'Release automático'}`)
  console.log('')
  
  // Verificar estado de git
  if (!checkGitStatus()) {
    console.log('⚠️  Hay cambios sin commitear. Agregándolos automáticamente...')
  }
  
  // 1. Actualizar versión
  updateVersion(newVersion)
  
  // 2. Agregar todos los cambios
  runCommand('git add .', 'Agregando cambios')
  
  // 3. Commit con mensaje automático
  const commitMessage = message || `🚀 Release v${newVersion} - Deploy automático`
  runCommand(`git commit -m "${commitMessage}"`, 'Commit de cambios')
  
  // 4. Push a main (esto dispara GitHub Actions automáticamente)
  if (runCommand('git push origin main', 'Push a GitHub')) {
    console.log('')
    console.log('🎉 DEPLOY COMPLETADO!')
    console.log('=' .repeat(50))
    console.log(`✅ Versión ${newVersion} pusheada a GitHub`)
    console.log(`🤖 GitHub Actions está buildeando automáticamente:`)
    console.log(`   • Windows (.exe)`)
    console.log(`   • macOS (.dmg)`)
    console.log('')
    console.log(`🔗 Ver progreso: https://github.com/santibdev/ESSENZA-APP/actions`)
    console.log(`📦 Releases: https://github.com/santibdev/ESSENZA-APP/releases`)
    console.log('')
    console.log(`⏱️  El build tarda ~5-10 minutos. Los usuarios recibirán`)
    console.log(`   la actualización automáticamente cuando esté listo.`)
  }
}

// CLI interface
const args = process.argv.slice(2)
const versionType = args[0] || 'patch'
const message = args.slice(1).join(' ')

if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 AUTO-DEPLOY para ESSENZA-APP

Un solo comando hace TODO:
• Incrementa versión
• Commitea cambios  
• Pushea a GitHub
• GitHub Actions buildea Windows + Mac automáticamente
• Usuarios reciben actualización automática

Uso:
  npm run auto-deploy [tipo] [mensaje]
  
Tipos:
  patch  - 1.0.0 → 1.0.1 (default)
  minor  - 1.0.0 → 1.1.0  
  major  - 1.0.0 → 2.0.0

Ejemplos:
  npm run auto-deploy
  npm run auto-deploy patch "Fix dropdown positioning"
  npm run auto-deploy minor "Nueva funcionalidad de screenshots"
  npm run auto-deploy major "Rediseño completo"
`)
    process.exit(0)
  }
  
  autoDeploy(versionType, message)
}