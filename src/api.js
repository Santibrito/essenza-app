import { useAuthStore } from './stores/auth'
import { API_BASE_URL as apiUrl } from './config.js'

// Cache for preventing duplicate requests
const requestCache = new Map()
const CACHE_TTL = 30000 // 30 seconds

async function request(path, options = {}) {
  const auth = useAuthStore()
  
  // Create cache key for GET requests
  const cacheKey = options.method === 'GET' || !options.method ? `${path}${JSON.stringify(options)}` : null
  
  // Check cache for GET requests
  if (cacheKey && requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey)
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
    requestCache.delete(cacheKey)
  }
  
  const headers = {
    'Content-Type': 'application/json',
    // Prevent caching at HTTP level
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...options.headers
  }

  if (auth.user?.token) {
    headers['Authorization'] = `Bearer ${auth.user.token}`
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers
  })

  if (response.status === 401) {
    // Sesión expirada: deslogueamos y lanzamos un error estructurado.
    // Antes hacíamos `return` (undefined) y los callers que destructuran
    // `{ data }` reventaban con un TypeError críptico.
    auth.logout()
    throw { status: 401, code: 'AUTH', message: 'Tu sesión expiró. Volvé a iniciar sesión.' }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw { status: response.status, ...error }
  }

  const result = { data: await response.json().catch(() => ({})) }
  
  // Cache GET requests
  if (cacheKey) {
    requestCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    // Clean old cache entries periodically
    if (requestCache.size > 50) {
      const now = Date.now()
      for (const [key, value] of requestCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          requestCache.delete(key)
        }
      }
    }
  }
  
  return result
}

// Clear cache on logout
export function clearApiCache() {
  requestCache.clear()
}

export default {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, data, options) => request(path, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (path, data, options) => request(path, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  patch: (path, data, options) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(data) })
}
