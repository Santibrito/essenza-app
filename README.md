# ESSENZA MODELS - Desktop App

Aplicación de escritorio para ESSENZA MODELS.

## 🚀 Desarrollo

```bash
npm install
npm run dev
```

## 📦 Crear Nuevo Release (Automático)

### Opción 1: Script (Recomendado)

**Windows:**
```bash
release.bat 1.0.1
git add .
git commit -m "chore: release v1.0.1"
git push
```

**Linux/Mac:**
```bash
./release.sh 1.0.1
git add .
git commit -m "chore: release v1.0.1"
git push
```

### Opción 2: Manual

1. Cambiar versión en `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. Cambiar versión en `.env`:
   ```env
   VITE_APP_VERSION=v1.0.1
   ```

3. Push:
   ```bash
   git add .
   git commit -m "chore: release v1.0.1"
   git push
   ```

## 🤖 Build Automático

Cuando hacés push con una nueva versión en `package.json`:

1. ✅ GitHub Actions detecta el cambio
2. ✅ Compila automáticamente:
   - Windows: `ESSENZA MODELS_Setup_1.0.1.exe`
   - macOS: `ESSENZA MODELS_Setup_1.0.1.dmg`
3. ✅ Crea un Release en GitHub con los instaladores
4. ✅ Los usuarios reciben la actualización automáticamente

**Ver progreso:** https://github.com/Santibrito/essenza-app/actions

**Ver releases:** https://github.com/Santibrito/essenza-app/releases

## ⏱️ Tiempo de Build

- El build automático tarda ~5-10 minutos
- Recibirás un email cuando termine
- Los instaladores aparecen en la sección Releases

## 🔧 Build Local (Opcional)

Si querés compilar localmente en lugar de usar GitHub Actions:

```bash
npm run build
npm run dist
```

Esto crea los instaladores en `release/VERSION/`

