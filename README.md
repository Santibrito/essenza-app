# ESSENZA MODELS - Desktop App

Aplicación de escritorio multiplataforma para ESSENZA MODELS, construida con Electron + Vue 3 + Vite.

## 🚀 Stack Tecnológico

- **Electron** - Framework para apps de escritorio
- **Vue 3** - Framework frontend
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Estilos
- **Pinia** - State management
- **Vue Router** - Routing
- **Radix Vue** - Componentes UI

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Git

## 🔧 Configuración Inicial

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/TU_USUARIO/TU_REPO.git
   cd TU_REPO
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` y configurar:
   - `VITE_API_BASE_URL` - URL del backend API
   - `VITE_JWT_SECRET` - Secret para JWT (debe coincidir con el backend)
   - `GH_TOKEN` - Token de GitHub para publicar releases (solo para deploy)

## 🛠️ Desarrollo

```bash
# Modo desarrollo (hot reload)
npm run dev

# Solo Electron (sin rebuild)
npm run electron

# Preview del build
npm run preview
```

La app se abrirá en `http://localhost:5173` y Electron cargará automáticamente.

## 📦 Build y Deploy

### Build local
```bash
npm run build
```

### Crear distribución (instaladores)
```bash
npm run dist
```

Esto genera:
- **Windows**: `ESSENZA MODELS_Setup_X.X.X.exe` en `release/X.X.X/`
- **macOS**: `ESSENZA MODELS_Setup_X.X.X.dmg` en `release/X.X.X/`

### Deploy automático a GitHub Releases

```bash
# Patch version (1.3.35 → 1.3.36)
npm run ship

# Minor version (1.3.35 → 1.4.0)
npm run ship:minor

# Major version (1.3.35 → 2.0.0)
npm run ship:major
```

**Requisitos para deploy:**
1. Tener `GH_TOKEN` configurado en `.env`
2. El token debe tener permisos de `repo` y `write:packages`
3. El repositorio debe existir en GitHub

### Crear GitHub Token

1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Selecciona scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:packages` (Upload packages to GitHub Package Registry)
4. Copia el token y agrégalo a `.env` como `GH_TOKEN`

## 🔒 Seguridad

- **NUNCA** subas el archivo `.env` al repositorio
- El `.gitignore` ya está configurado para excluir archivos sensibles
- Los tokens y secretos deben estar solo en `.env` local
- Para CI/CD, usa GitHub Secrets

## 📁 Estructura del Proyecto

```
app/
├── electron/          # Código de Electron (main process)
├── public/            # Assets estáticos (iconos, etc.)
├── src/
│   ├── assets/        # Imágenes y estilos globales
│   ├── components/    # Componentes Vue
│   ├── composables/   # Composables de Vue
│   ├── lib/           # Utilidades y helpers
│   ├── router/        # Configuración de Vue Router
│   ├── stores/        # Stores de Pinia
│   ├── views/         # Vistas/páginas
│   ├── api.js         # Cliente API
│   ├── App.vue        # Componente raíz
│   └── main.js        # Entry point
├── scripts/           # Scripts de build y deploy
├── .env               # Variables de entorno (NO SUBIR)
├── .env.example       # Template de variables de entorno
├── package.json       # Dependencias y scripts
└── vite.config.js     # Configuración de Vite
```

## 🔄 Auto-actualización

La app incluye `electron-updater` que verifica automáticamente nuevas versiones en GitHub Releases y permite actualizar sin reinstalar.

## 📝 Notas

- La versión en `package.json` debe coincidir con `VITE_APP_VERSION` en `.env`
- Los builds se guardan en `release/VERSION/`
- El directorio `release/` NO se sube a Git (está en `.gitignore`)

## 🐛 Troubleshooting

### Error: "GH_TOKEN not found"
- Asegúrate de tener `GH_TOKEN` en tu `.env`
- Verifica que el token tenga los permisos correctos

### Error de CORS al hacer login
- Verifica que `VITE_API_BASE_URL` apunte al backend correcto
- El backend debe tener configurado CORS para permitir peticiones desde la app

### Build falla en Windows/Mac
- Asegúrate de tener los iconos correctos en `public/`
- Windows necesita `essenza.ico`
- macOS necesita `icon.icns`

## 📄 Licencia

Propiedad de SB TECHNOLOGY
