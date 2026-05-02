# ✅ Checklist de Configuración para GitHub

## Antes de subir al repositorio

### 1. Configuración de GitHub

- [ ] Crear nuevo repositorio en GitHub (público o privado)
- [ ] Copiar la URL del repo: `https://github.com/TU_USUARIO/TU_REPO.git`

### 2. Actualizar `package.json`

Abrir `package.json` y cambiar en la sección `build.publish`:

```json
"publish": {
  "provider": "github",
  "owner": "TU_USUARIO_GITHUB",     // ← Cambiar esto
  "repo": "TU_NUEVO_REPO",          // ← Cambiar esto
  "releaseType": "release"
}
```

### 3. Crear GitHub Token

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token (classic)"
3. Nombre: `ESSENZA_APP_DEPLOY`
4. Seleccionar permisos:
   - ✅ `repo` (todos los sub-permisos)
   - ✅ `write:packages`
5. Click "Generate token"
6. **COPIAR EL TOKEN** (solo se muestra una vez)

### 4. Configurar `.env`

Abrir `.env` y actualizar:

```env
PORT=5173
VITE_API_BASE_URL=https://crm-app.up.railway.app/api/v1
VITE_JWT_SECRET=aPkGuyIk4otskytFMXp62JSobpvuA4K5fp1QTTYSp4b
VITE_APP_MODE=production
GH_TOKEN=TU_TOKEN_COPIADO_AQUI                    # ← Pegar el token de GitHub
VITE_APP_VERSION=v1.3.35
```

### 5. Verificar `.gitignore`

Asegurarse que `.gitignore` incluya:

```
node_modules
dist
dist-electron
release
.env              # ← CRÍTICO: NO subir secretos
.env.*
*.exe
*.dmg
*.AppImage
*.pkg
```

### 6. Limpiar archivos sensibles

Antes de hacer el primer commit:

```bash
# Eliminar builds antiguos
rm -rf release/*
rm -rf dist/*

# Verificar que .env NO esté en staging
git status

# Si .env aparece, asegurarse que esté en .gitignore
```

### 7. Primer commit y push

```bash
# Inicializar git (si no está inicializado)
git init

# Agregar remote
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git

# Primer commit
git add .
git commit -m "Initial commit: Essenza Models Desktop App"

# Push
git branch -M main
git push -u origin main
```

### 8. Probar deploy

```bash
# Instalar dependencias
npm install

# Probar build local
npm run build

# Probar distribución local (sin publicar)
npm run dist

# Si todo funciona, hacer deploy a GitHub
npm run ship
```

## ⚠️ IMPORTANTE - Seguridad

### ❌ NUNCA subir a GitHub:

- `.env` (contiene tokens y secretos)
- `node_modules/` (muy pesado)
- `release/` (binarios compilados)
- `dist/` (build de Vite)
- Archivos `.exe`, `.dmg`, `.AppImage`

### ✅ SÍ subir a GitHub:

- `.env.example` (template sin secretos)
- Código fuente (`src/`, `electron/`, etc.)
- Configuración (`package.json`, `vite.config.js`, etc.)
- README.md y documentación

## 🔄 Workflow de Deploy

1. **Desarrollo local**
   ```bash
   npm run dev
   ```

2. **Commit cambios**
   ```bash
   git add .
   git commit -m "feat: nueva funcionalidad"
   git push
   ```

3. **Deploy nueva versión**
   ```bash
   npm run ship           # Incrementa patch (1.3.35 → 1.3.36)
   npm run ship:minor     # Incrementa minor (1.3.35 → 1.4.0)
   npm run ship:major     # Incrementa major (1.3.35 → 2.0.0)
   ```

4. **Verificar en GitHub**
   - Ve a tu repo → Releases
   - Deberías ver la nueva versión con los instaladores adjuntos

## 🐛 Troubleshooting

### "Permission denied" al hacer push
- Verifica que tengas permisos de escritura en el repo
- Si es privado, asegúrate de estar autenticado

### "GH_TOKEN invalid" al hacer deploy
- Regenera el token en GitHub
- Asegúrate de copiar el token completo
- Verifica que tenga los permisos correctos

### Build falla con "Icon not found"
- Verifica que existan los iconos en `public/`:
  - `essenza.ico` (Windows)
  - `icon.icns` (macOS)
  - `icon.png` (Linux)

### CORS error al hacer login
- Verifica que el backend tenga configurado CORS
- Asegúrate que `VITE_API_BASE_URL` sea correcta
- El backend debe permitir peticiones desde apps de escritorio

## 📞 Soporte

Si tenés problemas, verificá:
1. Que Node.js sea versión 18+
2. Que todas las dependencias estén instaladas (`npm install`)
3. Que el `.env` esté configurado correctamente
4. Que el backend esté online y accesible
