import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { clearApiCache } from '../api.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const isSessionValidated = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  // Initialize from localStorage
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser)
      // Basic sanity check: must have token and id
      if (parsed && parsed.token && parsed.id) {
        user.value = parsed
      } else {
        localStorage.removeItem('user')
      }
    } catch {
      localStorage.removeItem('user')
    }
  }

  /**
   * Login — replace mock logic with your real API call here
   */
  async function login(username, password) {
    isLoading.value = true
    error.value = null

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      if (!res.ok) {
        throw new Error('Usuario o contraseña incorrectos')
      }

      const data = await res.json()
      
      const userData = {
        id: data.id,
        name: data.name,
        username: data.username,
        role: data.role,
        token: data.token,
        mustChangePassword: data.mustChangePassword,
        timezone: data.timezone || 'America/Argentina/Buenos_Aires',
        shiftTargetSeconds: data.shiftTargetSeconds,
        breakTargetSeconds: data.breakTargetSeconds,
        profilePictureUrl: data.profilePictureUrl,
        profilePictureBase64: data.profilePictureBase64
      }
      
      if (data.mustChangePassword) {
        return { success: true, mustChangePassword: true, tempUser: userData }
      }

      user.value = userData
      localStorage.setItem('user', JSON.stringify(userData))
      return { success: true, mustChangePassword: false }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      isLoading.value = false
    }
  }

  async function refreshUserProfile() {
    if (!user.value) return
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
      const res = await fetch(`${apiUrl}/admin/users/me`, {
        headers: {
          'Authorization': `Bearer ${user.value.token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        user.value = { 
          ...user.value, 
          shiftTargetSeconds: data.shiftTargetSeconds,
          breakTargetSeconds: data.breakTargetSeconds,
          name: data.name,
          timezone: data.timezone || user.value.timezone,
          profilePictureUrl: data.profilePictureUrl,
          profilePictureBase64: data.profilePictureBase64
        }
        localStorage.setItem('user', JSON.stringify(user.value))
      }
    } catch (e) {
      console.error('Error refreshing profile:', e)
    }
  }

  async function changePassword(userId, token, newPassword) {
    isLoading.value = true
    error.value = null
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
      const res = await fetch(`${apiUrl}/admin/users/me/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      })

      if (!res.ok) throw new Error('Error al actualizar contraseña')
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Validate the stored token against the server.
   * Returns true if the session is valid, false otherwise.
   * On failure, cleans up and returns false (does NOT auto-logout to avoid loops).
   */
  async function validateSession() {
    if (!user.value?.token) {
      isSessionValidated.value = false
      return false
    }

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
      const res = await fetch(`${apiUrl}/admin/users/me`, {
        headers: {
          'Authorization': `Bearer ${user.value.token}`,
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(8000)
      })

      if (res.ok) {
        // Token is valid — optionally refresh profile data
        const data = await res.json()
        user.value = {
          ...user.value,
          name: data.name,
          shiftTargetSeconds: data.shiftTargetSeconds,
          breakTargetSeconds: data.breakTargetSeconds,
          timezone: data.timezone || user.value.timezone,
          profilePictureUrl: data.profilePictureUrl,
          profilePictureBase64: data.profilePictureBase64
        }
        localStorage.setItem('user', JSON.stringify(user.value))
        isSessionValidated.value = true
        return true
      }

      if (res.status === 401 || res.status === 403) {
        // Token expired or revoked — clean up
        console.warn('[Auth] Token invalid (HTTP', res.status, '). Cleaning session.')
        user.value = null
        localStorage.removeItem('user')
        isSessionValidated.value = false
        return false
      }

      // Other errors (500, network) — don't invalidate, could be transient
      console.warn('[Auth] Validation got non-auth error:', res.status)
      isSessionValidated.value = true
      return true
    } catch (err) {
      // Network error — assume session is still valid (offline tolerance)
      console.warn('[Auth] Validation failed (network):', err)
      isSessionValidated.value = true
      return true
    }
  }

  function logout() {
    user.value = null
    error.value = null
    isSessionValidated.value = false
    
    // Remove auth-specific keys (NOT localStorage.clear() which nukes shift recovery data)
    localStorage.removeItem('user')
    localStorage.removeItem('currentShiftId')
    localStorage.removeItem('shiftStartTime')
    localStorage.removeItem('essenza_model_reports')
    localStorage.removeItem('essenza_observations')
    localStorage.removeItem('selectedScreenId')
    localStorage.removeItem('afkOverride')
    sessionStorage.clear()
    
    // Clear API cache
    clearApiCache()
    
    // Clear Electron cache if available
    if (window.electronAPI?.clearCache) {
      window.electronAPI.clearCache()
    }
    
    // Force reload to clear all Vue state and HTTP cache
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  function clearError() {
    error.value = null
  }

  function updateTimezone(tz) {
    if (!user.value) return
    user.value.timezone = tz
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  function updateProfilePicture(url) {
    if (!user.value) return
    user.value.profilePictureUrl = url
    user.value.profilePictureBase64 = null
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  return { user, isAuthenticated, isSessionValidated, isLoading, error, login, logout, clearError, changePassword, updateTimezone, updateProfilePicture, refreshUserProfile, validateSession }
})
