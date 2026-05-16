import { useAuthStore } from './stores/auth'

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'

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
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...options.headers
  }

  if (auth.user?.token) {
    headers['Authorization'] = `Bearer ${auth.user.token}`
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers
    })

    // CRITICAL: Handle session expiration globally
    if (response.status === 401 || response.status === 403) {
      console.error('Session expired or invalid (401/403). Forcing logout.')
      auth.logout()
      // Use window.location to force a hard redirect to login
      if (window.location.hash !== '#/login') {
        window.location.href = '#/login'
      }
      return null
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP Error ${response.status}` }))
      throw errorData
    }

    // Success - parse JSON
    const data = await response.json().catch(() => ({}))
    const result = { data }
    
    // Cache GET requests
    if (cacheKey) {
      requestCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })
      
      if (requestCache.size > 50) {
        const now = Date.now()
        for (const [key, value] of requestCache.entries()) {
          if (now - value.timestamp > CACHE_TTL) requestCache.delete(key)
        }
      }
    }
    
    return result
  } catch (error) {
    console.error(`API Request Error [${path}]:`, error)
    throw error
  }
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
  patch: (path, data, options) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  request // Export the base request for custom needs
}
