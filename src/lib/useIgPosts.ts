import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL as apiUrl } from '@/config.js'

export interface IgAccountLite {
  id: number
  handle: string | null
  igUsername: string | null
  status: string
  profilePhotoUrl: string | null
  followers: number | null
}

export interface IgScheduleResult {
  count: number
  skipped: number
  from: string
  to: string
  spreadMinutes: number
}

export function useIgPosts() {
  const auth = useAuthStore()
  const headers = () => ({ Authorization: `Bearer ${auth.user?.token}` })

  /** Cuentas IG de una modelo que ya tienen Instagram enganchado (con su estado). */
  async function getAccounts(modelId: number): Promise<IgAccountLite[]> {
    const res = await fetch(`${apiUrl}/automation/ig-accounts?modelId=${modelId}`, { headers: headers() })
    if (!res.ok) throw new Error('No se pudieron cargar las cuentas IG')
    const all = await res.json()
    return all.filter((a: any) => a.igUsername)
  }

  /** Propaga un contenido a N cuentas con horarios desparejos. */
  async function schedule(payload: {
    modelId: number | null
    accountIds: number[]
    contentType: string
    caption?: string
    hashtags?: string
    link?: string
    scheduledAt: string
    spreadMinutes: number
    storyConfig?: any
  }, file: File): Promise<IgScheduleResult> {
    const fd = new FormData()
    fd.append('media', file)
    fd.append('request', JSON.stringify(payload))
    const res = await fetch(`${apiUrl}/automation/ig-posts`, { method: 'POST', headers: headers(), body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Error al programar')
    return data
  }

  async function getCalendar(year: number, month: number): Promise<any[]> {
    const res = await fetch(`${apiUrl}/automation/ig-posts/calendar?year=${year}&month=${month}`, { headers: headers() })
    if (!res.ok) return []
    return res.json()
  }

  async function cancel(id: number): Promise<void> {
    await fetch(`${apiUrl}/automation/ig-posts/${id}`, { method: 'DELETE', headers: headers() })
  }

  /** Borra el registro del calendario de forma definitiva (no toca lo ya publicado en IG). */
  async function remove(id: number): Promise<void> {
    const res = await fetch(`${apiUrl}/automation/ig-posts/${id}/remove`, { method: 'DELETE', headers: headers() })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'No se pudo eliminar')
    }
  }

  /** Reprograma una publicación pendiente (drag & drop). Opcional: reasignar a otra cuenta. */
  async function reschedule(id: number, scheduledAt: string, accountId?: number): Promise<void> {
    const res = await fetch(`${apiUrl}/automation/ig-posts/${id}/reschedule`, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(accountId != null ? { scheduledAt, accountId } : { scheduledAt }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'No se pudo reprogramar')
    }
  }

  /** Edita una publicación pendiente (descripción, hashtags, link, tipo, horario, cuenta). */
  async function edit(id: number, payload: {
    caption?: string; hashtags?: string; link?: string; contentType?: string
    scheduledAt?: string; accountId?: number
  }): Promise<void> {
    const res = await fetch(`${apiUrl}/automation/ig-posts/${id}`, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'No se pudo guardar')
    }
  }

  /** Duplica una publicación (repost). Opcional: nuevo horario; si no, copia el original. */
  async function duplicate(id: number, scheduledAt?: string): Promise<void> {
    const res = await fetch(`${apiUrl}/automation/ig-posts/${id}/duplicate`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'No se pudo duplicar')
    }
  }

  /** Busca canciones en IG (sticker de música), usando una cuenta LISTA de la modelo. */
  async function searchMusic(modelId: number, q: string): Promise<any[]> {
    const res = await fetch(`${apiUrl}/automation/ig-accounts/music-search?modelId=${modelId}&q=${encodeURIComponent(q)}`, { headers: headers() })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo buscar música')
    return data.tracks || []
  }

  return { getAccounts, schedule, getCalendar, cancel, remove, reschedule, duplicate, edit, searchMusic }
}
